/**
 * Finishing an order and the webhook events. `finalizeOrder` is called by the
 * success page and by the webhook alike — in Next those are separate module
 * graphs, on Vercel separate processes — so nothing in this module's memory
 * can order them. The order itself is the lock: one conditional UPDATE in the
 * database moves it `pending → finalizing`, and only the caller whose UPDATE
 * changed a row goes on; the other waits for the status to settle. A refund is
 * applied the same way, by growing `refundedAmount` conditionally. The webhook
 * handler also remembers the ids of the events it has handled, so a repeated
 * event changes nothing.
 */
import type { Payload } from "payload";
import type { Order, Subscription } from "../../payload-types";
import { confirmSeats, releaseHolds } from "../booking/holds";
import { sendOrderConfirmation } from "../mail";
import { relId } from "./checkout";
import { gateway } from "./gateway";
import { trackPurchase } from "./track";
import type { GatewayEvent, GatewaySession } from "./types";

async function cms(): Promise<Payload> {
  const [{ getPayload }, { default: config }] = await Promise.all([import("payload"), import("../../payload.config")]);
  return getPayload({ config });
}

// ---- The order as the lock: compare-and-set in the database ----------------

type Db = Payload["db"] & { tableNameMap?: Map<string, string>; execute?: (args: { drizzle: unknown; raw: string }) => unknown };

/** Runs one statement and tells how many rows it changed (Postgres `rowCount`, SQLite `rowsAffected`). */
async function affected(p: Payload, raw: string): Promise<number> {
  const db = p.db as Db;
  if (!db.execute) throw new Error("the database adapter cannot run a statement");
  // The adapter's execute() is a plain function: it runs on the drizzle instance it is handed.
  const result = (await db.execute({ drizzle: db.drizzle, raw })) as { rowCount?: number | null; rowsAffected?: number } | undefined;
  return result?.rowCount ?? result?.rowsAffected ?? 0;
}
const table = (p: Payload, slug: string) => `"${(p.db as Db).tableNameMap?.get(slug) || slug}"`;
const literal = (v: string) => `'${v.replace(/'/g, "''")}'`;

/** A finalizing order older than this was left by a process that died: it may be claimed again. */
const CLAIM_STALE_MS = 60_000;

/** Takes the order for finishing — `pending → finalizing` by one conditional UPDATE; true for the one caller that won. */
async function claim(p: Payload, orderId: number, at = new Date()): Promise<boolean> {
  const stale = new Date(at.getTime() - CLAIM_STALE_MS).toISOString();
  const changed = await affected(
    p,
    `UPDATE ${table(p, "orders")} SET status = 'finalizing', updated_at = ${literal(at.toISOString())} ` +
      `WHERE id = ${Math.trunc(orderId)} AND (status = 'pending' OR (status = 'finalizing' AND updated_at < ${literal(stale)}))`,
  );
  return changed === 1;
}

/** Gives a claimed order back (the work failed): `finalizing → pending`, so the next call tries again at once. */
async function unclaim(p: Payload, orderId: number): Promise<void> {
  await affected(p, `UPDATE ${table(p, "orders")} SET status = 'pending', updated_at = ${literal(now())} WHERE id = ${Math.trunc(orderId)} AND status = 'finalizing'`);
}

const fresh = async (p: Payload, id: number) => (await p.findByID({ collection: "orders", id, depth: 0, overrideAccess: true })) as Order;

/** The order once whoever claimed it is done: polled for a few seconds, then returned as it is. */
async function settled(p: Payload, id: number): Promise<Order> {
  for (let i = 0; i < 20; i++) {
    const order = await fresh(p, id);
    if (order.status !== "finalizing") return order;
    await new Promise((r) => setTimeout(r, 250));
  }
  return fresh(p, id);
}

/** Claims the order and runs `work` on it; on a failure the claim is given back and the error goes on. Null when somebody else holds it. */
async function claimed(p: Payload, id: number, work: (order: Order) => Promise<Order>): Promise<Order | null> {
  if (!(await claim(p, id))) return null;
  try {
    return await work(await fresh(p, id));
  } catch (err) {
    await unclaim(p, id).catch((e) => p.logger.error({ err: e, msg: `order ${id} could not be given back` }));
    throw err;
  }
}

const now = () => new Date().toISOString();
const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);
const idOf = (v: unknown): string | undefined => (typeof v === "string" ? v : str((v as { id?: unknown } | null)?.id));
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

async function orderBy(p: Payload, field: "stripeSessionId" | "stripePaymentIntentId", value: string): Promise<Order | null> {
  const res = await p.find({ collection: "orders", where: { [field]: { equals: value } }, limit: 1, depth: 0, overrideAccess: true });
  return (res.docs[0] as Order | undefined) || null;
}

const withEvent = (order: Order, type: string, note?: string) => [...(order.events || []), { at: now(), type, note }];

/** The pending order expires: its seats go back on sale. */
async function expireOrder(p: Payload, order: Order): Promise<Order> {
  if (order.status !== "pending" && order.status !== "finalizing") return order;
  const updated = (await p.update({
    collection: "orders",
    id: order.id,
    data: { status: "expired", events: withEvent(order, "expired") },
    depth: 0,
    overrideAccess: true,
  })) as Order;
  await releaseHolds(String(order.id), p);
  return updated;
}

/**
 * The order is paid: first the buyer's details from Checkout, then the
 * registrations (the holds become seats), and only then the status — so a
 * failure in the middle leaves a pending order that the next call finishes,
 * and `confirmSeats` writes only the registrations still missing.
 */
async function payOrder(p: Payload, order: Order, session: GatewaySession): Promise<Order> {
  const detailed = (await p.update({
    collection: "orders",
    id: order.id,
    data: {
      stripePaymentIntentId: session.paymentIntentId,
      stripeCustomerId: session.customerId,
      customer: {
        name: session.customer.name ?? order.customer?.name,
        email: session.customer.email ?? order.customer?.email,
        phone: session.customer.phone ?? order.customer?.phone,
      },
      attendee: session.customFields.attendee?.trim() || order.attendee,
    },
    depth: 0,
    overrideAccess: true,
  })) as Order;
  await confirmSeats(order.id, p);
  const updated = (await p.update({
    collection: "orders",
    id: order.id,
    data: { status: "paid", paidAt: now(), events: withEvent(detailed, "paid", session.paymentIntentId) },
    depth: 0,
    overrideAccess: true,
  })) as Order;
  for (const [name, after] of [
    ["sendOrderConfirmation", () => sendOrderConfirmation(order.id)],
    ["trackPurchase", () => trackPurchase(order.id)],
  ] as const) {
    try {
      await after();
    } catch (err) {
      p.logger.error({ err, msg: `${name} failed for order ${order.id}` });
    }
  }
  return updated;
}

/**
 * Reads the Checkout session and brings the order in line with it: paid → the
 * order is paid, its seats registered, the confirmation sent; expired → the
 * order expired and its holds released; still open → nothing. The success
 * page and the webhook may ask at the same moment: the one that claims the
 * order does the work, the other waits for it and returns the same order. An
 * order that is not pending any more is returned as it is; an unknown
 * session → null.
 */
export async function finalizeOrder(stripeSessionId: string, payload?: Payload): Promise<Order | null> {
  const p = payload || (await cms());
  const found = await orderBy(p, "stripeSessionId", stripeSessionId);
  if (!found) return null;
  if (found.status === "finalizing") return settled(p, found.id);
  if (found.status !== "pending") return found;
  const gw = gateway();
  if (!gw) return found;
  const session = await gw.retrieveSession(stripeSessionId);
  if (!session) return found;
  const paid = session.paymentStatus === "paid" || session.paymentStatus === "no_payment_required";
  if (!paid && session.status !== "expired") return found;
  const done = await claimed(p, found.id, (order) => (paid ? payOrder(p, order, session) : expireOrder(p, order)));
  return done ?? settled(p, found.id);
}

// ---- Subscriptions -------------------------------------------------------------

const SUBSCRIPTION_STATUS: Record<string, Subscription["status"]> = {
  active: "active",
  past_due: "past_due",
  canceled: "canceled",
  incomplete: "incomplete",
  incomplete_expired: "canceled",
  trialing: "trialing",
  unpaid: "unpaid",
  paused: "unpaid",
};

type SubscriptionPatch = {
  status?: Subscription["status"];
  planId?: number;
  customerId?: string;
  customer?: { name?: string; email?: string };
  currentPeriodEnd?: string;
};

/** The subscription row for a Stripe subscription id: created or updated with what the event says. */
async function upsertSubscription(p: Payload, stripeSubscriptionId: string, patch: SubscriptionPatch): Promise<void> {
  const res = await p.find({ collection: "subscriptions", where: { stripeSubscriptionId: { equals: stripeSubscriptionId } }, limit: 1, depth: 0, overrideAccess: true });
  const existing = res.docs[0] as Subscription | undefined;
  const data: Record<string, unknown> = {};
  if (patch.status) data.status = patch.status;
  if (patch.planId) data.plan = patch.planId;
  if (patch.customerId) data.stripeCustomerId = patch.customerId;
  if (patch.currentPeriodEnd) data.currentPeriodEnd = patch.currentPeriodEnd;
  if (patch.customer && (patch.customer.name || patch.customer.email)) {
    data.customer = { name: patch.customer.name ?? existing?.customer?.name, email: patch.customer.email ?? existing?.customer?.email };
  }
  if (existing) {
    const changed = Object.entries(data).some(([k, v]) => JSON.stringify((existing as unknown as Record<string, unknown>)[k]) !== JSON.stringify(v));
    if (changed) await p.update({ collection: "subscriptions", id: existing.id, data, depth: 0, overrideAccess: true });
  } else {
    await p.create({ collection: "subscriptions", data: { status: "active", stripeSubscriptionId, ...data } as never, depth: 0, overrideAccess: true });
  }
}

const planIdOf = (metadata: unknown): number | undefined => {
  const raw = (metadata as Record<string, unknown> | undefined)?.planId;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

/** Stripe's `current_period_end` (seconds), on the subscription or, in newer API versions, on its first item. */
function periodEnd(obj: Record<string, unknown>): string | undefined {
  const items = (obj.items as { data?: { current_period_end?: unknown }[] } | undefined)?.data;
  const seconds = num(obj.current_period_end) ?? num(items?.[0]?.current_period_end);
  return seconds ? new Date(seconds * 1000).toISOString() : undefined;
}

// ---- Webhook ------------------------------------------------------------------

const handled = new Set<string>();
const HANDLED_MAX = 5000;
function remember(id: string) {
  handled.add(id);
  if (handled.size > HANDLED_MAX) handled.delete(handled.values().next().value as string);
}

async function refund(p: Payload, obj: Record<string, unknown>): Promise<void> {
  const pi = idOf(obj.payment_intent);
  if (!pi) return;
  const found = await orderBy(p, "stripePaymentIntentId", pi);
  if (!found) {
    p.logger.warn({ msg: "charge.refunded for a payment the site does not know", paymentIntent: pi });
    return;
  }
  const amount = num(obj.amount_refunded) ?? 0;
  const charged = found.total ?? num(obj.amount) ?? 0;
  const full = obj.refunded === true || (charged > 0 && amount >= charged);
  if (amount <= 0) return;
  // The refunded amount only grows, in one conditional UPDATE: a repeated or an older event changes nothing.
  const changed = await affected(
    p,
    `UPDATE ${table(p, "orders")} SET refunded_amount = ${Math.trunc(amount)}, updated_at = ${literal(now())} ` +
      `WHERE id = ${found.id} AND status IN ('paid', 'partially_refunded') AND COALESCE(refunded_amount, 0) < ${Math.trunc(amount)}`,
  );
  if (changed !== 1) return;
  const order = await fresh(p, found.id);
  const status: Order["status"] = full ? "refunded" : "partially_refunded";
  await p.update({
    collection: "orders",
    id: order.id,
    data: { status, events: withEvent(order, status, `${amount} of ${charged}`) },
    depth: 0,
    overrideAccess: true,
  });
  if (full) {
    await p.update({
      collection: "registrations",
      where: { and: [{ order: { equals: order.id } }, { status: { equals: "confirmed" } }] },
      data: { status: "refunded" },
      depth: 0,
      overrideAccess: true,
    });
  }
}

/** Applies one verified event from the gateway; `{handled: false}` for a type the site does not listen to. */
export async function handleWebhookEvent(event: GatewayEvent, payload?: Payload): Promise<{ handled: boolean }> {
  if (handled.has(event.id)) return { handled: true };
  const p = payload || (await cms());
  const obj = event.data.object || {};
  switch (event.type) {
    case "checkout.session.completed": {
      const id = str(obj.id);
      if (!id) break;
      if (obj.mode === "subscription") {
        const subId = idOf(obj.subscription);
        const details = obj.customer_details as { name?: unknown; email?: unknown } | undefined;
        if (subId) {
          await upsertSubscription(p, subId, {
            status: "active",
            planId: planIdOf(obj.metadata),
            customerId: idOf(obj.customer),
            customer: { name: str(details?.name), email: str(details?.email) },
          });
        }
      } else {
        await finalizeOrder(id, p);
      }
      break;
    }
    case "checkout.session.expired": {
      const id = str(obj.id);
      const order = id ? await orderBy(p, "stripeSessionId", id) : null;
      // Stripe says the session is over: the order is claimed and expired; a claim held elsewhere is left to finish on its own.
      if (order?.status === "pending") await claimed(p, order.id, (o) => expireOrder(p, o));
      break;
    }
    case "charge.refunded":
      await refund(p, obj);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subId = str(obj.id);
      if (!subId) break;
      const status = event.type.endsWith("deleted") ? "canceled" : SUBSCRIPTION_STATUS[str(obj.status) || ""];
      await upsertSubscription(p, subId, { status, planId: planIdOf(obj.metadata), customerId: idOf(obj.customer), currentPeriodEnd: periodEnd(obj) });
      break;
    }
    case "invoice.payment_failed": {
      const parent = obj.parent as { subscription_details?: { subscription?: unknown } } | undefined;
      const subId = idOf(obj.subscription) ?? idOf(parent?.subscription_details?.subscription);
      if (subId) await upsertSubscription(p, subId, { status: "past_due", customerId: idOf(obj.customer) });
      break;
    }
    default:
      return { handled: false };
  }
  remember(event.id);
  return { handled: true };
}

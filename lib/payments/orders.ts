/**
 * Finishing an order and the webhook events. `finalizeOrder` is called by the
 * success page and by the webhook alike and turns a pending order into a paid
 * one exactly once: a lock per order in this process, and the status checked
 * again under it. The webhook handler remembers the ids of the events it has
 * handled and checks the state before every write, so a repeated event
 * changes nothing.
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

// ---- A lock per key: the success page and the webhook may finish the same order at the same moment ----
const locks = new Map<string, Promise<unknown>>();
function withLock<T>(key: string, work: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) || Promise.resolve();
  const run = previous.then(work, work);
  const settled = run.catch(() => undefined).then(() => {
    if (locks.get(key) === settled) locks.delete(key);
  });
  locks.set(key, settled);
  return run;
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
  if (order.status !== "pending") return order;
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

async function payOrder(p: Payload, order: Order, session: GatewaySession): Promise<Order> {
  const updated = (await p.update({
    collection: "orders",
    id: order.id,
    data: {
      status: "paid",
      paidAt: now(),
      stripePaymentIntentId: session.paymentIntentId,
      stripeCustomerId: session.customerId,
      customer: {
        name: session.customer.name ?? order.customer?.name,
        email: session.customer.email ?? order.customer?.email,
        phone: session.customer.phone ?? order.customer?.phone,
      },
      attendee: session.customFields.attendee?.trim() || order.attendee,
      events: withEvent(order, "paid", session.paymentIntentId),
    },
    depth: 0,
    overrideAccess: true,
  })) as Order;
  await confirmSeats(order.id, p);
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
 * order expired and its holds released; still open → nothing. An order that
 * is not pending any more is returned as it is; an unknown session → null.
 */
export async function finalizeOrder(stripeSessionId: string, payload?: Payload): Promise<Order | null> {
  const p = payload || (await cms());
  const found = await orderBy(p, "stripeSessionId", stripeSessionId);
  if (!found) return null;
  return withLock(`order:${found.id}`, async () => {
    const order = (await p.findByID({ collection: "orders", id: found.id, depth: 0, overrideAccess: true })) as Order;
    if (order.status !== "pending") return order;
    const gw = gateway();
    if (!gw) return order;
    const session = await gw.retrieveSession(stripeSessionId);
    if (!session) return order;
    if (session.paymentStatus === "paid" || session.paymentStatus === "no_payment_required") return payOrder(p, order, session);
    if (session.status === "expired") return expireOrder(p, order);
    return order;
  });
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
  const order = await orderBy(p, "stripePaymentIntentId", pi);
  if (!order) {
    p.logger.warn({ msg: "charge.refunded for a payment the site does not know", paymentIntent: pi });
    return;
  }
  await withLock(`order:${order.id}`, async () => {
    const amount = num(obj.amount_refunded) ?? 0;
    const charged = order.total ?? num(obj.amount) ?? 0;
    const full = obj.refunded === true || (charged > 0 && amount >= charged);
    const status: Order["status"] = full ? "refunded" : amount > 0 ? "partially_refunded" : order.status;
    if (order.status === status && (order.refundedAmount ?? 0) === amount) return;
    await p.update({
      collection: "orders",
      id: order.id,
      data: { status, refundedAmount: amount, events: withEvent(order, status, `${amount} of ${charged}`) },
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
  });
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
      if (order) await withLock(`order:${order.id}`, async () => expireOrder(p, (await p.findByID({ collection: "orders", id: order.id, depth: 0, overrideAccess: true })) as Order));
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

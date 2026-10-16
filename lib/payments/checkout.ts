/**
 * Checkout for a pending order and for a membership plan. The order is created
 * before the payment (the route does that, with the holds under its id); here
 * its lines become Checkout line items with the tax rates of the pickup
 * studio's province, and the session's id is written back on the order so the
 * webhook and the success page can finish it.
 */
import type { Payload } from "payload";
import type { Order, Plan, Product, Studio } from "../../payload-types";
import { addressParts } from "../cms/address";
import { getCMS } from "../cms/payload";
import { relId } from "../cms/relations";
import { CHECKOUT_TTL_MS, PAYMENT_UNAVAILABLE, gateway } from "./gateway";
import { MEMBERSHIP_PROVINCE, ratesFor } from "./tax";
import type { CheckoutInput } from "./types";

/**
 * The two-letter province of a studio: from the last address line
 * ("Vancouver, BC V6A 2Z9", read by `addressParts`), else from its region text
 * ("Vancouver, BC").
 */
export function studioProvince(studio: Pick<Studio, "address" | "region"> | null | undefined): string {
  if (!studio) return "";
  return addressParts(studio.address).regionCode || studio.region?.trim().match(/\b([A-Z]{2})$/)?.[1] || "";
}

/** A Checkout session for the order: the buyer is sent to its URL; the order remembers the session. */
export async function createCheckoutForOrder(order: Order, origin: string, payload?: Payload): Promise<{ id: string; url: string }> {
  const gw = gateway();
  if (!gw) throw new Error(PAYMENT_UNAVAILABLE);
  if (order.status !== "pending") throw new Error(`Order ${order.number || order.id} is ${order.status}, not pending`);
  const p = payload || (await getCMS());

  const studioId = relId(order.pickupStudio);
  const studio = studioId
    ? ((await p.findByID({ collection: "studios", id: studioId, depth: 0, overrideAccess: true })) as Studio | null)
    : null;
  const province = studioProvince(studio);

  const lines = (order.lines || []).filter((l) => l.kind === "session" || l.kind === "product");
  const productIds = [...new Set(lines.filter((l) => l.kind === "product").map((l) => relId(l.product)).filter((id): id is number => !!id))];
  const products = productIds.length
    ? ((await p.find({ collection: "products", where: { id: { in: productIds } }, depth: 0, limit: 0, pagination: false, overrideAccess: true })).docs as Product[])
    : [];
  const pathOf = new Map(products.map((d) => [d.id, d.path]));

  const input: CheckoutInput = {
    orderId: order.id,
    orderNumber: order.number || String(order.id),
    origin,
    customerEmail: order.customer?.email || undefined,
    collectAttendee: lines.some((l) => l.kind === "session"),
    expiresAt: new Date(Date.now() + CHECKOUT_TTL_MS),
    lines: lines.map((l) => {
      const id = (l.kind === "session" ? relId(l.session) : relId(l.product)) as number;
      const name = l.option ? `${l.label} — ${l.option}` : l.label;
      return {
        name,
        productRef: { kind: l.kind as "session" | "product", id, name: l.label, path: l.kind === "product" ? pathOf.get(id) : undefined },
        unitAmount: l.unitAmount,
        quantity: l.quantity,
        taxLines: ratesFor(province, l.taxGroup || "service"),
      };
    }),
  };
  if (!input.lines.length) throw new Error(`Order ${order.number || order.id} has nothing to pay for`);

  const session = await gw.createCheckout(input);
  await p.update({
    collection: "orders",
    id: order.id,
    data: {
      stripeSessionId: session.id,
      gateway: gw.name,
      events: [...(order.events || []), { at: new Date().toISOString(), type: "checkout.created", note: session.id }],
    },
    depth: 0,
    overrideAccess: true,
  });
  return session;
}

/** A subscription Checkout for a plan whose price lives in Stripe (R11), charged GST as a service; a plan without a price id cannot be subscribed to. */
export async function createSubscriptionCheckout(plan: Pick<Plan, "id" | "stripePriceId">, origin: string): Promise<{ id: string; url: string }> {
  const gw = gateway();
  if (!gw) throw new Error(PAYMENT_UNAVAILABLE);
  if (!plan.stripePriceId) throw new Error(`Plan ${plan.id} has no Stripe price`);
  return gw.createSubscriptionCheckout({ planId: plan.id, priceId: plan.stripePriceId, origin, taxLines: ratesFor(MEMBERSHIP_PROVINCE, "service") });
}

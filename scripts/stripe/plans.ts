/**
 * The pure part of `npm run stripe:setup`: which plans are sold as Stripe
 * subscriptions and how each is matched to a Stripe Product and a monthly
 * recurring Price — found by metadata and amount, created only when missing,
 * so a second run changes nothing (R14: no Stripe ids in the code).
 */
import type Stripe from "stripe";
import type { Plan } from "../../payload-types";

/** The slice of the SDK the setup uses; a test hands in a stand-in with these members. */
export type SetupClient = Pick<Stripe, "products" | "prices" | "webhookEndpoints">;

export const CURRENCY = "cad";
export const CMS_KIND = "plan";

/** The events the site's webhook route handles (lib/payments/orders.ts). */
export const WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "checkout.session.expired",
  "charge.refunded",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
] as const;

export type SubscriptionPlan = Pick<Plan, "id" | "name" | "price" | "period" | "group" | "stripePriceId">;

/** A plan is a subscription when its period says "month" and it has a price above zero; others stay manual. */
export function subscriptionPlans<T extends SubscriptionPlan>(plans: T[]): T[] {
  return plans.filter((p) => /month/i.test(p.period || "") && typeof p.price === "number" && p.price > 0);
}

/** The plan's price in cents, as Stripe wants it; CMS prices are dollars. */
export const cents = (dollars: number): number => Math.round(dollars * 100);

export type SyncResult = {
  planId: number;
  name: string;
  unitAmount: number;
  productId: string;
  priceId: string;
  created: { product: boolean; price: boolean };
};

type ProductHit = { id: string };
type PriceHit = { id: string; active?: boolean; currency?: string; unit_amount?: number | null; recurring?: { interval?: string; interval_count?: number } | null };

const isMonthlyAt = (p: PriceHit, amount: number) =>
  p.active !== false &&
  p.currency === CURRENCY &&
  p.unit_amount === amount &&
  p.recurring?.interval === "month" &&
  (p.recurring.interval_count ?? 1) === 1;

/**
 * One plan → its Stripe Product (by `metadata.cms_kind`/`cms_id`, like the gateway's
 * `ensureProduct`) and an active monthly CAD Price of the plan's amount. Missing
 * pieces are created; with `dryRun` they are only reported (ids `(new)`). A plan whose
 * amount changed gets a new price; the old one stays for existing subscriptions.
 */
export async function syncPlan(client: SetupClient, plan: SubscriptionPlan, opts: { dryRun?: boolean } = {}): Promise<SyncResult> {
  const unitAmount = cents(plan.price || 0);
  const cmsId = String(plan.id);
  const found = await client.products.search({
    query: `active:'true' AND metadata['cms_kind']:'${CMS_KIND}' AND metadata['cms_id']:'${cmsId}'`,
    limit: 1,
  });
  let product: ProductHit | undefined = found.data[0];
  const created = { product: false, price: false };
  if (!product) {
    created.product = true;
    const metadata: Record<string, string> = { cms_kind: CMS_KIND, cms_id: cmsId };
    if (plan.group) metadata.group = plan.group;
    product = opts.dryRun ? { id: "(new)" } : await client.products.create({ name: plan.name, metadata });
  }
  let price: PriceHit | undefined;
  if (!created.product) {
    const prices = await client.prices.list({ product: product.id, active: true, type: "recurring", limit: 100 });
    price = (prices.data as PriceHit[]).find((p) => isMonthlyAt(p, unitAmount));
  }
  if (!price) {
    created.price = true;
    price = opts.dryRun
      ? { id: "(new)" }
      : await client.prices.create({
          product: product.id,
          currency: CURRENCY,
          unit_amount: unitAmount,
          recurring: { interval: "month" },
          metadata: { cms_kind: CMS_KIND, cms_id: cmsId },
        });
  }
  return { planId: plan.id, name: plan.name, unitAmount, productId: product.id, priceId: price.id, created };
}

export type EndpointResult = { id: string; url: string; created: boolean; secret?: string; eventsUpdated: boolean };

/**
 * The webhook endpoint for `url`: created with the site's events when missing
 * (its signing secret comes back exactly once, now); an existing one gets its
 * event list brought up to date and no secret — Stripe never shows it again.
 */
export async function ensureWebhookEndpoint(client: SetupClient, url: string, opts: { dryRun?: boolean } = {}): Promise<EndpointResult> {
  const existing = await client.webhookEndpoints.list({ limit: 100 });
  const found = existing.data.find((e) => e.url === url);
  const events = [...WEBHOOK_EVENTS];
  if (found) {
    const have = new Set(found.enabled_events || []);
    const missing = events.filter((e) => !have.has(e));
    if (missing.length && !opts.dryRun) await client.webhookEndpoints.update(found.id, { enabled_events: [...new Set([...(found.enabled_events || []), ...events])] as never });
    return { id: found.id, url, created: false, eventsUpdated: missing.length > 0 };
  }
  if (opts.dryRun) return { id: "(new)", url, created: true, eventsUpdated: false };
  const made = await client.webhookEndpoints.create({ url, enabled_events: events as never, description: "Hand Eye Ceramics site" });
  return { id: made.id, url, created: true, secret: made.secret || undefined, eventsUpdated: false };
}

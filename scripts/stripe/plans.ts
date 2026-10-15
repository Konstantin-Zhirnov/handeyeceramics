/**
 * The pure part of `npm run stripe:setup`: which plans are sold as Stripe
 * subscriptions and how each is matched to a Stripe Product and a monthly
 * recurring Price — found by metadata and amount, created only when missing,
 * so a second run changes nothing (R14: no Stripe ids in the code). The
 * Product is looked up through the site's own gateway, the way the checkout
 * looks up the Products of classes and goods; the webhook endpoint is
 * subscribed to `WEBHOOK_EVENTS`, the list the webhook route handles.
 */
import path from "node:path";
import Stripe from "stripe";
import type { Plan } from "../../payload-types";
import { cents } from "../../lib/cart/pricing";
import { WEBHOOK_EVENTS } from "../../lib/payments/orders";
import { CURRENCY, stripeGateway, type StripeClient } from "../../lib/payments/stripe";
import type { PaymentGateway, ProductRef } from "../../lib/payments/types";

export { CURRENCY, WEBHOOK_EVENTS, cents };

/** The slice of the SDK the setup uses; a test hands in a stand-in with these members. */
export type SetupClient = Pick<Stripe, "products" | "prices" | "webhookEndpoints">;
/** The `cms_kind` of a plan's Product; classes are "session" and goods "product" (lib/payments/types). */
export const CMS_KIND = "plan";

/**
 * The two handles of one run: the SDK for prices and endpoints, and the site's
 * gateway over the same SDK for the Products — it remembers every id it found
 * or created, so a plan is searched for once per run.
 */
export type Setup = { client: SetupClient; products: Pick<PaymentGateway, "findProduct" | "ensureProduct"> };

export function setupFor(secretKey: string, client: SetupClient = new Stripe(secretKey)): Setup {
  return { client, products: stripeGateway(secretKey, client as unknown as StripeClient) };
}

export type SubscriptionPlan = Pick<Plan, "id" | "name" | "price" | "period" | "group" | "stripePriceId">;

/** A plan is a subscription when its period says "month" and it has a price above zero; others stay manual. */
export function subscriptionPlans<T extends SubscriptionPlan>(plans: T[]): T[] {
  return plans.filter((p) => /month/i.test(p.period || "") && typeof p.price === "number" && p.price > 0);
}

export type SyncResult = {
  planId: number;
  name: string;
  unitAmount: number;
  productId: string;
  priceId: string;
  created: { product: boolean; price: boolean };
};

type PriceHit = { id: string; active?: boolean; currency?: string; unit_amount?: number | null; recurring?: { interval?: string; interval_count?: number } | null };

const isMonthlyAt = (p: PriceHit, amount: number) =>
  p.active !== false &&
  p.currency === CURRENCY &&
  p.unit_amount === amount &&
  p.recurring?.interval === "month" &&
  (p.recurring.interval_count ?? 1) === 1;

/**
 * One plan → its Stripe Product (the gateway's lookup by `cms_kind` / `cms_id`)
 * and an active monthly CAD Price of the plan's amount. Missing pieces are
 * created; with `dryRun` they are only reported (ids `(new)`). A plan whose
 * amount changed gets a new price; the old one stays for existing subscriptions.
 */
export async function syncPlan(setup: Setup, plan: SubscriptionPlan, opts: { dryRun?: boolean } = {}): Promise<SyncResult> {
  const unitAmount = cents(plan.price);
  const ref: ProductRef = { kind: CMS_KIND, id: plan.id, name: plan.name, group: plan.group || undefined };
  let productId = await setup.products.findProduct(ref);
  const created = { product: !productId, price: false };
  if (!productId) productId = opts.dryRun ? "(new)" : await setup.products.ensureProduct(ref);
  let price: PriceHit | undefined;
  if (!created.product) {
    const prices = await setup.client.prices.list({ product: productId, active: true, type: "recurring", limit: 100 });
    price = (prices.data as PriceHit[]).find((p) => isMonthlyAt(p, unitAmount));
  }
  if (!price) {
    created.price = true;
    price = opts.dryRun
      ? { id: "(new)" }
      : await setup.client.prices.create({
          product: productId,
          currency: CURRENCY,
          unit_amount: unitAmount,
          recurring: { interval: "month" },
          metadata: { cms_kind: CMS_KIND, cms_id: String(plan.id) },
        });
  }
  return { planId: plan.id, name: plan.name, unitAmount, productId, priceId: price.id, created };
}

export type EndpointResult = {
  id: string;
  url: string;
  created: boolean;
  /** The signing secret — only when the endpoint was created now; Stripe never shows it again. */
  secret?: string;
  /** The site's events an existing endpoint lacked: added, or in a dry run only listed. */
  missing: string[];
};

/**
 * The webhook endpoint for `url`: created with the site's events when missing
 * (its signing secret comes back exactly once, now); an existing one gets its
 * event list brought up to date and no secret.
 */
export async function ensureWebhookEndpoint(client: SetupClient, url: string, opts: { dryRun?: boolean } = {}): Promise<EndpointResult> {
  const existing = await client.webhookEndpoints.list({ limit: 100 });
  const found = existing.data.find((e) => e.url === url);
  const events = [...WEBHOOK_EVENTS];
  if (found) {
    const have = new Set(found.enabled_events || []);
    const missing = events.filter((e) => !have.has(e));
    if (missing.length && !opts.dryRun) await client.webhookEndpoints.update(found.id, { enabled_events: [...have, ...missing] as never });
    return { id: found.id, url, created: false, missing };
  }
  if (opts.dryRun) return { id: "(new)", url, created: true, missing: [] };
  const made = await client.webhookEndpoints.create({ url, enabled_events: events as never, description: "Hand Eye Ceramics site" });
  return { id: made.id, url, created: true, secret: made.secret || undefined, missing: [] };
}

/** The line the setup prints for the endpoint. */
export function endpointMessage(ep: EndpointResult, dryRun: boolean): string {
  if (ep.created) return dryRun ? `webhook: would create an endpoint for ${ep.url}` : `webhook: created endpoint ${ep.id} for ${ep.url}`;
  const n = ep.missing.length;
  const events = n ? (dryRun ? `; would add ${n} event${n === 1 ? "" : "s"}` : `; ${n} missing event${n === 1 ? "" : "s"} added`) : "";
  return `webhook: endpoint ${ep.id} for ${ep.url} already exists${events} — Stripe shows its secret only once; roll it in the Dashboard if it was lost`;
}

/**
 * Where `--secret-file` may write: any path outside the working copy, and
 * inside it only a path git ignores — the secret must not land in a tracked
 * file. `ignored` answers for an absolute path (the setup asks `git check-ignore`).
 */
export function secretFileAllowed(file: string, cwd: string, ignored: (absolute: string) => boolean): boolean {
  const root = path.resolve(cwd);
  const absolute = path.resolve(root, file);
  const rel = path.relative(root, absolute);
  const inside = rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
  return !inside || ignored(absolute);
}

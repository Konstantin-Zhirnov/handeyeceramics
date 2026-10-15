/**
 * `npm run stripe:setup` (stories 29–30, 45): which plans become Stripe
 * subscriptions, how an existing product and price are reused instead of
 * duplicated, and which webhook events the endpoint listens to — all against a
 * stand-in Stripe client, no network, no keys.
 */
import path from "node:path";
import { describe, expect, it } from "vitest";
import { WEBHOOK_EVENTS } from "../../lib/payments";
import { endpointMessage, secretFileAllowed, setupFor, subscriptionPlans } from "../../scripts/stripe/plans";

/** The stand-in SDK as the setup takes it: the site's gateway over it looks the Products up. */
const setupOf = (client: unknown) => setupFor("sk_test_stub", client as never);

const plan = (over: Record<string, unknown>) => ({ id: 1, name: "Plan", price: 100, period: "per month", ...over });

describe("subscriptionPlans()", () => {
  it("keeps plans whose period says month and that have a price; the rest stay manual", () => {
    const plans = [
      plan({ id: 1, name: "Tuesday Evening", price: 267.75, period: "Valid for 7 days" }),
      plan({ id: 2, name: "Option 1", price: 230, period: "" }),
      plan({ id: 3, name: "Option 2", price: 175, period: "per month" }),
      plan({ id: 4, name: "Wheel Rental", price: 125, period: "Monthly" }),
      plan({ id: 5, name: "No price", price: null, period: "per month" }),
      plan({ id: 6, name: "Free", price: 0, period: "per month" }),
    ];
    expect(subscriptionPlans(plans as never).map((p) => p.id)).toEqual([3, 4]);
  });
});

/** A stand-in for the SDK: a catalogue of products and prices the test seeds; records what is created. */
function stub(seed: { products?: { id: string; metadata: Record<string, string> }[]; prices?: Record<string, unknown>[] } = {}) {
  const products = [...(seed.products || [])];
  const prices = [...(seed.prices || [])];
  const calls: { products: unknown[]; prices: unknown[]; endpoints: unknown[] } = { products: [], prices: [], endpoints: [] };
  const client = {
    products: {
      search: async ({ query }: { query: string }) => {
        const id = /metadata\['cms_id'\]:'(\d+)'/.exec(query)?.[1];
        const kind = /metadata\['cms_kind'\]:'(\w+)'/.exec(query)?.[1];
        return { data: products.filter((p) => p.metadata.cms_kind === kind && p.metadata.cms_id === id) };
      },
      create: async (params: { name: string; metadata: Record<string, string> }) => {
        calls.products.push(params);
        const p = { id: `prod_${products.length + 1}`, metadata: params.metadata };
        products.push(p);
        return p;
      },
    },
    prices: {
      list: async ({ product }: { product: string }) => ({ data: prices.filter((p) => p.product === product) }),
      create: async (params: Record<string, unknown>) => {
        calls.prices.push(params);
        const p = { id: `price_${prices.length + 1}`, ...params };
        prices.push(p);
        return p;
      },
    },
    webhookEndpoints: { list: async () => ({ data: [] }), create: async (params: unknown) => (calls.endpoints.push(params), { id: "we_1", secret: "whsec_stub" }) },
  };
  return { client, calls };
}

describe("syncPlan()", () => {
  it("creates a product by CMS metadata and a monthly CAD price in cents when the account has neither", async () => {
    const { syncPlan } = await import("../../scripts/stripe/plans");
    const { client, calls } = stub();

    const res = await syncPlan(setupOf(client), plan({ id: 3, name: "Option 2", price: 175, period: "per month", group: "Studio Memberships" }) as never);

    expect(res).toMatchObject({ planId: 3, productId: "prod_1", priceId: "price_1", created: { product: true, price: true } });
    expect(calls.products).toEqual([{ name: "Option 2", metadata: { cms_kind: "plan", cms_id: "3", group: "Studio Memberships" } }]);
    expect(calls.prices).toEqual([
      { product: "prod_1", currency: "cad", unit_amount: 17500, recurring: { interval: "month" }, metadata: { cms_kind: "plan", cms_id: "3" } },
    ]);
  });
});

describe("syncPlan() against an account that already has the plan", () => {
  const seeded = () =>
    stub({
      products: [{ id: "prod_old", metadata: { cms_kind: "plan", cms_id: "3" } }],
      prices: [
        { id: "price_yearly", product: "prod_old", active: true, currency: "cad", unit_amount: 17500, recurring: { interval: "year", interval_count: 1 } },
        { id: "price_retired", product: "prod_old", active: false, currency: "cad", unit_amount: 17500, recurring: { interval: "month", interval_count: 1 } },
        { id: "price_usd", product: "prod_old", active: true, currency: "usd", unit_amount: 17500, recurring: { interval: "month", interval_count: 1 } },
        { id: "price_monthly", product: "prod_old", active: true, currency: "cad", unit_amount: 17500, recurring: { interval: "month", interval_count: 1 } },
      ],
    });

  it("reuses the product and the active monthly CAD price of the same amount — a second run creates nothing", async () => {
    const { syncPlan } = await import("../../scripts/stripe/plans");
    const { client, calls } = seeded();
    const res = await syncPlan(setupOf(client), plan({ id: 3, price: 175 }) as never);
    expect(res).toMatchObject({ productId: "prod_old", priceId: "price_monthly", created: { product: false, price: false } });
    expect(calls.products).toEqual([]);
    expect(calls.prices).toEqual([]);
  });

  it("a changed amount keeps the product and adds a new monthly price; the old one is left for current subscribers", async () => {
    const { syncPlan } = await import("../../scripts/stripe/plans");
    const { client, calls } = seeded();
    const res = await syncPlan(setupOf(client), plan({ id: 3, price: 189.5 }) as never);
    expect(res).toMatchObject({ productId: "prod_old", priceId: "price_5", unitAmount: 18950, created: { product: false, price: true } });
    expect(calls.products).toEqual([]);
    expect(calls.prices).toHaveLength(1);
  });

  it("--dry-run reports what would be created and calls no create", async () => {
    const { syncPlan } = await import("../../scripts/stripe/plans");
    const { client, calls } = stub();
    const res = await syncPlan(setupOf(client), plan({ id: 9, price: 80 }) as never, { dryRun: true });
    expect(res).toMatchObject({ productId: "(new)", priceId: "(new)", unitAmount: 8000, created: { product: true, price: true } });
    expect(calls.products).toEqual([]);
    expect(calls.prices).toEqual([]);
  });
});

describe("ensureWebhookEndpoint()", () => {
  it("creates the endpoint with the seven events the webhook route handles and hands the secret back once", async () => {
    const { ensureWebhookEndpoint } = await import("../../scripts/stripe/plans");
    const { client, calls } = stub();
    const res = await ensureWebhookEndpoint(client as never, "https://example.test/stripe/webhook");
    expect(res).toMatchObject({ id: "we_1", created: true, secret: "whsec_stub", missing: [] });
    expect(calls.endpoints).toHaveLength(1);
    const events = (calls.endpoints[0] as { enabled_events: string[] }).enabled_events;
    expect([...events].sort()).toEqual([
      "charge.refunded",
      "checkout.session.completed",
      "checkout.session.expired",
      "customer.subscription.created",
      "customer.subscription.deleted",
      "customer.subscription.updated",
      "invoice.payment_failed",
    ]);
    expect([...events].sort()).toEqual([...WEBHOOK_EVENTS].sort());
  });

  it("--dry-run on an endpoint that exists lists the events it lacks and sends no update", async () => {
    const { ensureWebhookEndpoint } = await import("../../scripts/stripe/plans");
    const { client } = stub();
    const updates: unknown[] = [];
    client.webhookEndpoints.list = async () => ({ data: [{ id: "we_old", url: "https://example.test/stripe/webhook", enabled_events: ["checkout.session.completed", "charge.refunded"] }] as never[] });
    (client.webhookEndpoints as unknown as { update: unknown }).update = async (id: string, params: unknown) => (updates.push([id, params]), {});
    const res = await ensureWebhookEndpoint(client as never, "https://example.test/stripe/webhook", { dryRun: true });
    expect(res).toMatchObject({ id: "we_old", created: false });
    expect(res.missing).toHaveLength(5);
    expect(updates).toEqual([]);
    expect(endpointMessage(res, true)).toContain("would add 5 events");
    expect(endpointMessage(res, false)).not.toContain("would add");
  });

  it("an endpoint that already exists for the url is reused: no create, no secret, missing events added", async () => {
    const { ensureWebhookEndpoint } = await import("../../scripts/stripe/plans");
    const { client, calls } = stub();
    const updates: unknown[] = [];
    client.webhookEndpoints.list = async () => ({ data: [{ id: "we_old", url: "https://example.test/stripe/webhook", enabled_events: ["checkout.session.completed"] }] as never[] });
    (client.webhookEndpoints as unknown as { update: unknown }).update = async (id: string, params: unknown) => (updates.push([id, params]), {});
    const res = await ensureWebhookEndpoint(client as never, "https://example.test/stripe/webhook");
    expect(res).toMatchObject({ id: "we_old", created: false });
    expect(res.missing).toHaveLength(6);
    expect(res.secret).toBeUndefined();
    expect(calls.endpoints).toEqual([]);
    expect(updates).toHaveLength(1);
  });
});

describe("secretFileAllowed()", () => {
  const cwd = path.resolve("/work/site");
  const ignored = (abs: string) => abs.endsWith(".secret");

  it("takes any path outside the working copy", () => {
    expect(secretFileAllowed(path.resolve("/work/keys/webhook.txt"), cwd, ignored)).toBe(true);
    expect(secretFileAllowed("../webhook.txt", cwd, ignored)).toBe(true);
  });

  it("inside the working copy, only a path git ignores", () => {
    expect(secretFileAllowed("webhook.secret", cwd, ignored)).toBe(true);
    expect(secretFileAllowed(path.join(cwd, "tmp", "webhook.secret"), cwd, ignored)).toBe(true);
    expect(secretFileAllowed("webhook.txt", cwd, ignored)).toBe(false);
    expect(secretFileAllowed("./scripts/webhook.txt", cwd, ignored)).toBe(false);
  });
});

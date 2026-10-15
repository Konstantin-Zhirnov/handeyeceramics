/**
 * The payment gateway (R04, R04.2, R05, R14): which implementation the
 * environment picks; the fake gateway's sessions, completion and expiry; the
 * webhook signature checked the way Stripe signs it (the SDK's own test header
 * is the reference); the Stripe implementation's Checkout parameters, seen
 * through a stand-in client; the dashboard links by key prefix.
 */
import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CheckoutInput } from "../../lib/payments/types";

const ORIGIN = "https://example.test";
const SECRET = "whsec_unit_test_secret";
const env = { ...process.env };

beforeEach(() => {
  delete process.env.PAYMENT_GATEWAY;
  delete process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
});
afterEach(() => {
  process.env = { ...env };
});

const input = (over: Partial<CheckoutInput> = {}): CheckoutInput => ({
  orderId: 42,
  orderNumber: "HE-000042",
  origin: ORIGIN,
  collectAttendee: true,
  expiresAt: new Date("2026-10-14T12:30:00Z"),
  lines: [
    {
      name: "Wheel Throwing — Thurs Nov 5",
      productRef: { kind: "session", id: 7, name: "Wheel Throwing — Thurs Nov 5" },
      unitAmount: 38000,
      quantity: 2,
      taxLines: [{ code: "GST", province: "BC", percentage: 5 }],
    },
    {
      name: "Clay 10kg",
      productRef: { kind: "product", id: 3, name: "Clay 10kg", path: "/product-page/clay" },
      unitAmount: 2500,
      quantity: 1,
      taxLines: [
        { code: "GST", province: "BC", percentage: 5 },
        { code: "PST", province: "BC", percentage: 7 },
      ],
    },
  ],
  ...over,
});

describe("gateway()", () => {
  it("PAYMENT_GATEWAY=fake picks the fake gateway even with a key", async () => {
    process.env.PAYMENT_GATEWAY = "fake";
    process.env.STRIPE_SECRET_KEY = "sk_test_whatever";
    const { gateway } = await import("../../lib/payments");
    expect(gateway()?.name).toBe("fake");
  });
  it("a key picks Stripe", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_whatever";
    const { gateway } = await import("../../lib/payments");
    expect(gateway()?.name).toBe("stripe");
  });
  it("no key and no fake: null", async () => {
    const { gateway } = await import("../../lib/payments");
    expect(gateway()).toBeNull();
  });
  it("in production the fake gateway is refused: Stripe with a key, null without, and a warning either way", async () => {
    process.env.SITE_ENV = "production";
    process.env.PAYMENT_GATEWAY = "fake";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { gateway } = await import("../../lib/payments");
    try {
      expect(gateway()).toBeNull();
      process.env.STRIPE_SECRET_KEY = "sk_test_whatever";
      expect(gateway()?.name).toBe("stripe");
      expect(warn).toHaveBeenCalled();
      expect(String(warn.mock.calls[0][0])).toMatch(/PAYMENT_GATEWAY=fake/);
    } finally {
      warn.mockRestore();
    }
  });
});

describe("fake gateway", () => {
  it("creates a session the fake page can open, then completes it", async () => {
    const { fakeGateway } = await import("../../lib/payments");
    const fake = fakeGateway();
    const { id, url } = await fake.createCheckout(input());
    expect(id).toMatch(/^cs_fake_/);
    expect(url).toBe(`${ORIGIN}/checkout/fake?cs=${id}`);
    expect(await fake.retrieveSession(id)).toMatchObject({ id, mode: "payment", status: "open", paymentStatus: "unpaid", metadata: { orderId: "42" } });

    fake.complete(id, { name: "Ada Buyer", email: "ada@example.com", phone: "604-000-0000", attendee: "Ada's friend" });

    const session = await fake.retrieveSession(id);
    expect(session).toMatchObject({
      status: "complete",
      paymentStatus: "paid",
      customer: { name: "Ada Buyer", email: "ada@example.com", phone: "604-000-0000" },
      customFields: { attendee: "Ada's friend" },
    });
    expect(session?.paymentIntentId).toMatch(/^pi_fake_/);
    expect(session?.customerId).toMatch(/^cus_fake_/);
  });

  it("expires a session; an unknown id is null", async () => {
    const { fakeGateway } = await import("../../lib/payments");
    const fake = fakeGateway();
    const { id } = await fake.createCheckout(input());
    fake.expire(id);
    expect((await fake.retrieveSession(id))?.status).toBe("expired");
    expect(await fake.retrieveSession("cs_fake_nobody")).toBeNull();
  });

  it("a subscription session carries the plan", async () => {
    const { fakeGateway } = await import("../../lib/payments");
    const fake = fakeGateway();
    const { id, url } = await fake.createSubscriptionCheckout({ planId: 5, priceId: "price_x", origin: ORIGIN });
    expect(url).toBe(`${ORIGIN}/checkout/fake?cs=${id}`);
    fake.complete(id, { name: "Ada", email: "ada@example.com" });
    const session = await fake.retrieveSession(id);
    expect(session).toMatchObject({ mode: "subscription", paymentStatus: "paid", metadata: { planId: "5" } });
    expect(session?.subscriptionId).toMatch(/^sub_fake_/);
  });

  it("constructEvent accepts the signature Stripe's SDK generates and rejects a wrong one", async () => {
    const { fakeGateway } = await import("../../lib/payments");
    const fake = fakeGateway();
    const payload = JSON.stringify({ id: "evt_1", type: "checkout.session.completed", data: { object: { id: "cs_fake_1" } } });
    const stripe = new Stripe("sk_test_unused");
    const good = stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
    const bad = stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_other" });

    expect(fake.constructEvent(payload, good)).toEqual({ id: "evt_1", type: "checkout.session.completed", data: { object: { id: "cs_fake_1" } } });
    expect(() => fake.constructEvent(payload, bad)).toThrow();
    expect(() => fake.constructEvent(payload, "nonsense")).toThrow();
  });

  it("constructEvent also accepts the literal signature \"fake\", with or without a webhook secret", async () => {
    const { fakeGateway } = await import("../../lib/payments");
    const fake = fakeGateway();
    const payload = JSON.stringify({ id: "evt_2", type: "checkout.session.expired", data: { object: { id: "cs_fake_2" } } });

    expect(fake.constructEvent(payload, "fake").id).toBe("evt_2");
    delete process.env.STRIPE_WEBHOOK_SECRET;
    expect(fake.constructEvent(payload, "fake").id).toBe("evt_2");
    expect(() => fake.constructEvent("not json", "fake")).toThrow();
  });
});

describe("Stripe gateway", () => {
  /** A stand-in for the SDK: records what Checkout is asked for, finds nothing and creates ids. */
  function stub() {
    const calls: Record<string, unknown[]> = { sessions: [], taxRates: [], products: [] };
    let products = 0;
    let rates = 0;
    const client = {
      checkout: { sessions: { create: async (params: unknown) => (calls.sessions.push(params), { id: "cs_test_1", url: "https://checkout.stripe.com/c/pay/cs_test_1" }), retrieve: async () => ({}) } },
      taxRates: { list: async () => ({ data: [] }), create: async (params: unknown) => (calls.taxRates.push(params), { id: `txr_${++rates}` }) },
      products: { search: async (_params: { query: string }) => ({ data: [] }), create: async (params: unknown) => (calls.products.push(params), { id: `prod_${++products}` }) },
      webhooks: new Stripe("sk_test_unused").webhooks,
    };
    return { client, calls };
  }

  it("builds a payment Checkout with price_data, tax rates, 30-minute expiry and the attendee field", async () => {
    const { stripeGateway } = await import("../../lib/payments");
    const { client, calls } = stub();
    const gw = stripeGateway("sk_test_x", client as never);

    const res = await gw.createCheckout(input());

    expect(res).toEqual({ id: "cs_test_1", url: "https://checkout.stripe.com/c/pay/cs_test_1" });
    expect(calls.products).toEqual([
      { name: "Wheel Throwing — Thurs Nov 5", metadata: { cms_kind: "session", cms_id: "7" } },
      { name: "Clay 10kg", metadata: { cms_kind: "product", cms_id: "3", path: "/product-page/clay" } },
    ]);
    // GST BC is created once for both lines; PST once.
    expect(calls.taxRates).toEqual([
      { display_name: "GST", jurisdiction: "BC", percentage: 5, inclusive: false, country: "CA", metadata: { code: "GST", province: "BC" } },
      { display_name: "PST", jurisdiction: "BC", percentage: 7, inclusive: false, country: "CA", metadata: { code: "PST", province: "BC" } },
    ]);
    const params = calls.sessions[0] as Record<string, unknown>;
    expect(params).toMatchObject({
      mode: "payment",
      expires_at: Math.floor(new Date("2026-10-14T12:30:00Z").getTime() / 1000),
      billing_address_collection: "auto",
      phone_number_collection: { enabled: true },
      metadata: { orderId: "42", orderNumber: "HE-000042" },
      success_url: `${ORIGIN}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${ORIGIN}/cart`,
    });
    expect(params).not.toHaveProperty("shipping_address_collection");
    expect(params.custom_fields).toEqual([{ key: "attendee", label: { type: "custom", custom: "Who is attending" }, type: "text", optional: true }]);
    expect(params.line_items).toEqual([
      { price_data: { currency: "cad", unit_amount: 38000, product: "prod_1" }, quantity: 2, tax_rates: ["txr_1"] },
      { price_data: { currency: "cad", unit_amount: 2500, product: "prod_2" }, quantity: 1, tax_rates: ["txr_1", "txr_2"] },
    ]);
  });

  it("no seats in the order: no attendee field; a subscription Checkout uses the plan's price", async () => {
    const { stripeGateway } = await import("../../lib/payments");
    const { client, calls } = stub();
    const gw = stripeGateway("sk_test_x", client as never);

    await gw.createCheckout(input({ collectAttendee: false, customerEmail: "ada@example.com" }));
    await gw.createSubscriptionCheckout({ planId: 5, priceId: "price_abc", origin: ORIGIN });

    expect(calls.sessions[0]).not.toHaveProperty("custom_fields");
    expect(calls.sessions[0]).toMatchObject({ customer_email: "ada@example.com" });
    expect(calls.sessions[1]).toMatchObject({
      mode: "subscription",
      line_items: [{ price: "price_abc", quantity: 1 }],
      metadata: { planId: "5" },
      subscription_data: { metadata: { planId: "5" } },
      success_url: `${ORIGIN}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${ORIGIN}/cart`,
    });
    expect(calls.sessions[1]).not.toHaveProperty("expires_at");
  });

  it("finds an existing Stripe Product by its CMS metadata instead of creating one, and remembers it", async () => {
    const { stripeGateway } = await import("../../lib/payments");
    const { client, calls } = stub();
    const queries: string[] = [];
    client.products.search = async (params: { query: string }) => (queries.push(params.query), { data: [{ id: "prod_existing" }] as never[] });
    const gw = stripeGateway("sk_test_x", client as never);

    expect(await gw.ensureProduct({ kind: "product", id: 3, name: "Clay 10kg" })).toBe("prod_existing");
    expect(await gw.ensureProduct({ kind: "product", id: 3, name: "Clay 10kg" })).toBe("prod_existing");

    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain("metadata['cms_kind']:'product'");
    expect(queries[0]).toContain("metadata['cms_id']:'3'");
    expect(calls.products).toHaveLength(0);
  });

  it("finds an existing tax rate by metadata and percentage instead of creating one", async () => {
    const { stripeGateway } = await import("../../lib/payments");
    const { client, calls } = stub();
    client.taxRates.list = async () => ({
      data: [
        { id: "txr_old", active: true, inclusive: false, percentage: 7, metadata: { code: "PST", province: "BC" } },
        { id: "txr_inclusive", active: true, inclusive: true, percentage: 5, metadata: { code: "GST", province: "BC" } },
      ] as never[],
    });
    const gw = stripeGateway("sk_test_x", client as never);

    expect(await gw.ensureTaxRate({ code: "PST", province: "BC", percentage: 7 })).toBe("txr_old");
    expect(await gw.ensureTaxRate({ code: "GST", province: "BC", percentage: 5 })).toMatch(/^txr_\d+$/);
    expect(await gw.ensureTaxRate({ code: "GST", province: "BC", percentage: 5 })).toMatch(/^txr_\d+$/);
    expect(calls.taxRates).toHaveLength(1);
  });
});

describe("stripeDashboardUrl", () => {
  it("test keys link to /test/, live keys do not", async () => {
    const { stripeDashboardUrl } = await import("../../lib/payments");
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    expect(stripeDashboardUrl("payment", "pi_1")).toBe("https://dashboard.stripe.com/test/payments/pi_1");
    expect(stripeDashboardUrl("subscription", "sub_1")).toBe("https://dashboard.stripe.com/test/subscriptions/sub_1");
    expect(stripeDashboardUrl("customer", "cus_1")).toBe("https://dashboard.stripe.com/test/customers/cus_1");
    process.env.STRIPE_SECRET_KEY = "sk_live_x";
    expect(stripeDashboardUrl("payment", "pi_1")).toBe("https://dashboard.stripe.com/payments/pi_1");
  });
});

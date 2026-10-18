/**
 * The fake gateway: Checkout sessions in the memory of the process, for tests
 * and for development without keys (PAYMENT_GATEWAY=fake). The site sends the
 * buyer to /checkout/fake?cs=<id>, where the test "pays" (`complete`) or walks
 * away (`expire`). Webhook signatures are checked the way Stripe checks them —
 * HMAC-SHA256 of "<timestamp>.<body>" with STRIPE_WEBHOOK_SECRET — so a test
 * signs its events with the SDK's `generateTestHeaderString`.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { CheckoutInput, GatewayEvent, GatewaySession, InvoiceCheckoutInput, PaymentGateway, SubscriptionInput } from "./types";

export type FakeCompletion = { name?: string; email?: string; phone?: string; attendee?: string };

export type FakeGateway = PaymentGateway & {
  name: "fake";
  /** The buyer paid: the session is complete and paid, with the details they typed in. */
  complete(id: string, customer: FakeCompletion): GatewaySession;
  /** The buyer walked away and the session's 30 minutes ran out. */
  expire(id: string): GatewaySession;
  /** Where the buyer goes after paying or walking away, when the session was opened with its own (an invoice); undefined — the order's pages. */
  returnUrls(id: string): { success: string; cancel: string } | undefined;
  /** Drops every session: a fresh start between tests. */
  reset(): void;
};

// On the process object, not in this module: Next compiles pages (the React
// server layer) and route handlers into separate module graphs, each with its
// own copy of this module, and the success page must find the session the
// checkout route created.
const registry = globalThis as typeof globalThis & { __handeyeFakeSessions?: Map<string, GatewaySession> };
const sessions = (registry.__handeyeFakeSessions ??= new Map<string, GatewaySession>());
const returns = ((registry as typeof registry & { __handeyeFakeReturns?: Map<string, { success: string; cancel: string }> }).__handeyeFakeReturns ??= new Map());
const randomId = (prefix: string) => `${prefix}_${randomBytes(12).toString("hex")}`;

function must(id: string): GatewaySession {
  const s = sessions.get(id);
  if (!s) throw new Error(`fake gateway: no session ${id}`);
  return s;
}

/** Stripe's header: "t=<timestamp>,v1=<hex>[,v1=<hex>]"; the body signed is "<timestamp>.<rawBody>". */
function verify(rawBody: string, signature: string, secret: string): boolean {
  const parts = signature.split(",").map((p) => p.trim().split("="));
  const t = parts.find(([k]) => k === "t")?.[1];
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v || "");
  if (!t || !sigs.length) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`, "utf8").digest("hex");
  return sigs.some((sig) => sig.length === expected.length && timingSafeEqual(Buffer.from(sig, "utf8"), Buffer.from(expected, "utf8")));
}

const gateway: FakeGateway = {
  name: "fake",

  async createCheckout(input: CheckoutInput) {
    const id = randomId("cs_fake");
    sessions.set(id, {
      id,
      mode: "payment",
      paymentStatus: "unpaid",
      status: "open",
      customer: { email: input.customerEmail },
      customFields: {},
      metadata: { orderId: String(input.orderId), orderNumber: input.orderNumber },
    });
    return { id, url: `${input.origin}/checkout/fake?cs=${id}` };
  },

  async createSubscriptionCheckout(input: SubscriptionInput) {
    const id = randomId("cs_fake");
    sessions.set(id, {
      id,
      mode: "subscription",
      paymentStatus: "unpaid",
      status: "open",
      customer: {},
      customFields: {},
      metadata: { planId: String(input.planId), priceId: input.priceId },
    });
    return { id, url: `${input.origin}/checkout/fake?cs=${id}` };
  },

  async createInvoiceCheckout(input: InvoiceCheckoutInput) {
    const id = randomId("cs_fake");
    sessions.set(id, {
      id,
      mode: "payment",
      paymentStatus: "unpaid",
      status: "open",
      amountTotal: input.amount,
      customer: { email: input.customerEmail },
      customFields: {},
      metadata: { invoiceId: String(input.invoiceId), invoiceNumber: input.invoiceNumber },
    });
    const back = `${input.origin}/invoice/${encodeURIComponent(input.token)}`;
    returns.set(id, { success: `${back}?session_id=${id}`, cancel: back });
    return { id, url: `${input.origin}/checkout/fake?cs=${id}` };
  },

  async retrieveSession(id: string) {
    const s = sessions.get(id);
    return s ? structuredClone(s) : null;
  },

  constructEvent(rawBody: string, signature: string): GatewayEvent {
    const secret = process.env.STRIPE_WEBHOOK_SECRET || "";
    // The literal "fake" always passes (this gateway exists for tests); a Stripe-style header is checked against the secret, when there is one.
    const ok = signature === "fake" || (!!secret && verify(rawBody, signature, secret));
    if (!ok) throw new Error("fake gateway: bad webhook signature");
    const event = JSON.parse(rawBody) as GatewayEvent;
    if (!event || typeof event.id !== "string" || typeof event.type !== "string") throw new Error("fake gateway: not an event");
    return event;
  },

  async ensureTaxRate(line) {
    return `txr_fake_${line.code}_${line.province}_${line.percentage}`;
  },

  async findProduct(ref) {
    return `prod_fake_${ref.kind}_${ref.id}`;
  },

  async ensureProduct(ref) {
    return `prod_fake_${ref.kind}_${ref.id}`;
  },

  complete(id, customer) {
    const s = must(id);
    if (s.status === "expired") throw new Error(`fake gateway: session ${id} has expired`);
    s.status = "complete";
    s.paymentStatus = "paid";
    s.customer = { name: customer.name, email: customer.email ?? s.customer.email, phone: customer.phone };
    s.customerId = s.customerId || randomId("cus_fake");
    if (customer.attendee) s.customFields = { ...s.customFields, attendee: customer.attendee };
    if (s.mode === "payment") s.paymentIntentId = s.paymentIntentId || randomId("pi_fake");
    else s.subscriptionId = s.subscriptionId || randomId("sub_fake");
    return structuredClone(s);
  },

  expire(id) {
    const s = must(id);
    if (s.status === "open") s.status = "expired";
    return structuredClone(s);
  },

  returnUrls(id) {
    return returns.get(id);
  },

  reset() {
    sessions.clear();
    returns.clear();
  },
};

export function fakeGateway(): FakeGateway {
  return gateway;
}

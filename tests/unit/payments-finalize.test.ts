/**
 * An order through the fake gateway (R04, R07, R17i.1, R22i, R11.1): Checkout
 * created for a pending order, the order finished exactly once however many
 * times the success page and the webhook ask, the seats back when the session
 * expires, refunds and subscription events from the webhook, a repeated event
 * changing nothing. Runs on a throw-away SQLite database.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Order } from "../../payload-types";
import { seedClassDate, tempCMS, type TempCMS } from "./payments-harness";

let cms: TempCMS;
const ORIGIN = "http://localhost:3311";
const TTL = 30 * 60 * 1000;

beforeAll(async () => {
  cms = await tempCMS();
}, 180_000);

afterAll(async () => {
  await cms?.stop();
});

async function pendingOrder(suffix: string, qty = 2): Promise<{ order: Order; sessionId: number; productId: number }> {
  const { sessionId, productId, studioId } = await seedClassDate(cms.payload, 5, suffix);
  const order = (await cms.payload.create({
    collection: "orders",
    data: {
      status: "pending",
      customer: { email: "ada@example.com" },
      pickupStudio: studioId,
      lines: [{ kind: "session", session: sessionId, product: productId, label: "Test date", quantity: qty, unitAmount: 10000, taxGroup: "service", taxAmount: 500 * qty, lineTotal: 10500 * qty }],
      subtotal: 10000 * qty,
      tax: 500 * qty,
      total: 10500 * qty,
    },
    overrideAccess: true,
    depth: 0,
  })) as Order;
  const { holdSeats } = await import("../../lib/booking/holds");
  expect(await holdSeats([{ sessionId, qty }], String(order.id), TTL)).toEqual({ ok: true });
  return { order, sessionId, productId };
}

const read = async (id: number) => (await cms.payload.findByID({ collection: "orders", id, depth: 0, overrideAccess: true })) as Order;

describe("createCheckoutForOrder", () => {
  it("creates a Checkout session for the order and records it on the order", async () => {
    const { createCheckoutForOrder, fakeGateway } = await import("../../lib/payments");
    const { order } = await pendingOrder("-checkout");

    const { url } = await createCheckoutForOrder(order, ORIGIN);

    const after = await read(order.id);
    expect(after.stripeSessionId).toMatch(/^cs_fake_/);
    expect(after.gateway).toBe("fake");
    expect(url).toBe(`${ORIGIN}/checkout/fake?cs=${after.stripeSessionId}`);
    const session = await fakeGateway().retrieveSession(after.stripeSessionId!);
    expect(session).toMatchObject({ mode: "payment", status: "open", metadata: { orderId: String(order.id), orderNumber: after.number } });
  }, 60_000);
});

describe("finalizeOrder", () => {
  it("a paid session: the order is paid once, with the buyer and the students, however often it is asked", async () => {
    const { createCheckoutForOrder, fakeGateway, finalizeOrder } = await import("../../lib/payments");
    const { availability } = await import("../../lib/booking/availability");
    const { order, sessionId } = await pendingOrder("-paid");
    const { id } = await createCheckoutForOrder(order, ORIGIN);
    fakeGateway().complete(id, { name: "Ada Buyer", email: "ada@example.com", phone: "604-000-0000", attendee: "Ada's friend" });

    const first = await finalizeOrder(id);
    const [second, third] = await Promise.all([finalizeOrder(id), finalizeOrder(id)]);

    expect(first?.status).toBe("paid");
    expect(first?.paidAt).toBeTruthy();
    expect(first?.stripePaymentIntentId).toMatch(/^pi_fake_/);
    expect(first?.stripeCustomerId).toMatch(/^cus_fake_/);
    expect(first?.customer).toEqual({ name: "Ada Buyer", email: "ada@example.com", phone: "604-000-0000" });
    expect(first?.attendee).toBe("Ada's friend");
    expect(second?.paidAt).toBe(first?.paidAt);
    expect(third?.paidAt).toBe(first?.paidAt);
    const after = await read(order.id);
    expect(after.events?.filter((e) => e.type === "paid")).toHaveLength(1);
    const regs = await cms.payload.find({ collection: "registrations", where: { order: { equals: order.id } }, depth: 0, overrideAccess: true });
    expect(regs.totalDocs).toBe(2);
    expect(regs.docs.map((r) => r.name)).toEqual(["Ada's friend", "Ada's friend"]);
    expect(await availability(sessionId, cms.payload)).toEqual({ seats: 5, sold: 2, held: 0, left: 3 });
  }, 60_000);

  it("an open, unpaid session leaves the order pending", async () => {
    const { createCheckoutForOrder, finalizeOrder } = await import("../../lib/payments");
    const { order } = await pendingOrder("-open");
    const { id } = await createCheckoutForOrder(order, ORIGIN);
    expect((await finalizeOrder(id))?.status).toBe("pending");
    expect(await finalizeOrder("cs_fake_unknown")).toBeNull();
  }, 60_000);

  it("an expired session: the order expires and the seats come back", async () => {
    const { createCheckoutForOrder, fakeGateway, finalizeOrder } = await import("../../lib/payments");
    const { availability } = await import("../../lib/booking/availability");
    const { order, sessionId } = await pendingOrder("-expired");
    const { id } = await createCheckoutForOrder(order, ORIGIN);
    fakeGateway().expire(id);

    expect((await finalizeOrder(id))?.status).toBe("expired");
    expect(await availability(sessionId, cms.payload)).toEqual({ seats: 5, sold: 0, held: 0, left: 5 });
  }, 60_000);
});

describe("handleWebhookEvent", () => {
  it("checkout.session.expired releases the seats; a repeat of the event changes nothing", async () => {
    const { createCheckoutForOrder, fakeGateway, handleWebhookEvent } = await import("../../lib/payments");
    const { availability } = await import("../../lib/booking/availability");
    const { order, sessionId } = await pendingOrder("-wh-expired");
    const { id } = await createCheckoutForOrder(order, ORIGIN);
    fakeGateway().expire(id);
    const event = { id: "evt_expired_1", type: "checkout.session.expired", data: { object: { id, object: "checkout.session" } } };

    expect(await handleWebhookEvent(event)).toEqual({ handled: true });
    expect(await handleWebhookEvent(event)).toEqual({ handled: true });

    const after = await read(order.id);
    expect(after.status).toBe("expired");
    expect(after.events?.filter((e) => e.type === "expired")).toHaveLength(1);
    expect(await availability(sessionId, cms.payload)).toEqual({ seats: 5, sold: 0, held: 0, left: 5 });
  }, 60_000);

  it("checkout.session.completed finishes the order", async () => {
    const { createCheckoutForOrder, fakeGateway, handleWebhookEvent } = await import("../../lib/payments");
    const { order } = await pendingOrder("-wh-paid");
    const { id } = await createCheckoutForOrder(order, ORIGIN);
    fakeGateway().complete(id, { name: "Ada", email: "ada@example.com" });

    expect(await handleWebhookEvent({ id: "evt_completed_1", type: "checkout.session.completed", data: { object: { id, mode: "payment" } } })).toEqual({ handled: true });

    expect((await read(order.id)).status).toBe("paid");
  }, 60_000);

  it("charge.refunded: a partial refund marks the order, a full one refunds the students and frees the seats", async () => {
    const { createCheckoutForOrder, fakeGateway, finalizeOrder, handleWebhookEvent } = await import("../../lib/payments");
    const { availability } = await import("../../lib/booking/availability");
    const { order, sessionId } = await pendingOrder("-refund");
    const { id } = await createCheckoutForOrder(order, ORIGIN);
    fakeGateway().complete(id, { name: "Ada", email: "ada@example.com" });
    const paid = await finalizeOrder(id);
    const pi = paid!.stripePaymentIntentId!;
    const refund = (eventId: string, amount: number) => ({
      id: eventId,
      type: "charge.refunded",
      data: { object: { id: "ch_fake_1", object: "charge", payment_intent: pi, amount: 21000, amount_refunded: amount, refunded: amount === 21000 } },
    });

    expect(await handleWebhookEvent(refund("evt_refund_1", 10500))).toEqual({ handled: true });
    let after = await read(order.id);
    expect(after.status).toBe("partially_refunded");
    expect(after.refundedAmount).toBe(10500);
    expect(await availability(sessionId, cms.payload)).toMatchObject({ sold: 2 });

    expect(await handleWebhookEvent(refund("evt_refund_2", 21000))).toEqual({ handled: true });
    expect(await handleWebhookEvent(refund("evt_refund_2", 21000))).toEqual({ handled: true });
    after = await read(order.id);
    expect(after.status).toBe("refunded");
    expect(after.refundedAmount).toBe(21000);
    expect(after.events?.filter((e) => e.type === "refunded")).toHaveLength(1);
    const regs = await cms.payload.find({ collection: "registrations", where: { order: { equals: order.id } }, depth: 0, overrideAccess: true });
    expect(regs.docs.map((r) => r.status)).toEqual(["refunded", "refunded"]);
    expect(await availability(sessionId, cms.payload)).toEqual({ seats: 5, sold: 0, held: 0, left: 5 });
  }, 60_000);

  it("subscription events keep the subscriptions collection up to date", async () => {
    const { createSubscriptionCheckout, fakeGateway, handleWebhookEvent } = await import("../../lib/payments");
    const plan = await cms.payload.create({ collection: "plans", data: { name: "Test membership", price: 150, stripePriceId: "price_test_1" }, overrideAccess: true, depth: 0 });
    const { id } = await createSubscriptionCheckout(plan, ORIGIN);
    const session = fakeGateway().complete(id, { name: "Ada", email: "ada@example.com" });
    const subId = session.subscriptionId!;

    expect(
      await handleWebhookEvent({
        id: "evt_sub_1",
        type: "checkout.session.completed",
        data: { object: { id, mode: "subscription", subscription: subId, customer: session.customerId, customer_details: { name: "Ada", email: "ada@example.com" }, metadata: { planId: String(plan.id) } } },
      }),
    ).toEqual({ handled: true });
    let subs = await cms.payload.find({ collection: "subscriptions", where: { stripeSubscriptionId: { equals: subId } }, depth: 0, overrideAccess: true });
    expect(subs.totalDocs).toBe(1);
    expect(subs.docs[0]).toMatchObject({ plan: plan.id, status: "active", customer: { name: "Ada", email: "ada@example.com" }, stripeCustomerId: session.customerId });

    const periodEnd = 1_800_000_000;
    expect(
      await handleWebhookEvent({
        id: "evt_sub_2",
        type: "customer.subscription.updated",
        data: { object: { id: subId, object: "subscription", status: "past_due", customer: session.customerId, current_period_end: periodEnd, metadata: { planId: String(plan.id) } } },
      }),
    ).toEqual({ handled: true });
    subs = await cms.payload.find({ collection: "subscriptions", where: { stripeSubscriptionId: { equals: subId } }, depth: 0, overrideAccess: true });
    expect(subs.totalDocs).toBe(1);
    expect(subs.docs[0].status).toBe("past_due");
    expect(subs.docs[0].currentPeriodEnd).toBe(new Date(periodEnd * 1000).toISOString());

    expect(await handleWebhookEvent({ id: "evt_sub_3", type: "customer.subscription.deleted", data: { object: { id: subId, object: "subscription", status: "canceled" } } })).toEqual({ handled: true });
    subs = await cms.payload.find({ collection: "subscriptions", where: { stripeSubscriptionId: { equals: subId } }, depth: 0, overrideAccess: true });
    expect(subs.docs[0].status).toBe("canceled");

    expect(await handleWebhookEvent({ id: "evt_sub_4", type: "invoice.payment_failed", data: { object: { id: "in_1", object: "invoice", subscription: subId } } })).toEqual({ handled: true });
    subs = await cms.payload.find({ collection: "subscriptions", where: { stripeSubscriptionId: { equals: subId } }, depth: 0, overrideAccess: true });
    expect(subs.docs[0].status).toBe("past_due");
  }, 60_000);

  it("an unknown event type is not handled", async () => {
    const { handleWebhookEvent } = await import("../../lib/payments");
    expect(await handleWebhookEvent({ id: "evt_other", type: "payment_method.attached", data: { object: {} } })).toEqual({ handled: false });
  });
});

/**
 * Seat holds (R17i): two buyers cannot take the last seat together; a hold that
 * has run out no longer counts; confirming an order turns holds into students
 * exactly once. Runs on a throw-away SQLite database through the Local API.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedClassDate, tempCMS, type TempCMS } from "./payments-harness";

let cms: TempCMS;
const TTL = 30 * 60 * 1000;

beforeAll(async () => {
  cms = await tempCMS();
}, 180_000);

afterAll(async () => {
  await cms?.stop();
});

describe("holdSeats", () => {
  it("two parallel holds on the last seat: exactly one succeeds", async () => {
    const { holdSeats } = await import("../../lib/booking/holds");
    const { availability } = await import("../../lib/booking/availability");
    const { sessionId } = await seedClassDate(cms.payload, 1, "-last");

    const results = await Promise.all([
      holdSeats([{ sessionId, qty: 1 }], "order-a", TTL),
      holdSeats([{ sessionId, qty: 1 }], "order-b", TTL),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const lost = results.find((r) => !r.ok);
    expect(lost).toEqual({ ok: false, short: [{ sessionId, left: 0 }] });
    expect(await availability(sessionId, cms.payload)).toEqual({ seats: 1, sold: 0, held: 1, left: 0 });
  }, 60_000);

  it("a hold that asks for more than is left writes nothing", async () => {
    const { holdSeats } = await import("../../lib/booking/holds");
    const { availability } = await import("../../lib/booking/availability");
    const { sessionId } = await seedClassDate(cms.payload, 2, "-two");

    expect(await holdSeats([{ sessionId, qty: 3 }], "order-c", TTL)).toEqual({ ok: false, short: [{ sessionId, left: 2 }] });
    expect(await availability(sessionId, cms.payload)).toEqual({ seats: 2, sold: 0, held: 0, left: 2 });
  }, 60_000);

  it("an expired hold does not count, and the seat can be held again", async () => {
    const { holdSeats } = await import("../../lib/booking/holds");
    const { availability } = await import("../../lib/booking/availability");
    const { sessionId } = await seedClassDate(cms.payload, 1, "-expired");
    await cms.payload.create({
      collection: "holds",
      data: { session: sessionId, quantity: 1, ref: "order-old", expiresAt: new Date(Date.now() - 60_000).toISOString() },
      overrideAccess: true,
    });

    expect(await availability(sessionId, cms.payload)).toEqual({ seats: 1, sold: 0, held: 0, left: 1 });
    expect(await holdSeats([{ sessionId, qty: 1 }], "order-new", TTL)).toEqual({ ok: true });
  }, 60_000);

  it("releaseHolds frees the seats of one order only", async () => {
    const { holdSeats, releaseHolds } = await import("../../lib/booking/holds");
    const { availability } = await import("../../lib/booking/availability");
    const { sessionId } = await seedClassDate(cms.payload, 3, "-release");
    await holdSeats([{ sessionId, qty: 1 }], "order-d", TTL);
    await holdSeats([{ sessionId, qty: 1 }], "order-e", TTL);

    await releaseHolds("order-d");

    expect(await availability(sessionId, cms.payload)).toEqual({ seats: 3, sold: 0, held: 1, left: 2 });
  }, 60_000);
});

describe("confirmSeats", () => {
  it("turns the order's holds into one student per seat, and does not repeat itself", async () => {
    const { confirmSeats, holdSeats } = await import("../../lib/booking/holds");
    const { availability } = await import("../../lib/booking/availability");
    const { sessionId, productId, studioId } = await seedClassDate(cms.payload, 5, "-confirm");
    const order = await cms.payload.create({
      collection: "orders",
      data: {
        status: "pending",
        customer: { name: "Ada Buyer", email: "ada@example.com", phone: "604-000-0000" },
        attendee: "Ada's friend",
        lines: [{ kind: "session", session: sessionId, product: productId, label: "Test date", quantity: 2, unitAmount: 10000 }],
        subtotal: 20000,
        tax: 1000,
        total: 21000,
      },
      overrideAccess: true,
      depth: 0,
    });
    expect(await holdSeats([{ sessionId, qty: 2 }], String(order.id), TTL)).toEqual({ ok: true });

    await confirmSeats(order.id);
    await confirmSeats(order.id);

    const regs = await cms.payload.find({ collection: "registrations", where: { order: { equals: order.id } }, depth: 0, overrideAccess: true });
    expect(regs.totalDocs).toBe(2);
    expect(regs.docs.map((r) => [r.name, r.email, r.phone, r.session, r.product, r.studio, r.status])).toEqual([
      ["Ada's friend", "ada@example.com", "604-000-0000", sessionId, productId, studioId, "confirmed"],
      ["Ada's friend", "ada@example.com", "604-000-0000", sessionId, productId, studioId, "confirmed"],
    ]);
    expect(await availability(sessionId, cms.payload)).toEqual({ seats: 5, sold: 2, held: 0, left: 3 });
  }, 60_000);
});

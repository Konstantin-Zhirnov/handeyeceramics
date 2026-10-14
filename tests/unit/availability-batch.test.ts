/**
 * The seats of many dates at once (R01.1): the list of dates in the admin
 * counts sold and left for the whole page in a fixed number of queries, and a
 * student added by hand (imported) holds a seat like a paid one. Runs on a
 * throw-away SQLite database through the Local API.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedClassDate, tempCMS, type TempCMS } from "./payments-harness";

let cms: TempCMS;

beforeAll(async () => {
  cms = await tempCMS();
}, 180_000);

afterAll(async () => {
  await cms?.stop();
});

const student = (session: number, status: "confirmed" | "imported" | "refunded") =>
  cms.payload.create({ collection: "registrations", data: { session, name: `${status} student`, status }, depth: 0, overrideAccess: true });

describe("availability", () => {
  it("a student added by hand takes a seat; a refunded one does not", async () => {
    const { availability } = await import("../../lib/booking/availability");
    const { sessionId } = await seedClassDate(cms.payload, 5, "-imported");
    await student(sessionId, "confirmed");
    await student(sessionId, "imported");
    await student(sessionId, "refunded");
    expect(await availability(sessionId, cms.payload)).toEqual({ seats: 5, sold: 2, held: 0, left: 3 });
  }, 60_000);

  it("a student an editor adds without a status is 'imported'", async () => {
    const { sessionId } = await seedClassDate(cms.payload, 5, "-default");
    const created = await cms.payload.create({ collection: "registrations", data: { session: sessionId, name: "No status" } as never, depth: 0, overrideAccess: true });
    expect(created.status).toBe("imported");
  }, 60_000);
});

describe("availabilityOf", () => {
  it("counts every date of the set, dates without students included", async () => {
    const { availabilityOf } = await import("../../lib/booking/availability");
    const a = await seedClassDate(cms.payload, 4, "-batch-a");
    const b = await seedClassDate(cms.payload, 2, "-batch-b");
    await student(a.sessionId, "confirmed");
    await student(a.sessionId, "imported");
    const now = Date.now();
    await cms.payload.create({ collection: "holds", data: { session: b.sessionId, quantity: 1, ref: "batch-live", expiresAt: new Date(now + 3_600_000).toISOString() }, depth: 0, overrideAccess: true });
    await cms.payload.create({ collection: "holds", data: { session: b.sessionId, quantity: 1, ref: "batch-expired", expiresAt: new Date(now - 3_600_000).toISOString() }, depth: 0, overrideAccess: true });

    const counts = await availabilityOf(
      [{ id: a.sessionId, seats: 4 }, { id: b.sessionId, seats: 2 }],
      cms.payload,
    );
    expect(counts.get(a.sessionId)).toEqual({ seats: 4, sold: 2, held: 0, left: 2 });
    expect(counts.get(b.sessionId)).toEqual({ seats: 2, sold: 0, held: 1, left: 1 });
  }, 60_000);

  it("the dates an editor lists carry sold and left; a read that skips the count carries null", async () => {
    const a = await seedClassDate(cms.payload, 3, "-list-a");
    await student(a.sessionId, "confirmed");
    const user = { id: 1, collection: "users", email: "editor@example.com" } as never;
    const listed = await cms.payload.find({ collection: "sessions", where: { id: { equals: a.sessionId } }, depth: 0, overrideAccess: true, user });
    expect(listed.docs[0]).toMatchObject({ sold: 1, left: 2 });
    const one = await cms.payload.findByID({ collection: "sessions", id: a.sessionId, depth: 0, overrideAccess: true, user });
    expect(one).toMatchObject({ sold: 1, left: 2 });
    const skipped = await cms.payload.findByID({ collection: "sessions", id: a.sessionId, depth: 0, overrideAccess: true, context: { skipAvailability: true } });
    expect(skipped.sold ?? null).toBeNull();
  }, 60_000);
});

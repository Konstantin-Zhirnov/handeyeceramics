/**
 * The letters to students (R18i, R19i, R19i.1, R19i.2, R12.1) on a throw-away
 * database: the order confirmation with the dates, the studio and its door
 * code; the reminder two days before and the next-course invitation a day
 * after; "pieces ready" once per date. The mail adapter is replaced by a list,
 * so the tests read what would have been sent. Expected lines are written by
 * hand from the seed's templates and the test data.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Order } from "../../payload-types";
import { EMAIL_TEMPLATES } from "../../scripts/seed/email-templates";
import { seedClassDate, tempCMS, type TempCMS } from "./payments-harness";

type Sent = { to?: unknown; subject?: string | null; text?: string | null };

let cms: TempCMS;
const sent: Sent[] = [];
/** Addresses the mail adapter fails on, as an SMTP server would. */
const failing = new Set<string>();
/** A value that only this test knows: not a real door code. */
const CODE = "unit-test-code";

beforeAll(async () => {
  cms = await tempCMS();
  cms.payload.sendEmail = async (message) => {
    if (failing.has(String(message.to))) throw new Error(`test adapter: ${message.to} rejected`);
    sent.push(message as Sent);
    return undefined;
  };
  for (const t of EMAIL_TEMPLATES) await cms.payload.create({ collection: "email-templates", data: { ...t, enabled: true }, overrideAccess: true, depth: 0 });
}, 180_000);

afterAll(async () => {
  await cms?.stop();
});

const settle = () => new Promise((r) => setTimeout(r, 400));
const newSent = (from: number) => sent.slice(from);

async function paidOrder(studioId: number, lines: Order["lines"], customer = { name: "Ada Buyer", email: "ada@example.com" }): Promise<Order> {
  const order = (await cms.payload.create({
    collection: "orders",
    data: { status: "paid", paidAt: new Date().toISOString(), customer, pickupStudio: studioId, lines, subtotal: 0, tax: 0, total: 0 },
    overrideAccess: true,
    depth: 0,
  })) as Order;
  return (await cms.payload.findByID({ collection: "orders", id: order.id, depth: 0, overrideAccess: true })) as Order;
}

describe("sendOrderConfirmation", () => {
  it("one letter to the buyer: items, class and dates, the studio with its address and door code, the site", async () => {
    const { sendOrderConfirmation } = await import("../../lib/mail");
    const { studioId, productId, sessionId } = await seedClassDate(cms.payload, 5, "-confirm");
    await cms.payload.update({ collection: "studios", id: studioId, data: { doorCode: CODE }, overrideAccess: true, depth: 0 });
    const order = await paidOrder(studioId, [
      { kind: "session", session: sessionId, product: productId, label: "Test date-confirm", quantity: 2, unitAmount: 10000, taxGroup: "service", taxAmount: 1000, lineTotal: 21000 },
      { kind: "product", product: productId, label: "Apron", option: "Blue", quantity: 1, unitAmount: 3550, taxGroup: "goods", taxAmount: 426, lineTotal: 3976 },
    ]);
    const before = sent.length;

    await sendOrderConfirmation(order.id);
    await vi.waitFor(() => expect(newSent(before)).toHaveLength(1), { timeout: 10_000 });

    const [letter] = newSent(before);
    expect(letter.to).toBe("ada@example.com");
    expect(letter.subject).toBe(`Your Hand Eye Ceramics order ${order.number}`);
    expect(order.number).toMatch(/^HE-\d{6}$/);
    const text = letter.text || "";
    expect(text).toContain("Hi Ada Buyer,");
    expect(text).toContain(`Thank you for your order ${order.number}.`);
    expect(text).toContain("Test date-confirm × 2 — CA$200.00");
    expect(text).toContain("Apron (Blue) × 1 — CA$35.50");
    expect(text).toContain("Class: Test class-confirm");
    expect(text).toContain("Dates: Test date-confirm");
    expect(text).toContain("Studio: Test studio-confirm, 1 Test St, Vancouver, BC V6A 1A1");
    expect(text).toContain(`Door code: ${CODE}`);
    expect(text).toContain(cms.payload.config.serverURL);
    expect(text).not.toContain("{{");
  }, 60_000);

  it("an order of goods only: the same letter without a class; a studio without a code says to ask", async () => {
    const { sendOrderConfirmation } = await import("../../lib/mail");
    const { studioId, productId } = await seedClassDate(cms.payload, 5, "-goods");
    const order = await paidOrder(studioId, [{ kind: "product", product: productId, label: "Clay 10 kg", quantity: 3, unitAmount: 2000, taxGroup: "goods", taxAmount: 720, lineTotal: 6720 }]);
    const before = sent.length;

    await sendOrderConfirmation(order.id);
    await vi.waitFor(() => expect(newSent(before)).toHaveLength(1), { timeout: 10_000 });

    const text = newSent(before)[0].text || "";
    expect(text).toContain("Clay 10 kg × 3 — CA$60.00");
    expect(text).not.toContain("Test class");
    expect(text).toContain("Studio: Test studio-goods, 1 Test St, Vancouver, BC V6A 1A1");
    expect(text).toContain("Door code: [door code — ask the studio]");
  }, 60_000);

  it("a disabled template sends nothing", async () => {
    const { sendOrderConfirmation } = await import("../../lib/mail");
    const { studioId, productId } = await seedClassDate(cms.payload, 5, "-off");
    const order = await paidOrder(studioId, [{ kind: "product", product: productId, label: "Sponge", quantity: 1, unitAmount: 500, taxGroup: "goods", taxAmount: 60, lineTotal: 560 }]);
    await cms.payload.update({ collection: "email-templates", where: { key: { equals: "order-confirmation" } }, data: { enabled: false }, overrideAccess: true });
    const before = sent.length;
    try {
      await sendOrderConfirmation(order.id);
      await settle();
      expect(newSent(before)).toHaveLength(0);
    } finally {
      await cms.payload.update({ collection: "email-templates", where: { key: { equals: "order-confirmation" } }, data: { enabled: true }, overrideAccess: true });
    }
  }, 60_000);
});

describe("runDailyMail", () => {
  const HOUR = 3_600_000;
  const DAY = 24 * HOUR;
  const now = new Date("2026-10-14T15:00:00.000Z");
  const at = (ms: number) => new Date(now.getTime() + ms).toISOString();

  async function dateWithStudent(suffix: string, dates: { startsAt?: string; endsAt?: string }, email: string, name: string, status: "confirmed" | "imported" | "refunded" = "confirmed") {
    const { sessionId, productId, studioId } = await seedClassDate(cms.payload, 5, suffix);
    await cms.payload.update({ collection: "sessions", id: sessionId, data: dates, overrideAccess: true, depth: 0, context: { skipAvailability: true } });
    const reg = await cms.payload.create({
      collection: "registrations",
      data: { session: sessionId, product: productId, studio: studioId, name, email, status },
      overrideAccess: true,
      depth: 0,
    });
    return reg.id;
  }

  it("a student the editor added by hand (imported) is reminded like a paid one; a refunded one is not", async () => {
    const { runDailyMail } = await import("../../lib/mail");
    const imported = await dateWithStudent("-imported", { startsAt: at(2 * DAY + HOUR), endsAt: at(44 * DAY) }, "walk-in@example.com", "Walk In", "imported");
    await dateWithStudent("-refunded", { startsAt: at(2 * DAY + HOUR), endsAt: at(44 * DAY) }, "refunded@example.com", "Got Money Back", "refunded");
    const before = sent.length;
    await runDailyMail(now, cms.payload);
    expect(newSent(before).map((m) => m.to)).toContain("walk-in@example.com");
    expect(newSent(before).map((m) => m.to)).not.toContain("refunded@example.com");
    const reg = await cms.payload.findByID({ collection: "registrations", id: imported, depth: 0, overrideAccess: true });
    expect(reg.reminderSentAt).toBeTruthy();
  }, 60_000);

  it("reminds two days before the first class, invites a day after the last one, and never twice", async () => {
    const { runDailyMail } = await import("../../lib/mail");
    const remind = await dateWithStudent("-remind", { startsAt: at(2 * DAY + HOUR), endsAt: at(44 * DAY) }, "remind@example.com", "Rem Inder");
    await dateWithStudent("-soon", { startsAt: at(DAY + HOUR), endsAt: at(43 * DAY) }, "soon@example.com", "Too Soon");
    await dateWithStudent("-far", { startsAt: at(3 * DAY + HOUR), endsAt: at(45 * DAY) }, "far@example.com", "Too Far");
    const done = await dateWithStudent("-done", { startsAt: at(-43 * DAY), endsAt: at(-36 * HOUR) }, "done@example.com", "All Done");
    await dateWithStudent("-old", { startsAt: at(-50 * DAY), endsAt: at(-3 * DAY) }, "old@example.com", "Long Ago");
    const before = sent.length;

    expect(await runDailyMail(now)).toEqual({ reminders: 1, followups: 1 });

    const letters = newSent(before);
    expect(letters.map((l) => l.to).sort()).toEqual(["done@example.com", "remind@example.com"]);
    const reminder = letters.find((l) => l.to === "remind@example.com")!;
    expect(reminder.subject).toBe("Your class Test class-remind starts in two days");
    expect(reminder.text).toContain("Hi Rem Inder,");
    expect(reminder.text).toContain("Test class-remind (Test date-remind) starts in two days at Test studio-remind, 1 Test St, Vancouver, BC V6A 1A1.");
    expect(reminder.text).toContain("The door code is [door code — ask the studio].");
    const invite = letters.find((l) => l.to === "done@example.com")!;
    expect(invite.subject).toBe("Ready for the next step after Test class-done?");
    expect(invite.text).toContain("Hi All Done,");
    expect(invite.text).toContain("We hope you enjoyed Test class-done at Test studio-done.");

    const marked = await cms.payload.findByID({ collection: "registrations", id: remind, depth: 0, overrideAccess: true });
    expect(marked.reminderSentAt).toBeTruthy();
    expect(marked.followupSentAt).toBeFalsy();
    const invited = await cms.payload.findByID({ collection: "registrations", id: done, depth: 0, overrideAccess: true });
    expect(invited.followupSentAt).toBeTruthy();

    expect(await runDailyMail(new Date(now.getTime() + HOUR))).toEqual({ reminders: 0, followups: 0 });
    expect(sent.length).toBe(before + 2);
  }, 90_000);

  it("a student whose letter fails is left for the next run; the others are sent and counted", async () => {
    const { runDailyMail } = await import("../../lib/mail");
    const later = new Date("2026-12-01T15:00:00.000Z");
    const at2 = (ms: number) => new Date(later.getTime() + ms).toISOString();
    const ok = await dateWithStudent("-ok", { startsAt: at2(2 * DAY + HOUR), endsAt: at2(44 * DAY) }, "ok@example.com", "Oh Kay");
    const bad = await dateWithStudent("-bad", { startsAt: at2(2 * DAY + 2 * HOUR), endsAt: at2(44 * DAY) }, "bad@example.com", "Bad Luck");
    failing.add("bad@example.com");
    const before = sent.length;
    try {
      expect(await runDailyMail(later)).toEqual({ reminders: 1, followups: 0 });
      expect(newSent(before).map((l) => l.to)).toEqual(["ok@example.com"]);
      expect((await cms.payload.findByID({ collection: "registrations", id: ok, depth: 0, overrideAccess: true })).reminderSentAt).toBeTruthy();
      expect((await cms.payload.findByID({ collection: "registrations", id: bad, depth: 0, overrideAccess: true })).reminderSentAt).toBeFalsy();
    } finally {
      failing.delete("bad@example.com");
    }
    expect(await runDailyMail(new Date(later.getTime() + HOUR))).toEqual({ reminders: 1, followups: 0 });
    expect(newSent(before).map((l) => l.to)).toEqual(["ok@example.com", "bad@example.com"]);
  }, 90_000);
});

describe("pieces ready", () => {
  it("ticking the box emails every confirmed student once; a failed student gets it on the next tick, the others not twice", async () => {
    const { sendPiecesReady } = await import("../../lib/mail");
    const { sessionId, productId, studioId } = await seedClassDate(cms.payload, 5, "-pieces");
    for (const [name, email, status] of [
      ["Pat Potter", "pat@example.com", "confirmed"],
      ["Sam Slip", "sam@example.com", "confirmed"],
      ["Ref Unded", "ref@example.com", "refunded"],
    ] as const) {
      await cms.payload.create({ collection: "registrations", data: { session: sessionId, product: productId, studio: studioId, name, email, status }, overrideAccess: true, depth: 0 });
    }
    const tick = (piecesReady: boolean) =>
      cms.payload.update({ collection: "sessions", id: sessionId, data: { piecesReady }, overrideAccess: true, depth: 0, context: { skipAvailability: true } });
    const session = () => cms.payload.findByID({ collection: "sessions", id: sessionId, depth: 0, overrideAccess: true, context: { skipAvailability: true } });
    const before = sent.length;

    // First tick: Sam's letter is rejected by the adapter.
    failing.add("sam@example.com");
    await tick(true);
    await vi.waitFor(() => expect(newSent(before)).toHaveLength(1), { timeout: 15_000 });
    await settle();
    const [pat] = newSent(before);
    expect(pat.to).toBe("pat@example.com");
    expect(pat.subject).toBe("Your pieces from Test class-pieces are ready");
    expect(pat.text).toContain(
      "Hi Pat Potter,\n\nThe pieces you made in Test class-pieces (Test date-pieces) are glazed, fired and ready for pickup at Test studio-pieces, 1 Test St, Vancouver, BC V6A 1A1.",
    );
    expect((await session()).piecesReadySentAt).toBeFalsy();

    // The owner unticks and ticks again once the mail works: only Sam is emailed, and the date is marked.
    failing.delete("sam@example.com");
    await tick(false);
    await tick(true);
    await vi.waitFor(() => expect(newSent(before)).toHaveLength(2), { timeout: 15_000 });
    expect(newSent(before)[1].to).toBe("sam@example.com");
    await vi.waitFor(async () => expect((await session()).piecesReadySentAt).toBeTruthy(), { timeout: 15_000 });

    // Another save with the box ticked, or a direct call: nothing more.
    await cms.payload.update({ collection: "sessions", id: sessionId, data: { teacher: "Someone", piecesReady: true }, overrideAccess: true, depth: 0, context: { skipAvailability: true } });
    await sendPiecesReady(sessionId);
    await settle();
    expect(sent.length).toBe(before + 2);
  }, 90_000);
});

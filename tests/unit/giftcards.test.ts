/**
 * Gift cards: the code and the amounts (pure), then on a throw-away database
 * the cart pricing a card the buyer loads, a code paying part of an order and
 * all of it, the balance taken once and given back when the order expires,
 * the cards issued and emailed when a gift card order is paid.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Giftcard, Order } from "../../payload-types";
import { priceLine, type CatalogItem } from "../../lib/cart/pricing";
import { GIFT_CODE, generateGiftCode, giftAmountAllowed, giftAmountChoices, giftApplied, normalizeGiftCode } from "../../lib/giftcards/code";
import { EMAIL_TEMPLATES } from "../../scripts/seed/email-templates";
import { seedClassDate, tempCMS, type TempCMS } from "./payments-harness";

describe("gift card codes", () => {
  it("generates HE-XXXX-XXXX-XXXX from an alphabet without 0/O and 1/I/L", () => {
    const code = generateGiftCode(() => Buffer.from([0, 1, 2, 3, 30, 31, 32, 33, 60, 61, 62, 63]));
    expect(code).toMatch(GIFT_CODE);
    expect(code).toBe("HE-ABCD-9ABC-89AB"); // 31 symbols: 30 → "9", 31 → "A" again
    expect(generateGiftCode()).toMatch(GIFT_CODE);
    expect(generateGiftCode()).not.toMatch(/[01OIL]/);
  });

  it("reads what a buyer types: case, spaces and dashes do not matter; anything else is not a code", () => {
    expect(normalizeGiftCode("he abcd 2345 5678")).toBe("HE-ABCD-2345-5678");
    expect(normalizeGiftCode(" ABCD-2345-5678 ")).toBe("HE-ABCD-2345-5678");
    expect(normalizeGiftCode("HE-ABCD-2345-567")).toBeNull();
    expect(normalizeGiftCode("HE-ABCD-2345-5670")).toBeNull(); // 0 is not in the alphabet
    expect(normalizeGiftCode(42)).toBeNull();
  });

  it("parses the admin's amounts and keeps a buyer within them", () => {
    expect(giftAmountChoices("100\n200\nCA$370\n\nabc")).toEqual([10000, 20000, 37000]);
    const offer = { choices: [10000, 20000], otherMin: 2500, otherMax: 100000 };
    expect(giftAmountAllowed(10000, offer)).toBe(true);
    expect(giftAmountAllowed(2500, offer)).toBe(true);
    expect(giftAmountAllowed(100000, offer)).toBe(true);
    expect(giftAmountAllowed(2499, offer)).toBe(false);
    expect(giftAmountAllowed(100001, offer)).toBe(false);
    expect(giftAmountAllowed(15000, { choices: [10000, 20000] })).toBe(false);
    expect(giftAmountAllowed(100.5, offer)).toBe(false);
  });

  it("pays the whole order or the whole balance, whichever is smaller", () => {
    expect(giftApplied(10500, 20000)).toBe(10500);
    expect(giftApplied(10500, 4000)).toBe(4000);
    expect(giftApplied(0, 4000)).toBe(0);
  });
});

describe("priceLine for a gift card", () => {
  const card: CatalogItem = { kind: "product", id: 9, label: "Pottery Gift Card", unitAmount: 0, taxGroup: "exempt", optionTitles: [], gift: { choices: [10000, 20000], otherMin: 2500, otherMax: 100000 } };

  it("is worth the amount loaded, with no tax, and never 'price updated'", () => {
    const line = priceLine({ kind: "product", id: 9, quantity: 2, amount: 20000, option: "Amount: CA$200.00", seenAmount: 20000 }, card, "BC");
    expect(line.error).toBeUndefined();
    expect(line.unitAmount).toBe(20000);
    expect(line.amount).toBe(20000);
    expect(line.taxAmount).toBe(0);
    expect(line.taxLines).toEqual([]);
    expect(line.priceChanged).toBeUndefined();
  });

  it("wants an amount the offer allows", () => {
    expect(priceLine({ kind: "product", id: 9, quantity: 1 }, card, "BC").error).toBe("Choose an amount");
    expect(priceLine({ kind: "product", id: 9, quantity: 1, amount: 1 }, card, "BC").error).toBe("Choose an amount");
    expect(priceLine({ kind: "product", id: 9, quantity: 1, amount: 5000 }, card, "BC").error).toBeUndefined();
  });
});

describe("gift cards on the database", () => {
  let cms: TempCMS;
  const sent: { to?: unknown; subject?: string | null; text?: string | null }[] = [];
  let giftProductId: number;
  let studioId: number;
  let classProductId: number;
  let sessionId: number;

  beforeAll(async () => {
    cms = await tempCMS();
    cms.payload.sendEmail = async (message) => {
      sent.push(message as (typeof sent)[number]);
      return undefined;
    };
    for (const t of EMAIL_TEMPLATES) await cms.payload.create({ collection: "email-templates", data: { ...t, enabled: true }, overrideAccess: true, depth: 0 });
    const date = await seedClassDate(cms.payload, 5, "-gift");
    studioId = date.studioId;
    classProductId = date.productId;
    sessionId = date.sessionId;
    const gift = await cms.payload.create({
      collection: "products",
      data: { name: "Pottery Gift Card", path: "/gift-card", visible: true, taxGroup: "exempt", giftCard: true, giftAmounts: "100\n200\n370", giftOtherMin: 25, giftOtherMax: 1000 },
      overrideAccess: true,
      depth: 0,
    });
    giftProductId = gift.id;
  }, 180_000);

  afterAll(async () => {
    await cms?.stop();
  });

  const card = async (code: string) => (await cms.payload.find({ collection: "giftcards", where: { code: { equals: code } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as Giftcard;

  it("the cart prices a card by the amount loaded, exempt from tax, and refuses an amount off the list", async () => {
    const { validateCart } = await import("../../lib/cart/validate");
    const ok = await validateCart([{ kind: "product", id: giftProductId, quantity: 1, amount: 37000, option: "Amount: CA$370.00" }], studioId, cms.payload);
    expect(ok.lines[0]).toMatchObject({ unitAmount: 37000, taxAmount: 0, taxGroup: "exempt" });
    expect(ok.total).toBe(37000);
    expect(ok.due).toBe(37000);
    const other = await validateCart([{ kind: "product", id: giftProductId, quantity: 1, amount: 5000 }], studioId, cms.payload);
    expect(other.lines[0].error).toBeUndefined();
    const off = await validateCart([{ kind: "product", id: giftProductId, quantity: 1, amount: 150000 }], studioId, cms.payload);
    expect(off.lines[0].error).toBe("Choose an amount");
  }, 60_000);

  it("a card by hand in the admin gets a code and a balance; a typed code is kept, however it was typed", async () => {
    const made = (await cms.payload.create({ collection: "giftcards", data: { amount: 50 } as unknown as Giftcard, overrideAccess: true, depth: 0 })) as Giftcard;
    expect(made.code).toMatch(GIFT_CODE);
    expect(made.balance).toBe(50);
    expect(made.status).toBe("active");
    const typed = (await cms.payload.create({ collection: "giftcards", data: { code: "he wxyz 2345 6789", amount: 80, balance: 30 } as unknown as Giftcard, overrideAccess: true, depth: 0 })) as Giftcard;
    expect(typed.code).toBe("HE-WXYZ-2345-6789");
    expect(typed.balance).toBe(30);
  }, 60_000);

  it("a code pays part of the total and the balance is taken once, by the checkout, and given back when the order expires", async () => {
    const { validateCart } = await import("../../lib/cart/validate");
    const { reserveGiftBalance, restoreGiftBalance } = await import("../../lib/giftcards");
    const typed = (await cms.payload.create({ collection: "giftcards", data: { code: "HE-PART-2345-6789", amount: 40 } as unknown as Giftcard, overrideAccess: true, depth: 0 })) as Giftcard;
    const seat = [{ kind: "session" as const, id: sessionId, quantity: 1 }];
    const cart = await validateCart(seat, studioId, cms.payload, new Date(), "he part 2345 6789");
    expect(cart.total).toBe(10500);
    expect(cart.giftCard).toEqual({ code: "HE-PART-2345-6789", applied: 4000, balance: 4000 });
    expect(cart.due).toBe(6500);

    // Two checkouts for the same 40 dollars: one wins.
    const pending = async () =>
      (await cms.payload.create({
        collection: "orders",
        data: { status: "pending", pickupStudio: studioId, lines: [{ kind: "session", session: sessionId, label: "Test date", quantity: 1, unitAmount: 10000, taxGroup: "service", taxAmount: 500, lineTotal: 10500 }], subtotal: 10000, tax: 500, total: 10500, discount: 4000, giftCard: { code: typed.code, amount: 4000 } },
        overrideAccess: true,
        depth: 0,
      })) as Order;
    const [one, two] = [await pending(), await pending()];
    const [a, b] = await Promise.all([reserveGiftBalance(typed.code, 4000, one.id, cms.payload), reserveGiftBalance(typed.code, 4000, two.id, cms.payload)]);
    expect([a, b].sort()).toEqual([false, true]);
    expect((await card(typed.code)).balance).toBe(0);
    const again = await validateCart(seat, studioId, cms.payload, new Date(), typed.code);
    expect(again.giftCard).toMatchObject({ applied: 0, error: "This gift card has been used up" });

    const winner = a ? one : two;
    const loser = a ? two : one;
    await restoreGiftBalance(loser, cms.payload); // took nothing: gives nothing back
    expect((await card(typed.code)).balance).toBe(0);
    await restoreGiftBalance(winner, cms.payload);
    await restoreGiftBalance(winner, cms.payload); // a second expiry gives nothing back twice
    expect((await card(typed.code)).balance).toBe(40);
  }, 60_000);

  it("unknown, void and self-buying cards pay nothing and say why", async () => {
    const { validateCart } = await import("../../lib/cart/validate");
    const seat = [{ kind: "session" as const, id: sessionId, quantity: 1 }];
    expect((await validateCart(seat, studioId, cms.payload, new Date(), "nope")).giftCard).toMatchObject({ applied: 0, error: "That doesn't look like a gift card code" });
    expect((await validateCart(seat, studioId, cms.payload, new Date(), "HE-NONE-2345-6789")).giftCard).toMatchObject({ applied: 0, error: "We don't know this gift card" });
    await cms.payload.create({ collection: "giftcards", data: { code: "HE-VOID-2345-6789", amount: 40, status: "void" } as unknown as Giftcard, overrideAccess: true, depth: 0 });
    expect((await validateCart(seat, studioId, cms.payload, new Date(), "HE-VOID-2345-6789")).giftCard).toMatchObject({ applied: 0, error: "We don't know this gift card" });
    await cms.payload.create({ collection: "giftcards", data: { code: "HE-SELF-2345-6789", amount: 400 } as unknown as Giftcard, overrideAccess: true, depth: 0 });
    const self = await validateCart([{ kind: "product", id: giftProductId, quantity: 1, amount: 10000 }], studioId, cms.payload, new Date(), "HE-SELF-2345-6789");
    expect(self.giftCard).toMatchObject({ applied: 0, error: "A gift card can't be used to buy a gift card" });
  }, 60_000);

  it("a paid gift card order issues one card per unit, once, and emails the codes to the buyer", async () => {
    const { issueGiftCards } = await import("../../lib/giftcards");
    const order = (await cms.payload.create({
      collection: "orders",
      data: {
        status: "paid",
        paidAt: new Date().toISOString(),
        customer: { name: "Ada Giver", email: "ada@example.com" },
        pickupStudio: studioId,
        lines: [
          { kind: "product", product: giftProductId, label: "Pottery Gift Card", option: "Amount: CA$100.00", quantity: 2, unitAmount: 10000, taxGroup: "exempt", taxAmount: 0, lineTotal: 20000 },
          { kind: "product", product: classProductId, label: "Test class", quantity: 1, unitAmount: 10000, taxGroup: "service", taxAmount: 500, lineTotal: 10500 },
        ],
        subtotal: 30000,
        tax: 500,
        total: 30500,
      },
      overrideAccess: true,
      depth: 0,
    })) as Order;
    const before = sent.length;
    const issued = await issueGiftCards(order.id, cms.payload);
    expect(issued).toHaveLength(2);
    for (const c of issued) expect(c).toMatchObject({ amount: 100, balance: 100, status: "active", buyerEmail: "ada@example.com", order: order.id });
    expect(await issueGiftCards(order.id, cms.payload)).toEqual([]);
    const letters = sent.slice(before);
    expect(letters).toHaveLength(1);
    expect(letters[0].to).toBe("ada@example.com");
    expect(letters[0].subject).toBe("Your Hand Eye Ceramics gift card");
    for (const c of issued) expect(letters[0].text).toContain(`${c.code} — CA$100.00`);
    expect(letters[0].text).toContain("Hi Ada Giver,");
  }, 60_000);

  it("an order a card covers in full is finished without the gateway, and the buyer's details come from the cart", async () => {
    const { finalizeOrder } = await import("../../lib/payments");
    const { reserveGiftBalance } = await import("../../lib/giftcards");
    const { availability } = await import("../../lib/booking/availability");
    await cms.payload.create({ collection: "giftcards", data: { code: "HE-FULL-2345-6789", amount: 200 } as unknown as Giftcard, overrideAccess: true, depth: 0 });
    const order = (await cms.payload.create({
      collection: "orders",
      data: {
        status: "pending",
        gateway: "giftcard",
        stripeSessionId: "gc_unit_test_full",
        customer: { name: "Bea Buyer", email: "bea@example.com", phone: "604-000-0001" },
        attendee: "Bea's sister",
        pickupStudio: studioId,
        discount: 10500,
        giftCard: { code: "HE-FULL-2345-6789", amount: 10500 },
        lines: [{ kind: "session", session: sessionId, product: classProductId, label: "Test date", quantity: 1, unitAmount: 10000, taxGroup: "service", taxAmount: 500, lineTotal: 10500 }],
        subtotal: 10000,
        tax: 500,
        total: 10500,
      },
      overrideAccess: true,
      depth: 0,
    })) as Order;
    const { holdSeats } = await import("../../lib/booking/holds");
    expect(await holdSeats([{ sessionId, qty: 1 }], String(order.id), 60_000, cms.payload)).toEqual({ ok: true });
    expect(await reserveGiftBalance("HE-FULL-2345-6789", 10500, order.id, cms.payload)).toBe(true);
    const before = sent.length;

    const done = await finalizeOrder("gc_unit_test_full", cms.payload);
    expect(done?.status).toBe("paid");
    expect(done?.customer).toEqual({ name: "Bea Buyer", email: "bea@example.com", phone: "604-000-0001" });
    expect(done?.attendee).toBe("Bea's sister");
    expect(done?.stripePaymentIntentId ?? null).toBeNull();
    expect((await availability(sessionId, cms.payload)).sold).toBeGreaterThanOrEqual(1);
    expect((await card("HE-FULL-2345-6789")).balance).toBe(95);
    expect(sent.slice(before).some((m) => m.to === "bea@example.com" && m.subject?.includes("order"))).toBe(true);
  }, 60_000);
});

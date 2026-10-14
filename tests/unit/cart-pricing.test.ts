/**
 * The pure part of the cart check (R03.3, R10, R23i): a line's price, its tax
 * by the pickup province and the product's group, the rounding to the cent per
 * line, the totals. Expected figures are worked out by hand.
 */
import { describe, expect, it } from "vitest";
import { priceLine, totals, type CatalogItem } from "../../lib/cart/pricing";

const clay: CatalogItem = { kind: "product", id: 3, label: "Clay 10kg", unitAmount: 2500, taxGroup: "goods", optionTitles: [] };
const seat: CatalogItem = { kind: "session", id: 7, label: "Wheel Throwing — Thurs Nov 5", unitAmount: 29680, taxGroup: "service", optionTitles: [], studio: 1, left: 3, sellable: true };

describe("priceLine", () => {
  it("charges GST and PST on goods picked up in BC, rounded per line", () => {
    // 3 × $25.00 = $75.00; 12% of that = $9.00
    const line = priceLine({ kind: "product", id: 3, quantity: 3 }, clay, "BC");
    expect(line.unitAmount).toBe(2500);
    expect(line.taxLines.map((t) => `${t.code} ${t.percentage}`)).toEqual(["GST 5", "PST 7"]);
    expect(line.taxAmount).toBe(900);
    expect(line.error).toBeUndefined();
  });

  it("charges only GST on a class seat, and rounds each rate to the cent on the line's amount, as Stripe does", () => {
    // 2 × $296.80 = $593.60; 5% = $29.68
    const line = priceLine({ kind: "session", id: 7, quantity: 2 }, seat, "BC");
    expect(line.taxLines.map((t) => t.code)).toEqual(["GST"]);
    expect(line.taxAmount).toBe(2968);
    // 2 × $4.75 = $9.50: GST 47.5¢ → 48¢, PST 66.5¢ → 67¢, together 115¢ (one rounding of 12% would give 114¢).
    const coffee: CatalogItem = { ...clay, unitAmount: 475 };
    expect(priceLine({ kind: "product", id: 3, quantity: 2 }, coffee, "BC").taxAmount).toBe(115);
    // 1 × $0.05: 0.25¢ and 0.35¢ each round to nothing.
    expect(priceLine({ kind: "product", id: 3, quantity: 1 }, { ...clay, unitAmount: 5 }, "BC").taxAmount).toBe(0);
  });

  it("charges GST alone in Alberta on goods", () => {
    const line = priceLine({ kind: "product", id: 3, quantity: 1 }, clay, "AB");
    expect(line.taxLines.map((t) => t.code)).toEqual(["GST"]);
    expect(line.taxAmount).toBe(125);
  });

  it("marks the line when the item is missing, a seat is short, a date is not for sale or the quantity is off", () => {
    expect(priceLine({ kind: "product", id: 99, quantity: 1 }, undefined, "BC").error).toMatch(/no longer available/i);
    expect(priceLine({ kind: "session", id: 7, quantity: 4 }, seat, "BC").error).toMatch(/only 3 seats? left/i);
    expect(priceLine({ kind: "session", id: 7, quantity: 1 }, { ...seat, left: 0, sellable: false }, "BC").error).toMatch(/sold out/i);
    // A closed date with seats left is closed, not sold out.
    expect(priceLine({ kind: "session", id: 7, quantity: 1 }, { ...seat, sellable: false }, "BC").error).toMatch(/closed/i);
    // A class is sold by the date: the product itself is not a line, even when no date is open.
    expect(priceLine({ kind: "product", id: 3, quantity: 1 }, { ...clay, scheduled: true }, "BC").error).toBe("Choose a date");
    expect(priceLine({ kind: "product", id: 3, quantity: 0 }, clay, "BC").error).toMatch(/quantity/i);
    expect(priceLine({ kind: "product", id: 3, quantity: 21 }, clay, "BC").error).toMatch(/quantity/i);
  });

  it("wants a variant chosen when the product has options, and keeps it on the line", () => {
    const pot: CatalogItem = { ...clay, label: "Hanging Plant Pot", unitAmount: 9500, optionTitles: ["Glaze Colour"] };
    expect(priceLine({ kind: "product", id: 3, quantity: 1 }, pot, "BC").error).toMatch(/choose .*glaze colour/i);
    const chosen = priceLine({ kind: "product", id: 3, quantity: 1, option: "Blue bubbles" }, pot, "BC");
    expect(chosen.error).toBeUndefined();
    expect(chosen.option).toBe("Blue bubbles");
  });
});

describe("priceLine with the price the browser last showed", () => {
  it("flags a line whose price moved in the admin, and only that one", () => {
    expect(priceLine({ kind: "session", id: 7, quantity: 1, seenAmount: 37100 }, seat, "BC").priceChanged).toBe(true);
    expect(priceLine({ kind: "session", id: 7, quantity: 1, seenAmount: 29680 }, seat, "BC").priceChanged).toBeUndefined();
    expect(priceLine({ kind: "session", id: 7, quantity: 1 }, seat, "BC").priceChanged).toBeUndefined();
    // A line that cannot be bought is not also flagged.
    expect(priceLine({ kind: "product", id: 99, quantity: 1, seenAmount: 100 }, undefined, "BC").priceChanged).toBeUndefined();
  });
});

describe("totals", () => {
  it("adds the lines that carry no error", () => {
    const lines = [
      priceLine({ kind: "product", id: 3, quantity: 3 }, clay, "BC"), // 7500 + 900
      priceLine({ kind: "session", id: 7, quantity: 2 }, seat, "BC"), // 59360 + 2968
      priceLine({ kind: "product", id: 99, quantity: 1 }, undefined, "BC"),
    ];
    expect(totals(lines)).toEqual({ subtotal: 66860, tax: 3868, total: 70728 });
  });
});

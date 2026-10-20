/**
 * "You might also like" under a product: the owner's pick in the admin, else
 * other classes in the same city — the other studio's first (Chinatown ↔ Mt
 * Pleasant), then the rest of the city, sooner dates first.
 */
import { describe, expect, it } from "vitest";
import { recommend, type DateAt } from "../../components/shop/recommend";

const CHINATOWN = 1;
const MT_PLEASANT = 2;
const NANAIMO = 3;
const studios = [
  { id: CHINATOWN, city: "Vancouver" },
  { id: MT_PLEASANT, city: "Vancouver" },
  { id: NANAIMO, city: "Nanaimo" },
];

// Products: 10 — a Chinatown course; 11 — Chinatown hand building; 12 — a Mt Pleasant course;
// 13 — a Nanaimo course; 14 — a Mt Pleasant course starting later; 20 — a pot (no dates).
const at = (product: number, studio: number, startsAt: string, sellable = true): DateAt => ({ product, studio, startsAt, sellable });
const dates: DateAt[] = [
  at(10, CHINATOWN, "2026-11-02T02:00:00Z"),
  at(11, CHINATOWN, "2026-11-05T23:00:00Z"),
  at(12, MT_PLEASANT, "2026-11-10T02:00:00Z"),
  at(14, MT_PLEASANT, "2026-12-01T02:00:00Z"),
  at(13, NANAIMO, "2026-11-03T01:00:00Z"),
];
const visible = new Set([10, 11, 12, 13, 14, 20, 30, 31]);

describe("recommend", () => {
  it("a Vancouver class: the other Vancouver studio's classes first, then the rest of the city; never Nanaimo", () => {
    expect(recommend({ product: 10, dates, studios, visible })).toEqual([12, 14, 11]);
  });

  it("a Mt Pleasant class points to Chinatown", () => {
    expect(recommend({ product: 12, dates, studios, visible })).toEqual([10, 11, 14]);
  });

  it("with no class at the other studio of the city, the other classes of the city", () => {
    const chinatownOnly = dates.filter((d) => d.studio !== MT_PLEASANT);
    expect(recommend({ product: 10, dates: chinatownOnly, studios, visible })).toEqual([11]);
  });

  it("a Nanaimo class gets Nanaimo classes only", () => {
    const more = [...dates, at(15, NANAIMO, "2026-11-20T01:00:00Z")];
    expect(recommend({ product: 13, dates: more, studios, visible: new Set([...visible, 15]) })).toEqual([15]);
  });

  it("a date that cannot be bought does not make a class worth recommending, but still places the class in its city", () => {
    const soldOut = [...dates.filter((d) => d.product !== 12), at(12, MT_PLEASANT, "2026-11-10T02:00:00Z", false)];
    expect(recommend({ product: 10, dates: soldOut, studios, visible })).toEqual([14, 11]);
    // A class whose own dates are all over is still a Vancouver class.
    const over = [...dates.filter((d) => d.product !== 10), at(10, CHINATOWN, "2026-01-01T02:00:00Z", false)];
    expect(recommend({ product: 10, dates: over, studios, visible })).toEqual([12, 14, 11]);
  });

  it("a product with no dates (a pot, clay) gets no automatic picks", () => {
    expect(recommend({ product: 20, dates, studios, visible })).toEqual([]);
  });

  it("a studio the visitor cannot see (unpublished) neither places nor offers classes", () => {
    const published = studios.filter((s) => s.id !== MT_PLEASANT);
    expect(recommend({ product: 10, dates, studios: published, visible })).toEqual([11]);
  });

  it("hidden products are left out and the list stops at the limit", () => {
    expect(recommend({ product: 10, dates, studios, visible: new Set([10, 11, 14]) })).toEqual([14, 11]);
    expect(recommend({ product: 10, dates, studios, visible, limit: 2 })).toEqual([12, 14]);
  });

  it("the owner's pick wins, in the owner's order — the next level after a course", () => {
    expect(recommend({ product: 10, picked: [31, 13, 30], dates, studios, visible })).toEqual([31, 13, 30]);
  });

  it("the pick drops the product itself, repeats and hidden products, and stops at the limit", () => {
    expect(recommend({ product: 10, picked: [10, 30, 30, 99, 31, 11, 12, 13], dates, studios, visible })).toEqual([30, 31, 11, 12]);
  });

  it("a pick with nothing left to show falls back to the city rule", () => {
    expect(recommend({ product: 10, picked: [99], dates, studios, visible })).toEqual([12, 14, 11]);
  });
});

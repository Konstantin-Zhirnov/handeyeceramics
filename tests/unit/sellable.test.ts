/**
 * A class date can be bought only while it is open, not over and has a seat
 * left (R01). `left` is what availability() computed for the date.
 */
import { describe, expect, it } from "vitest";
import { isSellable } from "../../lib/booking/availability";

const now = new Date("2026-10-14T12:00:00Z");
const future = "2026-12-10T02:30:00.000Z";
const past = "2026-10-01T02:30:00.000Z";

describe("isSellable", () => {
  it("open, in the future, with seats left", () => {
    expect(isSellable({ status: "open", endsAt: future, left: 3 }, now)).toBe(true);
  });
  it("no seat left", () => {
    expect(isSellable({ status: "open", endsAt: future, left: 0 }, now)).toBe(false);
  });
  it("closed or hidden", () => {
    expect(isSellable({ status: "closed", endsAt: future, left: 3 }, now)).toBe(false);
    expect(isSellable({ status: "hidden", endsAt: future, left: 3 }, now)).toBe(false);
  });
  it("already over", () => {
    expect(isSellable({ status: "open", endsAt: past, left: 3 }, now)).toBe(false);
  });
  it("no end date is not treated as over", () => {
    expect(isSellable({ status: "open", endsAt: null, left: 1 }, now)).toBe(true);
  });
});

/**
 * The period of the orders export (R26i): `from` and `to` are calendar days
 * of the studios' time zone, both inclusive, so a month-end sale paid at
 * 8 pm in Vancouver stays in that month.
 */
import { describe, expect, it } from "vitest";
import { dayRange } from "../../app/(site)/exports/period";

const TZ = "America/Vancouver";

describe("dayRange", () => {
  it("a day in daylight time (UTC-7): midnight to the last millisecond of the day", () => {
    expect(dayRange("2026-10-31", "2026-10-31", TZ)).toEqual({
      from: new Date("2026-10-31T07:00:00.000Z"),
      to: new Date("2026-11-01T06:59:59.999Z"),
    });
  });

  it("after the clocks fall back (UTC-8)", () => {
    expect(dayRange("2026-11-02", "2026-11-03", TZ)).toEqual({
      from: new Date("2026-11-02T08:00:00.000Z"),
      to: new Date("2026-11-04T07:59:59.999Z"),
    });
  });

  it("either bound may be missing", () => {
    expect(dayRange("2026-11-02", undefined, TZ)).toEqual({ from: new Date("2026-11-02T08:00:00.000Z"), to: undefined });
    expect(dayRange(undefined, undefined, TZ)).toEqual({ from: undefined, to: undefined });
  });

  it("a malformed or impossible date is refused", () => {
    expect(dayRange("2026-1-2", undefined, TZ)).toBeNull();
    expect(dayRange("yesterday", undefined, TZ)).toBeNull();
    expect(dayRange("2026-02-30", undefined, TZ)).toBeNull();
    expect(dayRange("2026-11-03", "2026-11-02", TZ)).toBeNull();
  });
});

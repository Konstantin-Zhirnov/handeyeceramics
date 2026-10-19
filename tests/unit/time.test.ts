/**
 * British Columbia moved to permanent UTC-7 (IANA tzdata 2026b): the clocks
 * did not fall back on 2026-11-01. A runtime with older tzdata (Node 23 ships
 * 2025a) still answers UTC-8 for those dates; lib/time answers UTC-7 on any
 * runtime, so the seed and the admin agree with production on Vercel.
 */
import { describe, expect, it } from "vitest";
import { formatInZone, localDay, offsetMinutes, staleBCRule, startOfDay } from "../../lib/time";

const TZ = "America/Vancouver";

describe("offsetMinutes in British Columbia", () => {
  it("UTC-8 before the spring-forward of 2026-03-08, UTC-7 after it", () => {
    expect(offsetMinutes(new Date("2026-02-15T12:00:00.000Z"), TZ)).toBe(-480);
    expect(offsetMinutes(new Date("2026-07-01T12:00:00.000Z"), TZ)).toBe(-420);
  });

  it("stays UTC-7 across 2026-11-01 02:00 and through the next winter", () => {
    for (const at of ["2026-11-01T08:59:00.000Z", "2026-11-01T09:00:00.000Z", "2026-11-14T02:00:00.000Z", "2027-01-15T12:00:00.000Z", "2027-11-07T12:00:00.000Z"]) {
      expect(offsetMinutes(new Date(at), TZ), at).toBe(-420);
    }
  });

  it("other zones keep their own rules", () => {
    expect(offsetMinutes(new Date("2026-12-01T12:00:00.000Z"), "America/Los_Angeles")).toBe(-480);
    expect(offsetMinutes(new Date("2026-12-01T12:00:00.000Z"), "UTC")).toBe(0);
  });
});

describe("staleBCRule", () => {
  it("tzdata before 2026b lacks the rule; 2026b and later, or unknown, have it", () => {
    expect(staleBCRule("2025a")).toBe(true);
    expect(staleBCRule("2026a")).toBe(true);
    expect(staleBCRule("2026b")).toBe(false);
    expect(staleBCRule("2026d")).toBe(false);
    expect(staleBCRule("2027a")).toBe(false);
    expect(staleBCRule(undefined)).toBe(false);
  });
});

describe("wall clock after 2026-11-01", () => {
  it("a 7 pm class on Nov 13 is 02:00 UTC on Nov 14 and reads back as 7 pm on Nov 13", () => {
    const at = new Date("2026-11-14T02:00:00.000Z");
    expect(formatInZone(at, { hour: "numeric", minute: "2-digit" })).toBe("7:00 PM");
    expect(localDay(at, TZ)).toBe("2026-11-13");
    expect(startOfDay("2026-11-13", TZ)).toEqual(new Date("2026-11-13T07:00:00.000Z"));
  });

  it("the invoice's long date with time", () => {
    expect(formatInZone(new Date("2026-11-14T01:00:00.000Z"), { dateStyle: "long", timeStyle: "short" }, "en-CA")).toBe(
      "November 13, 2026 at 6:00 p.m.",
    );
  });
});

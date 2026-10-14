/**
 * The seed reads the dates of a class out of the Wix drop-down label. Expected
 * values are worked out by hand: the studios are in British Columbia, so
 * "4pm" on Nov 5 is 16:00 PST (UTC-8) and "1PM" on Oct 17 is 13:00 PDT (UTC-7);
 * the year is the nearest one that puts the start on or after the floor
 * (2026-08-01, the month before the crawl), so "Jan 26" is 2027.
 */
import { describe, expect, it } from "vitest";
import { parseSessionLabel } from "../../scripts/seed/sessions";

const floor = new Date("2026-08-01T00:00:00Z");
const iso = (d?: Date) => d?.toISOString();

describe("parseSessionLabel", () => {
  it("a weekly course with am/pm times and a month-day range", () => {
    const r = parseSessionLabel("Thurs 4pm-6:30pm Nov 5-Dec 10 (Mapi)", floor);
    expect(iso(r.startsAt)).toBe("2026-11-06T00:00:00.000Z");
    expect(iso(r.endsAt)).toBe("2026-12-11T02:30:00.000Z");
    expect(r.weekday).toBe("thursday");
    expect(r.time).toBe("4pm-6:30pm");
  });

  it("an end time without am/pm or colon, an en dash in the dates", () => {
    const r = parseSessionLabel("SUN 1pm-330,Nov 15–Dec 20", floor);
    expect(iso(r.startsAt)).toBe("2026-11-15T21:00:00.000Z");
    expect(iso(r.endsAt)).toBe("2026-12-20T23:30:00.000Z");
    expect(r.weekday).toBe("sunday");
    expect(r.time).toBe("1pm-330");
  });

  it("a one-off class: start and end on the same day", () => {
    const r = parseSessionLabel("Sat wheel Oct 17, 1PM-3:45PM @739 Gore", floor);
    expect(iso(r.startsAt)).toBe("2026-10-17T20:00:00.000Z");
    expect(iso(r.endsAt)).toBe("2026-10-17T22:45:00.000Z");
    expect(r.weekday).toBe("saturday");
    expect(r.time).toBe("1PM-3:45PM");
  });

  it("a course before the floor rolls over to the next year", () => {
    const r = parseSessionLabel("MON 3pm-545,Jan 26-Mar 9 (No Feb 16)*DM for +15%of", floor);
    expect(iso(r.startsAt)).toBe("2027-01-26T23:00:00.000Z");
    expect(iso(r.endsAt)).toBe("2027-03-10T01:45:00.000Z");
    expect(r.weekday).toBe("monday");
    expect(r.time).toBe("3pm-545");
  });

  it("bare afternoon hours, dates glued to the month", () => {
    const r = parseSessionLabel("Tues 3:30-5:15 Oct13-Nov17(3168uplands dr Nan", floor);
    expect(iso(r.startsAt)).toBe("2026-10-13T22:30:00.000Z");
    expect(iso(r.endsAt)).toBe("2026-11-18T01:15:00.000Z");
    expect(r.weekday).toBe("tuesday");
    expect(r.time).toBe("3:30-5:15");
  });

  it("an ordinal in the name is not a date; upper-case PM without a colon", () => {
    const r = parseSessionLabel("Tues 2nd Level Wheel 6PM–845PM, Sep 1–Oct 6", floor);
    expect(iso(r.startsAt)).toBe("2026-09-02T01:00:00.000Z");
    expect(iso(r.endsAt)).toBe("2026-10-07T03:45:00.000Z");
    expect(r.weekday).toBe("tuesday");
    expect(r.time).toBe("6PM–845PM");
  });

  it("a full month name, the course after the crawl's summer", () => {
    const r = parseSessionLabel("Wed 7pm-9:45PM, July 8-Aug 12 (Mapi)", floor);
    expect(iso(r.startsAt)).toBe("2027-07-09T02:00:00.000Z");
    expect(iso(r.endsAt)).toBe("2027-08-13T04:45:00.000Z");
    expect(r.weekday).toBe("wednesday");
  });

  it("a label without dates gives no dates", () => {
    expect(parseSessionLabel("Private lesson, time to be arranged", floor)).toEqual({});
    expect(parseSessionLabel("TBA", floor)).toEqual({});
  });
});

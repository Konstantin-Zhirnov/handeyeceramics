/**
 * The owner's phone view of the class dates (R01.1): the window starts at
 * midnight on the studios' clock, not at UTC midnight, so an evening class in
 * Vancouver stays on its own day; dates are grouped by that day; and a buyer
 * of two seats reads as one student with two seats.
 */
import { describe, expect, it } from "vitest";
import {
  RUNNING,
  dayTitle,
  groupByDay,
  leftText,
  shortDay,
  studentRows,
  studioParam,
  timeOf,
  upcomingWhere,
  upcomingWindow,
} from "../../components/admin/upcoming";
import { addDays, localDay, startOfDay } from "../../lib/time";

const TZ = "America/Vancouver";
// Sunday 2026-10-18, 9 pm in Vancouver (PDT, UTC-7): already Monday in UTC.
const NOW = new Date("2026-10-19T04:00:00.000Z");

describe("upcomingWindow", () => {
  it("starts at midnight of today in Vancouver, not of today in UTC", () => {
    const w = upcomingWindow(NOW, undefined, TZ);
    expect(w.today).toBe("2026-10-18");
    expect(w.from).toEqual(new Date("2026-10-18T07:00:00.000Z"));
    expect(w.to).toBeUndefined();
  });

  it("a number of days ends the window at the midnight that many days later", () => {
    expect(upcomingWindow(NOW, 7, TZ).to).toEqual(new Date("2026-10-25T07:00:00.000Z"));
  });

  it("across Nov 1, 2026 the clocks do not fall back: midnight of Nov 2 is 07:00 UTC", () => {
    // tzdata 2026b: British Columbia stays on UTC-7; lib/time applies it on older runtimes too.
    expect(upcomingWindow(new Date("2026-10-30T19:00:00.000Z"), 3, TZ).to).toEqual(new Date("2026-11-02T07:00:00.000Z"));
  });
});

describe("upcomingWhere", () => {
  it("with running courses: dates starting today or later, or still running today; then the window end and the studio", () => {
    const w = upcomingWindow(NOW, 7, TZ);
    expect(upcomingWhere(w, { studio: 2, running: true })).toEqual({
      and: [
        { or: [{ startsAt: { greater_than_equal: "2026-10-18T07:00:00.000Z" } }, { endsAt: { greater_than_equal: "2026-10-18T07:00:00.000Z" } }] },
        { startsAt: { less_than: "2026-10-25T07:00:00.000Z" } },
        { studio: { equals: 2 } },
      ],
    });
  });

  it("by default only the dates starting today or later, with no end and no studio", () => {
    expect(upcomingWhere(upcomingWindow(NOW, undefined, TZ))).toEqual({
      and: [{ startsAt: { greater_than_equal: "2026-10-18T07:00:00.000Z" } }],
    });
  });
});

describe("studioParam", () => {
  it("takes a positive whole number and nothing else", () => {
    expect(studioParam("3")).toBe(3);
    expect(studioParam(["2", "5"])).toBe(2);
    for (const bad of [undefined, "", "0", "-1", "1.5", "abc", "3; drop"]) expect(studioParam(bad)).toBeUndefined();
  });
});

describe("groupByDay", () => {
  const dates = [
    { id: 4, startsAt: "2026-10-23T02:00:00.000Z" }, // Thu Oct 22, 7 pm
    { id: 2, startsAt: "2026-10-19T02:00:00.000Z" }, // Sun Oct 18, 7 pm — the same UTC day as Monday's class
    { id: 1, startsAt: "2026-10-17T16:30:00.000Z" }, // Sat Oct 17: a course that started yesterday
    { id: 3, startsAt: "2026-10-19T20:00:00.000Z" }, // Mon Oct 19, 1 pm
    { id: 5, startsAt: null },
  ];

  it("groups by the Vancouver day, the days in order, running courses last", () => {
    const groups = groupByDay(dates, NOW, TZ);
    expect(groups.map((g) => [g.key, g.dates.map((d) => d.id)])).toEqual([
      ["2026-10-18", [2]],
      ["2026-10-19", [3]],
      ["2026-10-22", [4]],
      [RUNNING, [1]],
    ]);
    expect(groups.map((g) => g.title)).toEqual([
      "Today · Sun, Oct 18",
      "Tomorrow · Mon, Oct 19",
      "Thu, Oct 22",
      "Courses already running",
    ]);
  });

  it("dates of one day stay in time order", () => {
    const day = groupByDay(
      [
        { id: 2, startsAt: "2026-10-19T02:00:00.000Z" },
        { id: 1, startsAt: "2026-10-18T20:00:00.000Z" },
      ],
      NOW,
      TZ,
    );
    expect(day).toHaveLength(1);
    expect(day[0].dates.map((d) => d.id)).toEqual([1, 2]);
  });

  it("no dates, no groups", () => {
    expect(groupByDay([], NOW, TZ)).toEqual([]);
  });
});

describe("labels", () => {
  it("day titles name today and tomorrow", () => {
    expect(dayTitle("2026-10-18", "2026-10-18")).toBe("Today · Sun, Oct 18");
    expect(dayTitle("2026-10-19", "2026-10-18")).toBe("Tomorrow · Mon, Oct 19");
    expect(dayTitle("2026-11-01", "2026-10-18")).toBe("Sun, Nov 1");
  });

  it("the time is the studio's wall clock", () => {
    expect(timeOf("2026-10-19T02:00:00.000Z", TZ)).toBe("7:00 PM");
  });

  it("a 7 pm class after Nov 1, 2026 is 02:00 UTC and reads 7:00 PM on its own day", () => {
    expect(timeOf("2026-11-14T02:00:00.000Z", TZ)).toBe("7:00 PM");
    expect(shortDay("2026-11-14T02:00:00.000Z", TZ)).toBe("Nov 13");
  });

  it("no seat left reads as sold out", () => {
    expect(leftText(3)).toBe("3 left");
    expect(leftText(0)).toBe("Sold out");
    expect(leftText(null)).toBe("Sold out");
  });
});

describe("studentRows", () => {
  it("two seats of one order for one name are one row of two seats; refunded last", () => {
    const rows = studentRows([
      { id: 1, name: "Refunded Student", status: "refunded", order: 7 },
      { id: 2, name: "Pat Buyer", status: "confirmed", order: { id: 9 } },
      { id: 3, name: "Pat Buyer", status: "confirmed", order: 9 },
      { id: 4, name: "Sam Friend", status: "confirmed", order: 9 },
      { id: 5, name: "", status: "imported", order: null },
      { id: 6, name: "", status: "imported", order: null },
    ]);
    expect(rows.map((r) => [r.id, r.name, r.seats, r.status])).toEqual([
      [2, "Pat Buyer", 2, "confirmed"],
      [4, "Sam Friend", 1, "confirmed"],
      [5, "(no name)", 1, "imported"],
      [6, "(no name)", 1, "imported"],
      [1, "Refunded Student", 1, "refunded"],
    ]);
  });
});

describe("lib/time days", () => {
  it("localDay reads the Vancouver calendar, addDays crosses months", () => {
    expect(localDay(NOW, TZ)).toBe("2026-10-18");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(startOfDay("2026-02-30", TZ)).toBeUndefined();
  });
});

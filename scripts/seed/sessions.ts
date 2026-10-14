/**
 * Reads the dates of a class out of the label of the old site's "Date"
 * drop-down: "Thurs 4pm-6:30pm Nov 5-Dec 10 (Mapi)", "SUN 1pm-330,Nov 15–Dec 20",
 * "Sat wheel Oct 17, 1PM-3:45PM @739 Gore". The labels carry no year: the
 * nearest year that puts the start on or after `floor` is taken (the seed
 * passes the month before the crawl). Times are the studios' wall clock,
 * British Columbia. A label the parser cannot read gives no dates.
 */

export type ParsedLabel = {
  startsAt?: Date;
  endsAt?: Date;
  weekday?: Weekday;
  time?: string;
};

export type Weekday = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

const WEEKDAYS: Weekday[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const WEEKDAY_PREFIX: Record<string, Weekday> = {
  mon: "monday",
  tue: "tuesday",
  wed: "wednesday",
  thu: "thursday",
  fri: "friday",
  sat: "saturday",
  sun: "sunday",
};
const MONTH_PREFIX = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** The studios' time zone; the labels are their wall clock. */
export const STUDIO_TIME_ZONE = "America/Vancouver";

const WEEKDAY_RE = /\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b\.?/i;
/** "Nov 5", "Oct13", "July 8", "Sept 24" — a month name followed by a day. */
const DATE_RE = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*(\d{1,2})\b/gi;
/** "4pm-6:30pm", "1pm-330", "3:30-5:15", "6PM–845PM", "10AM–1245PM". */
const TIME_RE = /\b(\d{1,2})(?::?(\d{2}))?\s*(am|pm)?\s*[-–]\s*(\d{1,2})(?::?(\d{2}))?\s*(am|pm)?\b/gi;

type Clock = { hour: number; minute: number };

/** Hours written without am/pm: 8 to 11 are morning, the rest afternoon and evening. */
function clock(hour: string, minute: string | undefined, meridiem: string | undefined, other?: string): Clock {
  let h = Number(hour);
  const m = minute ? Number(minute) : 0;
  const period = (meridiem || other || (h >= 8 && h <= 11 ? "am" : "pm")).toLowerCase();
  if (period === "pm" && h < 12) h += 12;
  if (period === "am" && h === 12) h = 0;
  return { hour: h, minute: m };
}

/** The time range of the label: the first dash-separated pair with an am/pm or a colon in it. */
function timeOf(label: string): { text: string; start: Clock; end: Clock } | undefined {
  for (const m of label.matchAll(TIME_RE)) {
    const [text, h1, m1, p1, h2, m2, p2] = m;
    if (!(p1 || p2 || text.includes(":"))) continue; // "Nov 5-10" is a date range, not a time
    const start = clock(h1, m1, p1, p2);
    let end = clock(h2, m2, p2, p1);
    // "1pm-330": the end without am/pm is in the same half of the day as the start, or later.
    if (!p2 && end.hour * 60 + end.minute <= start.hour * 60 + start.minute && end.hour < 12) end = { ...end, hour: end.hour + 12 };
    return { text: text.trim(), start, end };
  }
  return undefined;
}

/** The offset of the studios' time zone at an instant, in minutes east of UTC. */
function offsetAt(instant: number): number {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: STUDIO_TIME_ZONE, timeZoneName: "longOffset" })
    .formatToParts(new Date(instant))
    .find((p) => p.type === "timeZoneName")?.value; // "GMT-07:00"
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(part || "");
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

/** A wall-clock moment in the studios' time zone, as an instant. */
export function studioTime(year: number, month: number, day: number, c: Clock): Date {
  const wall = Date.UTC(year, month, day, c.hour, c.minute);
  let instant = wall - offsetAt(wall) * 60_000;
  instant = wall - offsetAt(instant) * 60_000; // settle across a daylight-saving change
  return new Date(instant);
}

export function parseSessionLabel(label: string, floor: Date): ParsedLabel {
  const dates = [...label.matchAll(DATE_RE)].map((m) => ({
    month: MONTH_PREFIX.indexOf(m[1].slice(0, 3).toLowerCase()),
    day: Number(m[2]),
  }));
  if (!dates.length) return {};

  const time = timeOf(label);
  const start = dates[0];
  const end = dates[1] || start;
  // The nearest year with the start on or after the floor (compared by calendar day).
  let year = floor.getUTCFullYear();
  if (Date.UTC(year, start.month, start.day) < Date.UTC(year, floor.getUTCMonth(), floor.getUTCDate())) year++;
  const endYear = end.month < start.month ? year + 1 : year;

  const startsAt = studioTime(year, start.month, start.day, time?.start || { hour: 0, minute: 0 });
  const endsAt = studioTime(endYear, end.month, end.day, time?.end || { hour: 23, minute: 59 });

  const wd = WEEKDAY_RE.exec(label);
  const weekday = wd
    ? WEEKDAY_PREFIX[wd[1].toLowerCase()]
    : WEEKDAYS[new Date(Date.UTC(year, start.month, start.day)).getUTCDay()];

  const out: ParsedLabel = { startsAt, endsAt, weekday };
  if (time) out.time = time.text;
  return out;
}

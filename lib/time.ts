/**
 * The studios' clock: every studio keeps British Columbia time, so the class
 * dates of the seed are read as that wall clock and the periods of the exports
 * are calendar days of that zone. The offset at an instant is found through
 * Intl, so daylight-saving changes need no table.
 */

/** Where the studios keep their clocks. */
export const STUDIO_TIME_ZONE = "America/Vancouver";

/** The UTC offset of a zone at an instant, in minutes east of UTC (Vancouver in summer: -420). */
export function offsetMinutes(at: Date, timeZone: string = STUDIO_TIME_ZONE): number {
  const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value; // "GMT-07:00"
  const m = part?.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3] || 0));
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The instant a calendar day (YYYY-MM-DD) starts in the zone; undefined when the text is not a real date. */
export function startOfDay(day: string, timeZone: string = STUDIO_TIME_ZONE): Date | undefined {
  const m = day.match(DAY);
  if (!m) return undefined;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const utcMidnight = Date.UTC(y, mo - 1, d);
  const check = new Date(utcMidnight);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return undefined;
  // Local midnight is UTC midnight minus the offset; the offset is taken at the result itself, once more, for a day that starts in another offset.
  let instant = utcMidnight - offsetMinutes(check, timeZone) * 60_000;
  instant = utcMidnight - offsetMinutes(new Date(instant), timeZone) * 60_000;
  return new Date(instant);
}

/** The calendar day (YYYY-MM-DD) of an instant on the zone's wall clock. */
export function localDay(at: Date, timeZone: string = STUDIO_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

/** The calendar day `n` days after `day` (YYYY-MM-DD); calendar arithmetic, no zone involved. */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

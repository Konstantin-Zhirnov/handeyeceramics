/**
 * The studios' clock: every studio keeps British Columbia time, so the class
 * dates of the seed are read as that wall clock and the periods of the exports
 * are calendar days of that zone. The offset at an instant is found through
 * Intl, so daylight-saving changes need no table, with one exception: British
 * Columbia stays on UTC-7 from 2026-11-01 (IANA tzdata 2026b), and a runtime
 * with older time zone data would fall back to UTC-8 there. Wall-clock text
 * goes through `formatInZone`, which uses the same offset.
 */

/** Where the studios keep their clocks. */
export const STUDIO_TIME_ZONE = "America/Vancouver";

const BC_ZONES = new Set(["America/Vancouver", "Canada/Pacific"]);
/** The fall-back that British Columbia skipped: 2026-11-01 02:00 PDT. */
const BC_PERMANENT_FROM = Date.UTC(2026, 10, 1, 9);
const BC_PERMANENT_OFFSET = -420;
const BC_TZDATA = "2026b";

/** The tzdata version of the runtime ("2025a"), or undefined where it is not known (a browser). */
function runtimeTzdata(): string | undefined {
  return typeof process === "undefined" ? undefined : process.versions?.tz;
}

/** True when the runtime's time zone data predates British Columbia's permanent UTC-7. */
export function staleBCRule(tz: string | undefined): boolean {
  return Boolean(tz) && tz! < BC_TZDATA;
}

/** The UTC offset of a zone at an instant, in minutes east of UTC (Vancouver in summer: -420). */
export function offsetMinutes(at: Date, timeZone: string = STUDIO_TIME_ZONE): number {
  if (BC_ZONES.has(timeZone) && at.getTime() >= BC_PERMANENT_FROM && staleBCRule(runtimeTzdata())) return BC_PERMANENT_OFFSET;
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

/**
 * An instant as text on the zone's wall clock: Intl formats the instant moved
 * by `offsetMinutes` as UTC, so the text agrees with the offset on any runtime.
 * No `timeZoneName` in `options`: it would read "UTC".
 */
export function formatInZone(
  at: Date,
  options: Intl.DateTimeFormatOptions,
  locale = "en-US",
  timeZone: string = STUDIO_TIME_ZONE,
): string {
  const wall = new Date(at.getTime() + offsetMinutes(at, timeZone) * 60_000);
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(wall);
}

/** The calendar day (YYYY-MM-DD) of an instant on the zone's wall clock. */
export function localDay(at: Date, timeZone: string = STUDIO_TIME_ZONE): string {
  return formatInZone(at, { year: "numeric", month: "2-digit", day: "2-digit" }, "en-CA", timeZone);
}

/** The calendar day `n` days after `day` (YYYY-MM-DD); calendar arithmetic, no zone involved. */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

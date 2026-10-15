/**
 * The period of an export: `from` and `to` are calendar days (YYYY-MM-DD) in
 * the studios' time zone, both inclusive. The instant a local day starts is
 * found through the zone's offset (lib/time), so daylight-saving changes need
 * no table.
 */
import { STUDIO_TIME_ZONE, offsetMinutes } from "@/lib/time";

/** Re-exported for the export routes, which take the zone from here. */
export { STUDIO_TIME_ZONE };

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The instant a calendar day starts in the zone; undefined when the text is not a real date. */
export function startOfDay(day: string, timeZone: string): Date | undefined {
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

export type DayRange = { from: Date | undefined; to: Date | undefined };

/** Both bounds inclusive: `to` ends at the last millisecond of its day. Null when a bound is malformed or `to` precedes `from`. */
export function dayRange(from: string | undefined, to: string | undefined, timeZone: string): DayRange | null {
  const start = from ? startOfDay(from, timeZone) : undefined;
  if (from && !start) return null;
  let end: Date | undefined;
  if (to) {
    const next = startOfDay(to, timeZone);
    if (!next) return null;
    // The last millisecond of the day: the start of the next local day, less one.
    const m = to.match(DAY)!;
    const following = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1));
    const nextDay = startOfDay(following.toISOString().slice(0, 10), timeZone)!;
    end = new Date(nextDay.getTime() - 1);
  }
  if (start && end && end < start) return null;
  return { from: start, to: end };
}

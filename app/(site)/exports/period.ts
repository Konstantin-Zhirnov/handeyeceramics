/**
 * The period of an export: `from` and `to` are calendar days (YYYY-MM-DD) in
 * the studios' time zone, both inclusive. The instant a local day starts is
 * found through the zone's offset (lib/time), so daylight-saving changes need
 * no table.
 */
import { STUDIO_TIME_ZONE, startOfDay } from "@/lib/time";

/** Re-exported for the export routes, which take the zone from here. */
export { STUDIO_TIME_ZONE, startOfDay };

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

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

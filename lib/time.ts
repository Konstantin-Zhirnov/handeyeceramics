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

/**
 * The owner's phone view of the class dates (R01.1): which dates come next,
 * day by day on the studios' clock, and who holds a seat on each. Pure — the
 * admin components read the CMS and hand the rows here; the seats themselves
 * come from the `sold` / `left` fields, which lib/booking/availability counts.
 */
import type { Where } from "payload";
import { relId } from "../../lib/cms/relations";
import { STUDIO_TIME_ZONE, addDays, localDay, startOfDay } from "../../lib/time";

/** The key of the group of courses that started before today and still run. */
export const RUNNING = "running";

export type DateWindow = {
  /** Today on the studios' clock, YYYY-MM-DD. */
  today: string;
  /** The instant today started. */
  from: Date;
  /** The instant the window ends, exclusive; none — every later date. */
  to?: Date;
};

/** From the start of today on the studios' clock; `days` — only the dates that start within that many days, today included. */
export function upcomingWindow(now: Date, days?: number, timeZone: string = STUDIO_TIME_ZONE): DateWindow {
  const today = localDay(now, timeZone);
  const from = startOfDay(today, timeZone)!;
  const to = days && days > 0 ? startOfDay(addDays(today, days), timeZone) : undefined;
  return { today, from, to };
}

/**
 * The dates of the window: those starting today or later and, with `running`,
 * the courses started earlier that still run today; `studio` — of that studio only.
 */
export function upcomingWhere(window: DateWindow, { studio, running = false }: { studio?: number; running?: boolean } = {}): Where {
  const from = window.from.toISOString();
  const starts: Where = { startsAt: { greater_than_equal: from } };
  const and: Where[] = [running ? { or: [starts, { endsAt: { greater_than_equal: from } }] } : starts];
  if (window.to) and.push({ startsAt: { less_than: window.to.toISOString() } });
  if (studio) and.push({ studio: { equals: studio } });
  return { and };
}

/** The studio of a `?studio=` filter: a positive whole number, or none. */
export function studioParam(value: unknown): number | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  const n = typeof v === "string" && /^\d+$/.test(v) ? Number(v) : undefined;
  return n && n > 0 ? n : undefined;
}

export type DayGroup<T> = { key: string; title: string; dates: T[] };

const dayFormat = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });

/** "Today · Sun, Oct 18", "Tomorrow · Mon, Oct 19", "Thu, Oct 22". */
export function dayTitle(day: string, today: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const name = dayFormat.format(new Date(Date.UTC(y, m - 1, d)));
  if (day === today) return `Today · ${name}`;
  if (day === addDays(today, 1)) return `Tomorrow · ${name}`;
  return name;
}

/**
 * The dates by the day they start on the studios' clock, in time order; the
 * courses that started before today come last, in a group of their own, so
 * today's classes are the first thing on the screen.
 */
export function groupByDay<T extends { startsAt?: string | null }>(
  dates: T[],
  now: Date,
  timeZone: string = STUDIO_TIME_ZONE,
): DayGroup<T>[] {
  const today = localDay(now, timeZone);
  const sorted = dates
    .filter((d) => d.startsAt)
    .slice()
    .sort((a, b) => new Date(a.startsAt!).getTime() - new Date(b.startsAt!).getTime());
  const groups = new Map<string, DayGroup<T>>();
  for (const date of sorted) {
    const day = localDay(new Date(date.startsAt!), timeZone);
    const key = day < today ? RUNNING : day;
    if (!groups.has(key)) {
      groups.set(key, { key, title: key === RUNNING ? "Courses already running" : dayTitle(day, today), dates: [] });
    }
    groups.get(key)!.dates.push(date);
  }
  const out = [...groups.values()];
  return out.sort((a, b) => (a.key === RUNNING ? 1 : b.key === RUNNING ? -1 : a.key.localeCompare(b.key)));
}

/** The wall-clock time of an instant at the studios: "1:00 PM". */
export function timeOf(at: string | Date, timeZone: string = STUDIO_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(at));
}

/** The calendar day of an instant at the studios: "Nov 28". */
export function shortDay(at: string | Date, timeZone: string = STUDIO_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric" }).format(new Date(at));
}

/** "3 left", or "Sold out" when no seat is left. */
export function leftText(left: number | null | undefined): string {
  return (left ?? 0) > 0 ? `${left} left` : "Sold out";
}

export type Registration = {
  id: number;
  name?: string | null;
  status: string;
  order?: number | { id: number } | null;
};

export type StudentRow = { key: string; id: number; name: string; seats: number; status: string };

const STATUS_ORDER: Record<string, number> = { confirmed: 0, imported: 0, refunded: 1 };

/**
 * The students of a date, one row per person: an order of two seats for the
 * same name is written as two registrations and shown as one row of two
 * seats. Those holding a seat come first, refunded ones last; the first
 * registration of a row is the one its link opens.
 */
export function studentRows(registrations: Registration[]): StudentRow[] {
  const rows = new Map<string, StudentRow>();
  for (const r of registrations) {
    const name = r.name?.trim() || "(no name)";
    const order = relId(r.order);
    const key = `${order ? `o${order}` : `r${r.id}`}|${name.toLowerCase()}|${r.status}`;
    const row = rows.get(key);
    if (row) row.seats += 1;
    else rows.set(key, { key, id: r.id, name, seats: 1, status: r.status });
  }
  return [...rows.values()].sort((a, b) => (STATUS_ORDER[a.status] ?? 2) - (STATUS_ORDER[b.status] ?? 2));
}

/** What the owner reads for a registration status. */
export const STUDENT_STATUS: Record<string, string> = {
  confirmed: "Paid",
  imported: "Added by hand",
  refunded: "Refunded",
};

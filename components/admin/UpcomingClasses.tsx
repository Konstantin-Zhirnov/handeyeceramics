import Link from "next/link";
import type { Payload, TypedUser } from "payload";
import type { Session } from "../../payload-types";
import { relId } from "../../lib/cms/relations";
import { groupByDay, leftText, shortDay, studioParam, timeOf, upcomingWhere, upcomingWindow, RUNNING } from "./upcoming";

type Params = Record<string, string | string[] | undefined> | undefined;

type Props = {
  payload: Payload;
  user?: TypedUser | null;
  searchParams?: Params;
  /** Only the dates starting within that many days; none — every upcoming date. */
  days?: number;
  /** The admin page the studio filter links back to, e.g. "/admin" or "/admin/upcoming". */
  basePath: string;
};

const STATUS_TAG: Record<string, string> = { closed: "Closed", hidden: "Hidden" };

/**
 * The upcoming class dates for the owner's phone (R01.1): one row per date —
 * label, time and studio, the seats taken out of the seats, and what is left —
 * grouped by day on the studios' clock; a tap opens the date with its students.
 * Read as the signed-in editor (`overrideAccess: false`); the seat counts are
 * the `sold` / `left` fields the sessions collection counts on read.
 */
export async function UpcomingClasses({ payload, user, searchParams, days, basePath }: Props) {
  const admin = payload.config.routes.admin;
  const studio = studioParam(searchParams?.studio);
  const now = new Date();
  const window = upcomingWindow(now, days);
  const [studios, sessions] = await Promise.all([
    payload.find({ collection: "studios", depth: 0, limit: 0, pagination: false, sort: "id", select: { name: true }, overrideAccess: false, user }),
    payload.find({
      collection: "sessions",
      where: upcomingWhere(window, { studio, running: true }),
      sort: "startsAt",
      depth: 0,
      limit: 0,
      pagination: false,
      select: { label: true, studio: true, startsAt: true, endsAt: true, seats: true, status: true },
      overrideAccess: false,
      user,
    }),
  ]);
  const studioName = new Map(studios.docs.map((s) => [s.id, s.name]));
  const groups = groupByDay(sessions.docs as Session[], now);
  const filterHref = (id?: number) => (id ? `${basePath}?studio=${id}` : basePath);

  return (
    <div className="he-upcoming">
      <style>{CSS}</style>
      <nav className="he-upcoming__filter" aria-label="Filter by studio">
        <Link href={filterHref()} className="he-chip" aria-current={!studio ? "true" : undefined}>
          All studios
        </Link>
        {studios.docs.map((s) => (
          <Link key={s.id} href={filterHref(s.id)} className="he-chip" aria-current={studio === s.id ? "true" : undefined}>
            {s.name}
          </Link>
        ))}
      </nav>
      {!groups.length && <p className="he-upcoming__empty">No class dates {days ? `in the next ${days} days` : "from today on"}.</p>}
      {groups.map((g) => {
        const list = (
          <ul className="he-upcoming__list">
            {g.dates.map((d) => (
              <DateRow key={d.id} date={d} running={g.key === RUNNING} place={studioName.get(relId(d.studio) ?? 0) || ""} href={`${admin}/collections/sessions/${d.id}`} />
            ))}
          </ul>
        );
        // The courses that started earlier are folded: today's classes are what the owner opens the page for.
        return g.key === RUNNING ? (
          <details key={g.key} className="he-upcoming__day">
            <summary className="he-upcoming__dayTitle he-upcoming__fold">
              {g.title} ({g.dates.length})
            </summary>
            {list}
          </details>
        ) : (
          <section key={g.key} className="he-upcoming__day">
            <h3 className="he-upcoming__dayTitle">{g.title}</h3>
            {list}
          </section>
        );
      })}
    </div>
  );
}

function DateRow({ date: d, running, place, href }: { date: Session; running: boolean; place: string; href: string }) {
  const sold = d.sold ?? 0;
  const left = d.left ?? 0;
  const when = running && d.endsAt ? `until ${shortDay(d.endsAt)}` : d.startsAt ? timeOf(d.startsAt) : "";
  const tag = STATUS_TAG[d.status];
  return (
    <li>
      <Link href={href} className="he-row">
        <span className="he-row__main">
          <span className="he-row__label">{d.label}</span>
          <span className="he-row__meta">
            {[when, place].filter(Boolean).join(" · ")}
            {tag && <span className="he-tag">{tag}</span>}
          </span>
        </span>
        <span className="he-row__seats">
          <span className={left > 0 ? "he-row__left" : "he-row__left he-row__left--out"}>{leftText(left)}</span>
          <span className="he-row__sold">
            {sold} / {d.seats} sold
          </span>
        </span>
      </Link>
    </li>
  );
}

const CSS = `
.he-upcoming { max-width: 720px; }
.he-upcoming__filter { display: flex; gap: 8px; margin: 0 0 16px; overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
.he-upcoming__filter::-webkit-scrollbar { display: none; }
.he-chip { flex: none; display: inline-flex; align-items: center; min-height: 36px; padding: 0 14px; border-radius: 18px;
  border: 1px solid var(--theme-elevation-150); background: var(--theme-elevation-0); color: var(--theme-elevation-800);
  font-size: 14px; text-decoration: none; white-space: nowrap; }
.he-chip[aria-current="true"] { background: var(--theme-elevation-800); border-color: var(--theme-elevation-800); color: var(--theme-elevation-0); }
.he-upcoming__fold { cursor: pointer; padding: 6px 0; }
.he-upcoming__empty { color: var(--theme-elevation-500); }
.he-upcoming__day { margin: 0 0 20px; }
.he-upcoming__dayTitle { margin: 0 0 6px; font-size: 13px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase;
  color: var(--theme-elevation-500); }
.he-upcoming__list { list-style: none; margin: 0; padding: 0; border: 1px solid var(--theme-elevation-100); border-radius: 8px; overflow: hidden; }
.he-upcoming__list li + li { border-top: 1px solid var(--theme-elevation-100); }
.he-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: center; min-height: 56px;
  padding: 10px 12px; color: inherit; text-decoration: none; background: var(--theme-elevation-0); }
.he-row:active, .he-row:hover { background: var(--theme-elevation-50); }
.he-row__main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.he-row__label { font-size: 15px; font-weight: 500; line-height: 1.3; overflow-wrap: anywhere; }
.he-row__meta { font-size: 13px; color: var(--theme-elevation-500); line-height: 1.3; }
.he-row__seats { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; text-align: right; white-space: nowrap; }
.he-row__left { font-size: 16px; font-weight: 700; color: var(--theme-success-750, var(--theme-elevation-900)); }
.he-row__left--out { color: var(--theme-error-650, #b42318); }
.he-row__sold { font-size: 13px; color: var(--theme-elevation-500); font-variant-numeric: tabular-nums; }
.he-tag { display: inline-block; margin-left: 6px; padding: 0 6px; border-radius: 4px; font-size: 12px;
  background: var(--theme-elevation-100); color: var(--theme-elevation-700); }
`;

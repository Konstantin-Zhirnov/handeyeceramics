import Link from "next/link";
import type { UIFieldServerComponent } from "payload";
import { availabilityOf } from "../../lib/booking/availability";
import { STUDENT_STATUS, studentRows } from "./upcoming";

/**
 * The students of a class date, on the date itself (R01.1): who holds a seat
 * (paid or added by hand) and who was refunded, read-only, with the seats as
 * lib/booking/availability counts them. Each name opens its registration.
 */
export const SessionStudents: UIFieldServerComponent = async ({ id, data, payload, req }) => {
  const admin = payload.config.routes.admin;
  if (!id) return <p style={{ color: "var(--theme-elevation-500)" }}>The students show here once the date is saved.</p>;
  const sessionId = Number(id);
  const [registrations, counts] = await Promise.all([
    payload.find({
      collection: "registrations",
      where: { session: { equals: sessionId } },
      sort: "createdAt",
      depth: 0,
      limit: 0,
      pagination: false,
      select: { name: true, status: true, order: true },
      overrideAccess: false,
      user: req.user,
    }),
    availabilityOf([{ id: sessionId, seats: typeof data?.seats === "number" ? data.seats : 0 }], payload),
  ]);
  const seats = counts.get(sessionId)!;
  const rows = studentRows(registrations.docs);
  const summary = [`${seats.sold} of ${seats.seats} seats taken`, seats.left > 0 ? `${seats.left} left` : "sold out"];
  if (seats.held) summary.push(`${seats.held} held in an open checkout`);

  return (
    <div className="field-type he-students" style={{ marginBottom: "var(--base)" }}>
      <style>{CSS}</style>
      <div className="he-students__head">
        <span className="he-students__title">Students</span>
        <span className="he-students__summary">{summary.join(" · ")}</span>
      </div>
      {rows.length ? (
        <ul className="he-students__list">
          {rows.map((r) => (
            <li key={r.key}>
              <Link href={`${admin}/collections/registrations/${r.id}`} className="he-student">
                <span className={r.status === "refunded" ? "he-student__name he-student__name--off" : "he-student__name"}>{r.name}</span>
                {r.seats > 1 && <span className="he-student__seats">×{r.seats}</span>}
                <span className="he-student__status">{STUDENT_STATUS[r.status] || r.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="he-students__empty">No students yet.</p>
      )}
      <Link href={`${admin}/collections/registrations?where[session][equals]=${sessionId}`} className="he-students__all">
        Open in Students
      </Link>
    </div>
  );
};

const CSS = `
.he-students__head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; margin-bottom: 8px; }
.he-students__title { font-size: 16px; font-weight: 600; }
.he-students__summary { font-size: 14px; color: var(--theme-elevation-600); }
.he-students__list { list-style: none; margin: 0 0 8px; padding: 0; border: 1px solid var(--theme-elevation-100); border-radius: 8px; overflow: hidden; }
.he-students__list li + li { border-top: 1px solid var(--theme-elevation-100); }
.he-student { display: flex; align-items: center; gap: 8px; min-height: 48px; padding: 8px 12px; color: inherit; text-decoration: none; }
.he-student:active, .he-student:hover { background: var(--theme-elevation-50); }
.he-student__name { flex: 1 1 auto; min-width: 0; font-size: 15px; overflow-wrap: anywhere; }
.he-student__name--off { color: var(--theme-elevation-500); text-decoration: line-through; }
.he-student__seats { font-weight: 600; font-variant-numeric: tabular-nums; }
.he-student__status { flex: none; font-size: 12px; padding: 1px 6px; border-radius: 4px; background: var(--theme-elevation-100); color: var(--theme-elevation-700); }
.he-students__empty { margin: 0 0 8px; color: var(--theme-elevation-500); }
.he-students__all { font-size: 14px; }
`;

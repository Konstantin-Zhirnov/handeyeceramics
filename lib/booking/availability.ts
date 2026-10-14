/**
 * Seats of a class date (R01): what is left is the seats minus the students
 * who hold a seat (paid, or added by hand) minus the holds that have not
 * expired. One function, used by the cart, the checkout and the `sold` /
 * `left` fields of the sessions collection, so that every count agrees.
 *
 * `availabilityOf` counts a whole set of dates in two queries, for the list
 * of dates in the admin (R01.1): a page of a hundred dates costs the same as one.
 */
import type { Payload, PayloadRequest } from "payload";
import type { Session } from "../../payload-types";

export type Availability = { seats: number; sold: number; held: number; left: number };

/** The students who hold a seat: a paid one, or one the editor added by hand. A refunded student holds none. */
export const SEATED_STATUSES = ["confirmed", "imported"] as const;

/** The CMS, when the caller has none at hand: loaded lazily so that the collections may import this module. */
async function cms(): Promise<Payload> {
  const [{ getPayload }, { default: config }] = await Promise.all([import("payload"), import("../../payload.config")]);
  return getPayload({ config });
}

const relId = (v: number | { id: number } | null | undefined): number | undefined =>
  typeof v === "object" && v ? v.id : (v ?? undefined);

/**
 * The seats of every date in the set, by id. `req` — a request carrying a
 * `transactionID`: the booking code counts inside its own transaction, so
 * the count sees the holds it has just written.
 */
export async function availabilityOf(
  sessions: Pick<Session, "id" | "seats">[],
  payload?: Payload,
  now = new Date(),
  req?: Partial<PayloadRequest>,
): Promise<Map<number, Availability>> {
  const out = new Map<number, Availability>();
  if (!sessions.length) return out;
  const p = payload || (await cms());
  const ids = sessions.map((s) => s.id);
  const common = { limit: 0, pagination: false, depth: 0, overrideAccess: true, req: req as PayloadRequest | undefined } as const;
  const [registrations, holds] = await Promise.all([
    p.find({
      collection: "registrations",
      where: { and: [{ session: { in: ids } }, { status: { in: [...SEATED_STATUSES] } }] },
      select: { session: true },
      ...common,
    }),
    p.find({
      collection: "holds",
      where: { and: [{ session: { in: ids } }, { expiresAt: { greater_than: now.toISOString() } }] },
      select: { session: true, quantity: true },
      ...common,
    }),
  ]);
  const sold = new Map<number, number>();
  for (const r of registrations.docs) {
    const id = relId(r.session)!;
    sold.set(id, (sold.get(id) || 0) + 1);
  }
  const held = new Map<number, number>();
  for (const h of holds.docs) {
    const id = relId(h.session)!;
    held.set(id, (held.get(id) || 0) + (h.quantity || 0));
  }
  for (const s of sessions) {
    const seats = s.seats ?? 0;
    const soldHere = sold.get(s.id) || 0;
    const heldHere = held.get(s.id) || 0;
    out.set(s.id, { seats, sold: soldHere, held: heldHere, left: Math.max(0, seats - soldHere - heldHere) });
  }
  return out;
}

/** The seats of one date; see availabilityOf for `req`. */
export async function availability(
  sessionId: number,
  payload?: Payload,
  now = new Date(),
  req?: Partial<PayloadRequest>,
): Promise<Availability> {
  const p = payload || (await cms());
  // The sessions collection counts its own `sold` / `left` on read: the flag stops it here, so the read does not recurse.
  const session = (await p.findByID({
    collection: "sessions",
    id: sessionId,
    depth: 0,
    overrideAccess: true,
    select: { seats: true },
    context: { skipAvailability: true },
    req: req as PayloadRequest | undefined,
  })) as Session | null;
  const counts = await availabilityOf([{ id: sessionId, seats: session?.seats ?? 0 }], p, now, req);
  return counts.get(sessionId)!;
}

/** A date can be bought: open, not over, with a seat left. */
export function isSellable(
  session: Pick<Session, "status" | "endsAt"> & { left?: number | null },
  now = new Date(),
): boolean {
  if (session.status !== "open") return false;
  if (session.endsAt && new Date(session.endsAt).getTime() < now.getTime()) return false;
  return (session.left ?? 0) > 0;
}

/**
 * Seats of a class date (R01): what is left is the seats minus the confirmed
 * registrations minus the holds that have not expired. One function, used by
 * the cart, the checkout and the virtual `sold` / `left` fields of the
 * sessions collection, so that every count agrees.
 */
import type { Payload, PayloadRequest } from "payload";
import type { Session } from "../../payload-types";

export type Availability = { seats: number; sold: number; held: number; left: number };

/** The CMS, when the caller has none at hand: loaded lazily so that the collections may import this module. */
async function cms(): Promise<Payload> {
  const [{ getPayload }, { default: config }] = await Promise.all([import("payload"), import("../../payload.config")]);
  return getPayload({ config });
}

/**
 * `req` — a request carrying a `transactionID`: the booking code counts inside
 * its own transaction, so the count sees the holds it has just written.
 */
export async function availability(
  sessionId: number,
  payload?: Payload,
  now = new Date(),
  req?: Partial<PayloadRequest>,
): Promise<Availability> {
  const p = payload || (await cms());
  // The session's own `sold` / `left` fields call this function: the flag stops them here, so the read does not recurse.
  const session = (await p.findByID({
    collection: "sessions",
    id: sessionId,
    depth: 0,
    overrideAccess: true,
    select: { seats: true },
    context: { skipAvailability: true },
    req: req as PayloadRequest | undefined,
  })) as Session | null;
  const seats = session?.seats ?? 0;
  const [registrations, holds] = await Promise.all([
    p.count({
      collection: "registrations",
      where: { and: [{ session: { equals: sessionId } }, { status: { equals: "confirmed" } }] },
      overrideAccess: true,
      req: req as PayloadRequest | undefined,
    }),
    p.find({
      collection: "holds",
      where: { and: [{ session: { equals: sessionId } }, { expiresAt: { greater_than: now.toISOString() } }] },
      limit: 0,
      pagination: false,
      depth: 0,
      overrideAccess: true,
      req: req as PayloadRequest | undefined,
    }),
  ]);
  const sold = registrations.totalDocs;
  const held = holds.docs.reduce((sum, h) => sum + (h.quantity || 0), 0);
  return { seats, sold, held, left: Math.max(0, seats - sold - held) };
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

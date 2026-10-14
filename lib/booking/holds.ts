/**
 * Seat holds (R17i): a checkout holds its seats for as long as the Checkout
 * session lives, so two buyers cannot pay for the last seat together. One path
 * of writing: the hold is placed inside a database transaction after the count
 * is repeated there; in this process the placing is serialized by a mutex as
 * well, because SQLite runs without transactions (the adapter's default) and
 * the mutex is then the only guard. When an order is paid, `confirmSeats`
 * turns its holds into registrations — one per seat, exactly once.
 */
import type { Payload, PayloadRequest } from "payload";
import type { Order, Session } from "../../payload-types";
import { availability } from "./availability";

export type HoldItem = { sessionId: number; qty: number };
export type HoldResult = { ok: true } | { ok: false; short: { sessionId: number; left: number }[] };

async function cms(): Promise<Payload> {
  const [{ getPayload }, { default: config }] = await Promise.all([import("payload"), import("../../payload.config")]);
  return getPayload({ config });
}

/** One promise chain: the next critical section starts when the previous one has finished, whatever its outcome. */
let queue: Promise<unknown> = Promise.resolve();
export function serialized<T>(work: () => Promise<T>): Promise<T> {
  const run = queue.then(work, work);
  queue = run.catch(() => undefined);
  return run;
}

/** A transaction of the database adapter, when it supports them; null on the default SQLite setup. */
async function begin(payload: Payload): Promise<{ req?: PayloadRequest; commit: () => Promise<void>; rollback: () => Promise<void> }> {
  const id = await payload.db.beginTransaction();
  if (!id) return { commit: async () => undefined, rollback: async () => undefined };
  return {
    req: { transactionID: id } as PayloadRequest,
    commit: () => payload.db.commitTransaction(id),
    rollback: () => payload.db.rollbackTransaction(id),
  };
}

function merged(items: HoldItem[]): HoldItem[] {
  const byId = new Map<number, number>();
  for (const { sessionId, qty } of items) byId.set(sessionId, (byId.get(sessionId) || 0) + qty);
  return [...byId].map(([sessionId, qty]) => ({ sessionId, qty }));
}

/** Holds the seats for `ttlMs` under `ref` (the pending order's id), or holds nothing and says which dates are short. */
export async function holdSeats(items: HoldItem[], ref: string, ttlMs: number, payload?: Payload, now = new Date()): Promise<HoldResult> {
  const p = payload || (await cms());
  const wanted = merged(items).filter((i) => i.qty > 0);
  if (!wanted.length) return { ok: true };
  return serialized(async () => {
    const tx = await begin(p);
    try {
      const short: { sessionId: number; left: number }[] = [];
      for (const { sessionId, qty } of wanted) {
        const { left } = await availability(sessionId, p, now, tx.req);
        if (qty > left) short.push({ sessionId, left });
      }
      if (short.length) {
        await tx.rollback();
        return { ok: false, short };
      }
      const expiresAt = new Date(now.getTime() + ttlMs).toISOString();
      for (const { sessionId, qty } of wanted) {
        await p.create({
          collection: "holds",
          data: { session: sessionId, quantity: qty, ref, expiresAt },
          depth: 0,
          overrideAccess: true,
          req: tx.req,
        });
      }
      await tx.commit();
      return { ok: true };
    } catch (err) {
      await tx.rollback().catch(() => undefined);
      throw err;
    }
  });
}

/** Removes every hold of an order: it expired, it was paid (the seats are registrations now) or it was abandoned. */
export async function releaseHolds(ref: string, payload?: Payload): Promise<void> {
  const p = payload || (await cms());
  await p.delete({ collection: "holds", where: { ref: { equals: ref } }, depth: 0, overrideAccess: true });
}

const relId = (v: number | { id: number } | null | undefined): number | undefined => (typeof v === "object" && v ? v.id : v ?? undefined);

/**
 * Registrations for the seats of a paid order — one per seat, named after the
 * attendee the buyer typed in or the buyer — and the holds removed. Counts the
 * registrations the order already has, so a second call writes nothing.
 */
export async function confirmSeats(orderId: number, payload?: Payload): Promise<void> {
  const p = payload || (await cms());
  await serialized(async () => {
    const order = (await p.findByID({ collection: "orders", id: orderId, depth: 0, overrideAccess: true })) as Order;
    const lines = (order.lines || []).filter((l) => l.kind === "session" && relId(l.session));
    const existing = await p.find({
      collection: "registrations",
      where: { order: { equals: orderId } },
      limit: 0,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    });
    const have = new Map<number, number>();
    for (const r of existing.docs) {
      const sid = relId(r.session)!;
      have.set(sid, (have.get(sid) || 0) + 1);
    }
    const sessionIds = [...new Set(lines.map((l) => relId(l.session)!))];
    const sessions = sessionIds.length
      ? ((
          await p.find({
            collection: "sessions",
            where: { id: { in: sessionIds } },
            limit: 0,
            pagination: false,
            depth: 0,
            overrideAccess: true,
            context: { skipAvailability: true },
          })
        ).docs as Session[])
      : [];
    const byId = new Map(sessions.map((s) => [s.id, s]));
    const name = order.attendee?.trim() || order.customer?.name || undefined;
    for (const line of lines) {
      const sid = relId(line.session)!;
      const session = byId.get(sid);
      const missing = line.quantity - (have.get(sid) || 0);
      for (let i = 0; i < missing; i++) {
        await p.create({
          collection: "registrations",
          data: {
            name,
            email: order.customer?.email || undefined,
            phone: order.customer?.phone || undefined,
            session: sid,
            product: relId(line.product) ?? relId(session?.product),
            studio: relId(session?.studio),
            order: orderId,
            status: "confirmed",
          },
          depth: 0,
          overrideAccess: true,
        });
      }
      have.set(sid, Math.max(have.get(sid) || 0, line.quantity));
    }
    await releaseHolds(String(orderId), p);
  });
}

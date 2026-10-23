/**
 * Gift cards in the CMS: finding a card by its code, taking from its balance
 * for an order and giving it back, issuing the cards an order bought and
 * emailing their codes. The balance is taken when the order is created, by
 * one conditional UPDATE — the same lock the orders use — so two checkouts
 * cannot both spend the last dollar; an order that expires or is abandoned
 * gives it back.
 */
import type { Payload } from "payload";
import type { Giftcard, Order, Product } from "../../payload-types";
import { getCMS } from "../cms/payload";
import { relId } from "../cms/relations";
import { sendGiftCards } from "../mail";
import { affected, literal, table } from "../payments/db";
import { generateGiftCode, giftCents, giftDollars, normalizeGiftCode } from "./code";

export { GIFT_CODE, generateGiftCode, giftAmountAllowed, giftAmountChoices, giftApplied, giftCents, giftDollars, normalizeGiftCode } from "./code";

export async function findGiftCard(code: string, payload?: Payload): Promise<Giftcard | null> {
  const p = payload || (await getCMS());
  const normal = normalizeGiftCode(code);
  if (!normal) return null;
  const res = await p.find({ collection: "giftcards", where: { code: { equals: normal } }, limit: 1, depth: 0, overrideAccess: true });
  return (res.docs[0] as Giftcard | undefined) ?? null;
}

const now = () => new Date().toISOString();

/**
 * Takes `cents` from the card's balance for the order: true when the card was
 * active and had that much; false — nothing changed — when it had not, or is
 * void, or is unknown. The use is noted on the card.
 */
export async function reserveGiftBalance(code: string, cents: number, orderId: number, payload?: Payload): Promise<boolean> {
  const p = payload || (await getCMS());
  const normal = normalizeGiftCode(code);
  if (!normal || !Number.isInteger(cents) || cents <= 0) return false;
  const dollars = giftDollars(cents);
  // Balances are dollars with cents; the comparison is made in cents, rounded, so 0.1 + 0.2 cannot bite.
  const changed = await affected(
    p,
    `UPDATE ${table(p, "giftcards")} SET balance = ROUND(balance - ${dollars}, 2), updated_at = ${literal(now())} ` +
      `WHERE code = ${literal(normal)} AND status = 'active' AND ROUND(balance * 100) >= ${cents}`,
  );
  if (changed !== 1) return false;
  const card = await findGiftCard(normal, p);
  if (card) {
    await p.update({
      collection: "giftcards",
      id: card.id,
      data: { uses: [...(card.uses || []), { at: now(), usedIn: orderId, amount: dollars }] },
      depth: 0,
      overrideAccess: true,
    });
  }
  return true;
}

/** The order is not going to be paid: what it took from its gift card goes back, once. */
export async function restoreGiftBalance(order: Pick<Order, "id" | "giftCard">, payload?: Payload): Promise<void> {
  const code = order.giftCard?.code && normalizeGiftCode(order.giftCard.code);
  const cents = order.giftCard?.amount ?? 0;
  if (!code || cents <= 0) return;
  const p = payload || (await getCMS());
  const card = await findGiftCard(code, p);
  if (!card) return;
  // Already given back (a second expiry, a webhook after the success page): the use is marked, nothing more to do.
  const use = (card.uses || []).find((u) => relId(u.usedIn) === order.id && u.amount > 0);
  if (!use) return;
  await affected(p, `UPDATE ${table(p, "giftcards")} SET balance = ROUND(balance + ${giftDollars(cents)}, 2), updated_at = ${literal(now())} WHERE id = ${card.id}`);
  await p.update({
    collection: "giftcards",
    id: card.id,
    data: { uses: (card.uses || []).map((u) => (u.id === use.id ? { ...u, amount: 0 } : u)) },
    depth: 0,
    overrideAccess: true,
  });
}

/**
 * The cards a paid order bought: one per unit of every gift card line, each
 * with a fresh code and the amount the buyer chose; then one email to the
 * buyer with all the codes. Idempotent: cards already issued for the order
 * are not issued again, and the email goes only with new cards.
 */
export async function issueGiftCards(orderId: number, payload?: Payload): Promise<Giftcard[]> {
  const p = payload || (await getCMS());
  const order = (await p.findByID({ collection: "orders", id: orderId, depth: 0, overrideAccess: true })) as Order;
  const lines = (order.lines || []).filter((l) => l.kind === "product" && relId(l.product));
  if (!lines.length) return [];
  const ids = [...new Set(lines.map((l) => relId(l.product) as number))];
  const products = (await p.find({ collection: "products", where: { id: { in: ids } }, depth: 0, limit: 0, pagination: false, overrideAccess: true })).docs as Product[];
  const giftIds = new Set(products.filter((d) => d.giftCard).map((d) => d.id));
  const wanted = lines.filter((l) => giftIds.has(relId(l.product) as number));
  if (!wanted.length) return [];

  const existing = (await p.find({ collection: "giftcards", where: { order: { equals: order.id } }, depth: 0, limit: 0, pagination: false, overrideAccess: true })).docs as Giftcard[];
  const toIssue = wanted.reduce((n, l) => n + l.quantity, 0) - existing.length;
  const issued: Giftcard[] = [];
  let left = toIssue;
  for (const l of wanted) {
    for (let i = 0; i < l.quantity && left > 0; i++, left--) {
      const amount = giftDollars(l.unitAmount);
      const card = (await p.create({
        collection: "giftcards",
        data: { code: generateGiftCode(), amount, balance: amount, status: "active", buyerEmail: order.customer?.email || undefined, order: order.id },
        depth: 0,
        overrideAccess: true,
      })) as Giftcard;
      issued.push(card);
    }
  }
  if (issued.length && order.customer?.email) {
    await sendGiftCards(order, issued.map((c) => ({ code: c.code, amount: giftCents(c.amount) })), p);
  }
  return issued;
}

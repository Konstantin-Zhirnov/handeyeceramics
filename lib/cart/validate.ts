/**
 * The server's check of a cart (R03.3, R02, R16i): the lines are priced from
 * the CMS as it is now, read as a visitor, so a hidden product or date never
 * prices; the tax follows the pickup studio's province. Used by POST
 * /cart/validate on every show of the cart and by POST /checkout before an
 * order is made.
 */
import type { Payload } from "payload";
import type { Product, Session, Studio } from "../../payload-types";
import { isSellable } from "../booking/availability";
import { getCMS } from "../cms/payload";
import { relId } from "../cms/relations";
import { studioProvince } from "../payments/checkout";
import type { CartLineInput } from "../payments/types";
import { type CartLineSeen, type CartPricedLine, type CatalogItem, cents, priceLine, totals } from "./pricing";

export type CartStudio = { id: number; name: string; province: string };

export type ValidatedCart = {
  lines: CartPricedLine[];
  /** Errors of the cart as a whole; the errors of a line sit on the line. */
  errors: string[];
  subtotal: number;
  tax: number;
  total: number;
  /** The pickup studio the prices were taxed for; null when no studio is published. */
  studio: CartStudio | null;
};

/** The most lines a cart may carry. */
const MAX_LINES = 50;

/** A line as it came from the client, or null when it is not a cart line at all. */
export function parseLine(input: unknown): CartLineSeen | null {
  if (!input || typeof input !== "object") return null;
  const { kind, id, quantity, option, seenAmount } = input as Record<string, unknown>;
  if (kind !== "session" && kind !== "product") return null;
  if (typeof id !== "number" || !Number.isInteger(id) || id < 1) return null;
  const qty = typeof quantity === "number" ? quantity : Number.NaN;
  const line: CartLineSeen = { kind, id, quantity: qty };
  if (typeof option === "string" && option.trim()) line.option = option.trim().slice(0, 200);
  if (typeof seenAmount === "number" && Number.isFinite(seenAmount)) line.seenAmount = seenAmount;
  return line;
}

/** Products the visitor may see, by id, as catalog items. */
async function products(p: Payload, ids: number[]): Promise<Map<number, CatalogItem>> {
  const out = new Map<number, CatalogItem>();
  if (!ids.length) return out;
  const res = await p.find({ collection: "products", where: { id: { in: ids } }, depth: 0, limit: 0, pagination: false, overrideAccess: false });
  const scheduled = await scheduledProducts(p, res.docs.map((d) => d.id));
  for (const d of res.docs as Product[]) {
    const price = typeof d.salePrice === "number" ? d.salePrice : d.price;
    if (typeof price !== "number") continue; // no price in the admin: not for sale online
    out.set(d.id, {
      kind: "product",
      id: d.id,
      label: d.name,
      unitAmount: cents(price),
      taxGroup: d.taxGroup || "service",
      optionTitles: (d.options || []).map((o) => o.title).filter(Boolean),
      scheduled: scheduled.has(d.id),
    });
  }
  return out;
}

/**
 * The products that have class dates of any status — hidden and finished ones
 * too, so a class whose dates are all over is not sold as a plain product.
 * Only the existence is read (with access overridden); nothing of the dates leaks.
 */
export async function scheduledProducts(p: Payload, ids: number[]): Promise<Set<number>> {
  if (!ids.length) return new Set();
  const res = await p.find({
    collection: "sessions",
    where: { product: { in: ids } },
    depth: 0,
    limit: 0,
    pagination: false,
    overrideAccess: true,
    select: { product: true },
    context: { skipAvailability: true },
  });
  return new Set((res.docs as Session[]).map((s) => relId(s.product)!));
}

/** Class dates the visitor may see, by id; the price is the date's own, else its product's. */
async function sessions(p: Payload, ids: number[], now: Date): Promise<Map<number, CatalogItem>> {
  const out = new Map<number, CatalogItem>();
  if (!ids.length) return out;
  const res = await p.find({ collection: "sessions", where: { id: { in: ids } }, depth: 1, limit: 0, pagination: false, overrideAccess: false });
  for (const d of res.docs as Session[]) {
    const product = typeof d.product === "object" ? d.product : null;
    const price = sessionPrice(d, product);
    if (typeof price !== "number") continue;
    out.set(d.id, {
      kind: "session",
      id: d.id,
      label: `${product?.name || "Class"} — ${d.label}`,
      unitAmount: cents(price),
      taxGroup: "service",
      optionTitles: [],
      studio: relId(d.studio),
      left: d.left ?? 0,
      sellable: isSellable(d, now),
    });
  }
  return out;
}

/** The price of a seat on a date: the date's sale price, its price, else the product's current price. */
export function sessionPrice(session: Pick<Session, "price" | "salePrice">, product: Pick<Product, "price" | "salePrice"> | null): number | null {
  if (typeof session.salePrice === "number") return session.salePrice;
  if (typeof session.price === "number") return session.price;
  if (!product) return null;
  if (typeof product.salePrice === "number") return product.salePrice;
  return typeof product.price === "number" ? product.price : null;
}

/**
 * The pickup studio — always a published, open one (the same rule as the list on the cart page):
 * the one asked for, else the studio of the first class date in the cart, else the first open studio.
 */
async function pickupStudio(p: Payload, wanted: number | undefined, fromLines: number | undefined): Promise<CartStudio | null> {
  const res = await p.find({ collection: "studios", depth: 0, limit: 0, pagination: false, overrideAccess: false, sort: "createdAt" });
  const docs = (res.docs as Studio[]).filter((s) => s.status === "open");
  const studio = docs.find((s) => s.id === wanted) || docs.find((s) => s.id === fromLines) || docs[0];
  return studio ? { id: studio.id, name: studio.name, province: studioProvince(studio) } : null;
}

export async function validateCart(
  input: unknown[],
  pickupStudioId?: number,
  payload?: Payload,
  now = new Date(),
): Promise<ValidatedCart> {
  const p = payload || (await getCMS());
  const errors: string[] = [];
  const parsed = input.slice(0, MAX_LINES).map(parseLine);
  if (input.length > MAX_LINES) errors.push(`A cart holds at most ${MAX_LINES} lines`);
  const lines = parsed.filter((l): l is CartLineSeen => l !== null);
  if (lines.length < parsed.length) errors.push("Some lines could not be read and were dropped");
  if (!lines.length) errors.push("Your cart is empty");

  const [productItems, sessionItems] = await Promise.all([
    products(p, [...new Set(lines.filter((l) => l.kind === "product").map((l) => l.id))]),
    sessions(p, [...new Set(lines.filter((l) => l.kind === "session").map((l) => l.id))], now),
  ]);
  const firstStudio = lines.map((l) => (l.kind === "session" ? sessionItems.get(l.id)?.studio : undefined)).find(Boolean);
  const studio = await pickupStudio(p, pickupStudioId, firstStudio);
  if (!studio) errors.push("No studio is open for pickup");

  const priced = lines.map((l) => priceLine(l, (l.kind === "product" ? productItems : sessionItems).get(l.id), studio?.province || ""));
  return { lines: priced, errors, ...totals(priced), studio };
}

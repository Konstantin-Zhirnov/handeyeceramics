/**
 * The pure part of the cart check: a line's current price and tax, the totals.
 * Money is in integer cents; the tax of a line is rounded once, to the cent,
 * on the line's amount (not per unit). No CMS here — validate.ts reads the
 * catalog and hands each line its item.
 */
import { type GiftOffer, giftAmountAllowed } from "../giftcards/code";
import { ratesFor } from "../payments/tax";
import type { CartLineInput, PricedLine, TaxGroup } from "../payments/types";

/** The most seats or pieces one line may hold. */
export const MAX_QUANTITY = 20;

/** What the catalog knows of a product or a class date, as the cart needs it. */
export type CatalogItem = {
  kind: "session" | "product";
  id: number;
  label: string;
  /** The price a visitor pays now, in cents. */
  unitAmount: number;
  taxGroup: TaxGroup;
  /** Titles of the product's options: one of each must be chosen. */
  optionTitles: string[];
  /** A product with class dates (of any status) is sold by the date, never as a plain product. */
  scheduled?: boolean;
  /** The studio a class date runs at. */
  studio?: number;
  /** Seats left on a date; undefined for a product. */
  left?: number;
  /** A date that is open, not over, with a seat left. */
  sellable?: boolean;
  /** A gift card product: the buyer names the amount (`line.amount`), within this offer; no tax. */
  gift?: GiftOffer;
};

/** The error of a line, if any; undefined when it may be bought as asked. */
function errorOf(line: CartLineInput, item: CatalogItem | undefined): string | undefined {
  if (!item) return "This item is no longer available";
  if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_QUANTITY) {
    return `Quantity must be between 1 and ${MAX_QUANTITY}`;
  }
  if (item.kind === "product" && item.scheduled) return "Choose a date";
  if (item.gift && !giftAmountAllowed(line.amount ?? Number.NaN, item.gift)) return "Choose an amount";
  if (item.optionTitles.length && !(line.option || "").trim()) {
    return `Choose ${item.optionTitles.join(" and ")}`;
  }
  if (item.kind === "session") {
    const left = item.left ?? 0;
    if (left < 1) return "Sold out";
    if (!item.sellable) return "This date is closed";
    if (line.quantity > left) return `Only ${left} seat${left === 1 ? "" : "s"} left`;
  }
  return undefined;
}

/** A line as the browser sends it: with the price it last showed, so the server can say whether it moved. */
export type CartLineSeen = CartLineInput & { seenAmount?: number };
/** `priceChanged` — the admin's price differs from the one the browser last showed (R03.3). */
export type CartPricedLine = PricedLine & { priceChanged?: boolean };

/** One line of the cart with its current price, its tax by the pickup province, and its error. */
export function priceLine(line: CartLineSeen, item: CatalogItem | undefined, province: string): CartPricedLine {
  const error = errorOf(line, item);
  // A gift card is worth what the buyer loads on it; the catalog's price is not consulted.
  const unitAmount = item?.gift ? (line.amount ?? 0) : (item?.unitAmount ?? 0);
  const priceChanged = !error && !!item && !item.gift && typeof line.seenAmount === "number" && line.seenAmount !== item.unitAmount;
  const taxLines = item ? ratesFor(province, item.taxGroup) : [];
  const amount = item ? unitAmount * line.quantity : 0;
  // Each rate is rounded to the cent on its own and the cents are added — the way Stripe applies each tax_rate.
  const taxAmount = taxLines.reduce((sum, t) => sum + Math.round((amount * t.percentage) / 100), 0);
  return {
    kind: line.kind,
    id: line.id,
    quantity: line.quantity,
    ...(line.option ? { option: line.option } : {}),
    ...(item?.gift && typeof line.amount === "number" ? { amount: line.amount } : {}),
    label: item?.label || "",
    unitAmount,
    taxGroup: item?.taxGroup || "exempt",
    taxLines,
    taxAmount: error ? 0 : taxAmount,
    ...(item?.studio ? { studio: item.studio } : {}),
    ...(error ? { error } : {}),
    ...(priceChanged ? { priceChanged } : {}),
  };
}

/** Subtotal, tax and total of the lines that may be bought; a line with an error counts for nothing. */
export function totals(lines: PricedLine[]): { subtotal: number; tax: number; total: number } {
  let subtotal = 0;
  let tax = 0;
  for (const l of lines) {
    if (l.error) continue;
    subtotal += l.unitAmount * l.quantity;
    tax += l.taxAmount;
  }
  return { subtotal, tax, total: subtotal + tax };
}

/** Dollars of the CMS → cents of an order. */
export const cents = (dollars: number | null | undefined) => Math.round((dollars || 0) * 100);

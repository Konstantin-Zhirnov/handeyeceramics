/**
 * The CSV files an editor downloads (R26i, R09.1): the pure part — cells,
 * rows, and how an order or a student becomes a row. No CMS here; the routes
 * read the documents and hand them over.
 *
 * Money is written in dollars with two decimals and no currency sign, so a
 * spreadsheet sums it. The tax and the total of a line are the stored ones;
 * GST and PST are a breakdown by today's rates (each rounded to the cent on
 * the line's amount, as the cart did), and `tax_check` names the stored tax
 * when the breakdown does not add up to it (a rate changed since the sale).
 *
 * A cell that a spreadsheet would run as a formula (`=`, `+`, `-`, `@`, a tab
 * or a return first) gets an apostrophe in front: names, options and labels
 * come from strangers (OWASP: CSV injection).
 */
// Relative imports: the unit tests load this module under vitest, which knows no "@/" alias.
import { studioProvince } from "../../../lib/payments/checkout";
import { ratesFor } from "../../../lib/payments/tax";
import type { Order, Registration, Studio } from "../../../payload-types";

export type Cell = string | number | null | undefined;

/** A cell the RFC 4180 way: quoted when it holds a comma, a quote or a line break; quotes doubled. */
export function csvCell(value: Cell): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" && /^[=+\-@\t\r]/.test(value) ? `'${value}` : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Rows → the file: a UTF-8 byte-order mark (so Excel reads accents), CRLF after every row. */
export function toCSV(rows: Cell[][]): string {
  return "﻿" + rows.map((row) => row.map(csvCell).join(",") + "\r\n").join("");
}

const dollars = (cents: number) => (cents / 100).toFixed(2);

/** What the accountant calls a line: a seat on a class date, merchandise, or a membership plan. */
const KIND: Record<string, string> = { session: "class", product: "merch", plan: "membership" };

export const ORDER_COLUMNS = [
  "order_number", "paid_at", "status", "customer_email", "kind", "label", "option", "qty",
  "unit_price", "gst", "pst", "line_total", "pickup_studio", "stripe_payment_id", "tax_check",
] as const;

/** Orders as the Local API returns them at depth 1: the pickup studio is a document, the lines are inline. */
export function orderRows(orders: Order[]): Cell[][] {
  const rows: Cell[][] = [[...ORDER_COLUMNS]];
  for (const order of orders) {
    const studio = typeof order.pickupStudio === "object" ? (order.pickupStudio as Studio | null) : null;
    const province = studioProvince(studio);
    for (const line of order.lines || []) {
      const amount = line.unitAmount * line.quantity;
      const taxAmount = line.taxAmount ?? 0;
      const lineTotal = line.lineTotal ?? amount + taxAmount;
      const byCode: Record<string, number> = {};
      // A line without a group is a service, as the checkout treats it.
      for (const rate of ratesFor(province, line.taxGroup || "service")) {
        byCode[rate.code] = Math.round((amount * rate.percentage) / 100);
      }
      const gst = byCode.GST || 0;
      const pst = byCode.PST || 0;
      rows.push([
        order.number || "",
        order.paidAt || "",
        order.status,
        order.customer?.email || "",
        KIND[line.kind] || line.kind,
        line.label,
        line.option || "",
        line.quantity,
        dollars(line.unitAmount),
        dollars(gst),
        dollars(pst),
        dollars(lineTotal),
        studio?.name || "",
        order.stripePaymentIntentId || "",
        gst + pst === taxAmount ? "" : `stored tax ${dollars(taxAmount)}`,
      ]);
    }
  }
  return rows;
}

export const REGISTRATION_COLUMNS = ["name", "email", "phone", "status", "order_number", "paid_at"] as const;

/** Students as the Local API returns them at depth 1: the order, when there is one, is a document. */
export function registrationRows(registrations: Registration[]): Cell[][] {
  const rows: Cell[][] = [[...REGISTRATION_COLUMNS]];
  for (const r of registrations) {
    const order = typeof r.order === "object" ? (r.order as Order | null) : null;
    rows.push([r.name || "", r.email || "", r.phone || "", r.status, order?.number || "", order?.paidAt || ""]);
  }
  return rows;
}

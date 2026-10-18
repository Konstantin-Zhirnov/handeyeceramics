/**
 * The sums of an invoice (private groups, corporate events, families): the
 * lines the owner types in dollars become cents, each line is taxed by the
 * province of the studio the way the cart taxes it — every rate rounded to the
 * cent on the line's amount — and the payments recorded against the invoice
 * (card payments through Checkout, e-transfers marked by hand) give what is
 * still due. Pure: the collection's hook and the invoice page call it.
 */
import { cents } from "../cart/pricing";
import { ratesFor } from "../payments/tax";
import type { TaxGroup } from "../payments/types";

export type InvoiceLineInput = {
  description?: string | null;
  quantity?: number | null;
  /** Dollars; negative for a discount. */
  unitPrice?: number | null;
  taxGroup?: TaxGroup | null;
};

/** Dollars; negative for money given back. */
export type InvoicePaymentInput = { amount?: number | null };

export type InvoiceStatus = "open" | "partially_paid" | "paid" | "void";

export type InvoiceTax = { code: "GST" | "PST"; percentage: number; amount: number };

export type InvoiceTotals = {
  /** Per line, in cents: before tax, and its tax. */
  lines: { amount: number; tax: number }[];
  subtotal: number;
  /** The tax by rate, for the invoice page: "GST 5%", "PST 7%". */
  taxes: InvoiceTax[];
  tax: number;
  total: number;
  paid: number;
  /** Total less paid; below zero when more was paid than is owed. */
  due: number;
  status: InvoiceStatus;
};

/** A quantity may be fractional (hours, kilos); its amount is rounded to the cent once. */
function lineAmount(line: InvoiceLineInput): number {
  const quantity = typeof line.quantity === "number" && Number.isFinite(line.quantity) ? line.quantity : 0;
  return Math.round(cents(line.unitPrice) * quantity);
}

export function invoiceTotals(
  lines: InvoiceLineInput[] | null | undefined,
  province: string,
  payments: InvoicePaymentInput[] | null | undefined,
  voided = false,
): InvoiceTotals {
  const taxes = new Map<string, InvoiceTax>();
  const perLine = (lines || []).map((line) => {
    const amount = lineAmount(line);
    let tax = 0;
    for (const rate of ratesFor(province, line.taxGroup || "service")) {
      const part = Math.round((amount * rate.percentage) / 100);
      tax += part;
      const key = `${rate.code}:${rate.percentage}`;
      const sum = taxes.get(key) || { code: rate.code, percentage: rate.percentage, amount: 0 };
      sum.amount += part;
      taxes.set(key, sum);
    }
    return { amount, tax };
  });
  const subtotal = perLine.reduce((s, l) => s + l.amount, 0);
  const tax = perLine.reduce((s, l) => s + l.tax, 0);
  const total = subtotal + tax;
  const paid = (payments || []).reduce((s, p) => s + cents(p.amount), 0);
  const due = total - paid;
  const status: InvoiceStatus = voided ? "void" : total > 0 && due <= 0 ? "paid" : paid > 0 ? "partially_paid" : "open";
  return {
    lines: perLine,
    subtotal,
    taxes: [...taxes.values()].filter((t) => t.amount !== 0).sort((a, b) => a.code.localeCompare(b.code)),
    tax,
    total,
    paid,
    due,
    status,
  };
}

/** Where an invoice without a studio is taxed: every studio that invoices today is in British Columbia. */
export const INVOICE_DEFAULT_PROVINCE = "BC";

/** "INV-00042" from the id, set once the row exists. */
export function invoiceNumber(id: number): string {
  return `INV-${String(id).padStart(5, "0")}`;
}

/** What the owner and the client read for a status. */
export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  open: "Not paid",
  partially_paid: "Partly paid",
  paid: "Paid",
  void: "Void",
};

/** The token of the client's link: letters, digits, "-" and "_", long enough not to be guessed. */
export const INVOICE_TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

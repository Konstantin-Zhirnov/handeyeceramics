/**
 * The sums of an invoice: lines typed in dollars become cents, each line is
 * taxed by the studio's province the way the cart taxes it, the payments give
 * the balance, and the status follows from them.
 */
import { describe, expect, it } from "vitest";
import { INVOICE_TOKEN, invoiceNumber, invoiceTotals } from "../../lib/invoices/totals";
import { invoicePaidLetter } from "../../lib/payments/invoices";
import type { Invoice } from "../../payload-types";

describe("invoiceTotals", () => {
  it("a class for a group in BC: GST only, rounded per line", () => {
    const t = invoiceTotals([{ description: "Private wheel workshop", quantity: 12, unitPrice: 65, taxGroup: "service" }], "BC", []);
    expect(t).toMatchObject({ subtotal: 78000, tax: 3900, total: 81900, paid: 0, due: 81900, status: "open" });
    expect(t.taxes).toEqual([{ code: "GST", percentage: 5, amount: 3900 }]);
  });

  it("goods take GST and PST; a discount line lowers the sum and its tax", () => {
    const t = invoiceTotals(
      [
        { description: "Clay", quantity: 2, unitPrice: 33.33, taxGroup: "goods" },
        { description: "Workshop", quantity: 1, unitPrice: 500, taxGroup: "service" },
        { description: "Discount", quantity: 1, unitPrice: -50, taxGroup: "service" },
      ],
      "BC",
      [],
    );
    // 66.66 → GST 3.33, PST 4.67; 500 → GST 25; -50 → GST -2.50
    expect(t.lines).toEqual([
      { amount: 6666, tax: 800 },
      { amount: 50000, tax: 2500 },
      { amount: -5000, tax: -250 },
    ]);
    expect(t.taxes).toEqual([
      { code: "GST", percentage: 5, amount: 2583 },
      { code: "PST", percentage: 7, amount: 467 },
    ]);
    expect(t.total).toBe(6666 + 50000 - 5000 + 800 + 2500 - 250);
  });

  it("an exempt line has no tax; a fractional quantity is rounded to the cent once", () => {
    const t = invoiceTotals([{ description: "Studio hours", quantity: 1.5, unitPrice: 33.33, taxGroup: "exempt" }], "BC", []);
    expect(t).toMatchObject({ subtotal: 5000, tax: 0, total: 5000, taxes: [] });
  });

  it("payments give the balance and the status: partly paid, paid, overpaid", () => {
    const lines = [{ description: "Event", quantity: 1, unitPrice: 100, taxGroup: "service" as const }];
    expect(invoiceTotals(lines, "BC", [{ amount: 50 }])).toMatchObject({ paid: 5000, due: 5500, status: "partially_paid" });
    expect(invoiceTotals(lines, "BC", [{ amount: 50 }, { amount: 55 }])).toMatchObject({ due: 0, status: "paid" });
    expect(invoiceTotals(lines, "BC", [{ amount: 120 }])).toMatchObject({ due: -1500, status: "paid" });
    expect(invoiceTotals(lines, "BC", [{ amount: 105 }, { amount: -105 }])).toMatchObject({ paid: 0, status: "open" });
  });

  it("a void invoice is void whatever was paid", () => {
    const lines = [{ description: "Event", quantity: 1, unitPrice: 100, taxGroup: "service" as const }];
    expect(invoiceTotals(lines, "BC", [], true).status).toBe("void");
  });

  it("Alberta: GST only, even on goods", () => {
    const t = invoiceTotals([{ description: "Clay", quantity: 1, unitPrice: 100, taxGroup: "goods" }], "AB", []);
    expect(t.taxes).toEqual([{ code: "GST", percentage: 5, amount: 500 }]);
  });

  it("an empty invoice owes nothing and is not paid", () => {
    expect(invoiceTotals([], "BC", [])).toMatchObject({ total: 0, due: 0, status: "open" });
  });
});

describe("invoice identifiers", () => {
  it("numbers and tokens", () => {
    expect(invoiceNumber(42)).toBe("INV-00042");
    expect(INVOICE_TOKEN.test("AbC_def-1234567890xyzQ")).toBe(true);
    for (const bad of ["short", "has space in it here!!", "../../../etc/passwd/aaaaaaaaaa"]) expect(INVOICE_TOKEN.test(bad)).toBe(false);
  });
});

describe("invoicePaidLetter", () => {
  it("names the client, the amount, what is left and the admin link", () => {
    const letter = invoicePaidLetter(
      { id: 7, number: "INV-00007", customer: { name: "Pat", company: "Acme" }, due: 2500 } as Invoice,
      500,
      "https://example.com",
    );
    expect(letter.subject).toBe("Invoice INV-00007 paid: CA$500.00");
    expect(letter.text).toContain("Pat, Acme paid CA$500.00 by card on invoice INV-00007.");
    expect(letter.text).toContain("Still due: CA$25.00.");
    expect(letter.text).toContain("https://example.com/admin/collections/invoices/7");
  });
});

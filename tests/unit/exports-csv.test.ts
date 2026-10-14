/**
 * The CSV the accountant downloads (R26i, R09.1): cells with commas, quotes
 * and line breaks are quoted the RFC 4180 way, and an order becomes one row
 * per line with GST and PST as separate amounts in dollars.
 */
import { describe, expect, it } from "vitest";
import { orderRows, registrationRows, toCSV } from "../../app/(site)/exports/csv";

describe("toCSV", () => {
  it("a cell that a spreadsheet would run as a formula is prefixed with an apostrophe", () => {
    const text = toCSV([['=HYPERLINK("http://evil.example","click")', "+1", "-5", "@sum", "\tx", "604-000-0000", -5]]);
    expect(text).toBe('\uFEFF"\'=HYPERLINK(""http://evil.example"",""click"")",\'+1,\'-5,\'@sum,\'\tx,604-000-0000,-5\r\n');
  });

  it("quotes commas, doubles quotes, keeps line breaks, ends every row with CRLF", () => {
    const text = toCSV([
      ["a", "b", "c", "d", "e"],
      ["x,y", 'he said "hi"', "two\nlines", 12, null],
    ]);
    expect(text).toBe('﻿a,b,c,d,e\r\n"x,y","he said ""hi""","two\nlines",12,\r\n');
  });
});

describe("orderRows", () => {
  const order = {
    id: 7,
    number: "HE-000007",
    status: "paid",
    paidAt: "2026-10-20T19:05:00.000Z",
    customer: { name: "Ada", email: "ada@example.com" },
    pickupStudio: { id: 1, name: "Chinatown", address: "1 Test St\nVancouver, BC V6A 1A1", region: "Vancouver, BC" },
    stripePaymentIntentId: "pi_123",
    lines: [
      { kind: "session", label: "Hand building — Thu", quantity: 1, unitAmount: 10000, taxGroup: "service", taxAmount: 500 },
      { kind: "product", label: "Clay bag", option: "Size: 10 kg", quantity: 2, unitAmount: 1234, taxGroup: "goods", taxAmount: 296, lineTotal: 2764 },
      { kind: "plan", label: "Membership", quantity: 1, unitAmount: 20000, taxGroup: "exempt", taxAmount: 0 },
    ],
  };

  it("one row per line: kind, amounts in dollars, GST and PST apart, the studio and the Stripe payment", () => {
    const [header, ...rows] = orderRows([order as never]);
    expect(header).toEqual([
      "order_number", "paid_at", "status", "customer_email", "kind", "label", "option", "qty",
      "unit_price", "gst", "pst", "line_total", "pickup_studio", "stripe_payment_id", "tax_check",
    ]);
    expect(rows).toEqual([
      ["HE-000007", "2026-10-20T19:05:00.000Z", "paid", "ada@example.com", "class", "Hand building — Thu", "", 1, "100.00", "5.00", "0.00", "105.00", "Chinatown", "pi_123", ""],
      // 2 × 12.34 = 24.68; GST 5% = 1.234 → 1.23, PST 7% = 1.7276 → 1.73
      ["HE-000007", "2026-10-20T19:05:00.000Z", "paid", "ada@example.com", "merch", "Clay bag", "Size: 10 kg", 2, "12.34", "1.23", "1.73", "27.64", "Chinatown", "pi_123", ""],
      ["HE-000007", "2026-10-20T19:05:00.000Z", "paid", "ada@example.com", "membership", "Membership", "", 1, "200.00", "0.00", "0.00", "200.00", "Chinatown", "pi_123", ""],
    ]);
  });

  it("an order without a pickup studio or a payment has empty cells, not 'undefined'", () => {
    const [, row] = orderRows([{ ...order, pickupStudio: null, stripePaymentIntentId: null, lines: [order.lines[0]] } as never]);
    expect(row.slice(-3, -1)).toEqual(["", ""]);
  });

  it("a line without a tax group is a service (GST only), as the checkout treats it", () => {
    const [, row] = orderRows([{ ...order, lines: [{ kind: "session", label: "Date", quantity: 1, unitAmount: 10000, taxAmount: 500 }] } as never]);
    expect(row.slice(9, 12)).toEqual(["5.00", "0.00", "105.00"]);
    expect(row.at(-1)).toBe("");
  });

  it("when the rates of today differ from the tax the order stored, tax_check names the stored amount", () => {
    const [, row] = orderRows([{ ...order, lines: [{ kind: "product", label: "Old rate", quantity: 1, unitAmount: 10000, taxGroup: "goods", taxAmount: 1100 }] } as never]);
    // line_total is the stored amount, never recomputed; GST/PST are today's breakdown and do not add up
    expect(row.slice(9, 12)).toEqual(["5.00", "7.00", "111.00"]);
    expect(row.at(-1)).toBe("stored tax 11.00");
  });
});

describe("registrationRows", () => {
  it("name, email, phone, status and the order's number and date; a student added by hand has no order", () => {
    const rows = registrationRows([
      { name: 'O\'Brien, "Pat"', email: "pat@example.com", phone: "604-000-0000", status: "confirmed", order: { number: "HE-000007", paidAt: "2026-10-20T19:05:00.000Z" } },
      { name: "Walk In", email: null, phone: null, status: "imported", order: null },
    ] as never);
    expect(rows).toEqual([
      ["name", "email", "phone", "status", "order_number", "paid_at"],
      ['O\'Brien, "Pat"', "pat@example.com", "604-000-0000", "confirmed", "HE-000007", "2026-10-20T19:05:00.000Z"],
      ["Walk In", "", "", "imported", "", ""],
    ]);
  });
});

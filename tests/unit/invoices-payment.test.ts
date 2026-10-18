/**
 * An invoice of the admin through the fake gateway: created with a number and
 * a link token, edited without the link changing, paid by card for what is
 * due, the payment written once however many times the invoice page and the
 * webhook ask, and the balance after a later edit. A throw-away SQLite base.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Invoice } from "../../payload-types";
import { tempCMS, type TempCMS } from "./payments-harness";

let cms: TempCMS;
const ORIGIN = "http://localhost:3311";

beforeAll(async () => {
  cms = await tempCMS();
}, 180_000);

afterAll(async () => {
  await cms?.stop();
});

const read = async (id: number) => (await cms.payload.findByID({ collection: "invoices", id, depth: 0, overrideAccess: true })) as Invoice;

async function newInvoice(): Promise<Invoice> {
  const created = (await cms.payload.create({
    collection: "invoices",
    data: {
      status: "open",
      customer: { name: "Pat Client", company: "Acme", email: "pat@example.com" },
      lines: [{ description: "Private wheel workshop", quantity: 10, unitPrice: 60, taxGroup: "service" }],
    },
    overrideAccess: true,
    depth: 0,
  })) as Invoice;
  return read(created.id);
}

describe("invoices", () => {
  it("gets a number, a link token and its sums on create; an edit keeps the token and moves the sums", async () => {
    const invoice = await newInvoice();
    expect(invoice.number).toBe(`INV-${String(invoice.id).padStart(5, "0")}`);
    expect(invoice.token).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(invoice).toMatchObject({ subtotal: 60000, tax: 3000, total: 63000, paid: 0, due: 63000, status: "open" });

    const edited = (await cms.payload.update({
      collection: "invoices",
      id: invoice.id,
      data: { lines: [{ description: "Private wheel workshop", quantity: 12, unitPrice: 60, taxGroup: "service" }], token: "attempt-to-change-the-link-token" },
      overrideAccess: false,
      user: await editor(),
      depth: 0,
    })) as Invoice;
    expect(edited.token).toBe(invoice.token);
    expect(edited).toMatchObject({ total: 75600, due: 75600, status: "open" });
  }, 60_000);

  it("an e-transfer marked by hand pays part of it", async () => {
    const invoice = await newInvoice();
    const updated = (await cms.payload.update({
      collection: "invoices",
      id: invoice.id,
      data: { payments: [{ at: new Date().toISOString(), amount: 300, method: "e-transfer" }] },
      overrideAccess: true,
      depth: 0,
    })) as Invoice;
    expect(updated).toMatchObject({ paid: 30000, due: 33000, status: "partially_paid" });
  }, 60_000);

  it("is paid by card once, whoever writes the payment first; a later edit leaves a balance to pay", async () => {
    const { createInvoiceCheckout, fakeGateway, finalizeInvoicePayment, handleWebhookEvent } = await import("../../lib/payments");
    const invoice = await newInvoice();

    const { id, url } = await createInvoiceCheckout(invoice, ORIGIN);
    expect(url).toBe(`${ORIGIN}/checkout/fake?cs=${id}`);
    expect(fakeGateway().returnUrls(id)).toEqual({ success: `${ORIGIN}/invoice/${invoice.token}?session_id=${id}`, cancel: `${ORIGIN}/invoice/${invoice.token}` });
    expect(await finalizeInvoicePayment(id)).toMatchObject({ status: "open", paid: 0 });

    const session = fakeGateway().complete(id, { name: "Pat Client", email: "pat@example.com" });
    const event = { id: `evt_${id}`, type: "checkout.session.completed", data: { object: { id, mode: "payment", metadata: session.metadata } } };
    // The page and the webhook at the same moment, then each once more.
    await Promise.all([finalizeInvoicePayment(id), handleWebhookEvent(event)]);
    await finalizeInvoicePayment(id);
    await handleWebhookEvent({ ...event, id: `${event.id}_again` });

    const paid = await read(invoice.id);
    expect(paid.payments).toHaveLength(1);
    expect(paid.payments![0]).toMatchObject({ amount: 630, method: "card", ref: session.paymentIntentId });
    expect(paid).toMatchObject({ paid: 63000, due: 0, status: "paid" });
    expect(paid.paidAt).toBeTruthy();

    const grown = (await cms.payload.update({
      collection: "invoices",
      id: invoice.id,
      data: { lines: [...(paid.lines || []), { description: "Extra guest", quantity: 1, unitPrice: 60, taxGroup: "service" }] },
      overrideAccess: true,
      depth: 0,
    })) as Invoice;
    expect(grown).toMatchObject({ due: 6300, status: "partially_paid", paidAt: null });
    const second = await createInvoiceCheckout(grown, ORIGIN);
    expect((await fakeGateway().retrieveSession(second.id))?.amountTotal).toBe(6300);
  }, 60_000);

  it("a refund in Stripe comes back as a negative payment, once per refunded total", async () => {
    const { createInvoiceCheckout, fakeGateway, finalizeInvoicePayment, handleWebhookEvent, refundRef } = await import("../../lib/payments");
    const invoice = await newInvoice();
    const { id } = await createInvoiceCheckout(invoice, ORIGIN);
    const pi = fakeGateway().complete(id, { email: "pat@example.com" }).paymentIntentId!;
    await finalizeInvoicePayment(id);

    const refunded = (n: number, total: number) =>
      handleWebhookEvent({ id: `evt_refund_${pi}_${n}`, type: "charge.refunded", data: { object: { payment_intent: pi, amount: 63000, amount_refunded: total, refunded: total >= 63000 } } });
    await refunded(1, 20000);
    await refunded(2, 20000); // the same total again: nothing new
    let after = await read(invoice.id);
    expect(after.payments?.filter((p) => p.ref === refundRef(pi)).map((p) => p.amount)).toEqual([-200]);
    expect(after).toMatchObject({ paid: 43000, due: 20000, status: "partially_paid" });

    await refunded(3, 63000);
    await refunded(4, 20000); // an older event arriving late
    after = await read(invoice.id);
    expect(after.payments?.filter((p) => p.ref === refundRef(pi)).map((p) => p.amount)).toEqual([-200, -430]);
    expect(after).toMatchObject({ paid: 0, due: 63000, status: "open" });
  }, 60_000);

  it("a void or paid invoice opens no Checkout", async () => {
    const { createInvoiceCheckout } = await import("../../lib/payments");
    const invoice = await newInvoice();
    const voided = (await cms.payload.update({ collection: "invoices", id: invoice.id, data: { voided: true }, overrideAccess: true, depth: 0 })) as Invoice;
    expect(voided.status).toBe("void");
    await expect(createInvoiceCheckout(voided, ORIGIN)).rejects.toThrow(/void/);
  }, 60_000);

  it("anonymous visitors cannot read invoices through the API", async () => {
    await newInvoice();
    const res = await cms.payload.find({ collection: "invoices", overrideAccess: false, depth: 0 }).catch((e: Error) => e);
    expect(res instanceof Error || res.docs.length === 0).toBe(true);
  }, 60_000);
});

let editorUser: Awaited<ReturnType<typeof makeEditor>> | undefined;
async function makeEditor() {
  return cms.payload.create({ collection: "users", data: { email: "editor@example.com", password: "unit-test-only-password" }, overrideAccess: true });
}
async function editor() {
  editorUser ??= await makeEditor();
  return { ...editorUser, collection: "users" as const };
}

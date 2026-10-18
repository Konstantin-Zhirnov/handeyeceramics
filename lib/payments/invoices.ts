/**
 * Paying an invoice of the admin by card: a Checkout session for what is
 * still due, and the payment written on the invoice once it went through —
 * by the invoice page the client comes back to and by the webhook alike,
 * whichever is first. The invoice is the lock: one conditional UPDATE marks
 * the session being written, and a payment already carrying the session's
 * payment id is never written twice. The owner gets an email when it is paid.
 */
import type { Payload } from "payload";
import type { Invoice } from "../../payload-types";
import { getCMS } from "../cms/payload";
import { formatPrice } from "../cms/text";
import { INVOICE_TOKEN } from "../invoices/totals";
import { inBackground } from "../mail";
import { serverURL } from "../server-url";
import { affected, literal, table } from "./db";
import { CHECKOUT_TTL_MS, PAYMENT_UNAVAILABLE, gateway } from "./gateway";
import type { GatewaySession } from "./types";

const SEND_TIMEOUT = 10_000;

const read = async (p: Payload, id: number) => (await p.findByID({ collection: "invoices", id, depth: 0, overrideAccess: true, disableErrors: true })) as Invoice | null;

/**
 * The invoice a client's link names. The token is the client's key: the read
 * is by it alone, past the editors-only access of the collection; a malformed
 * token reads nothing.
 */
export async function invoiceByToken(token: string, payload?: Payload): Promise<Invoice | null> {
  if (!INVOICE_TOKEN.test(token)) return null;
  const p = payload || (await getCMS());
  const { docs } = await p.find({ collection: "invoices", where: { token: { equals: token } }, limit: 1, depth: 0, overrideAccess: true });
  return (docs[0] as Invoice | undefined) || null;
}

/** The client's link of an invoice. */
export const invoiceUrl = (token: string, origin = serverURL()) => `${origin}/invoice/${encodeURIComponent(token)}`;

/** A Checkout session for what is still due on the invoice; the client is sent to its URL. */
export async function createInvoiceCheckout(invoice: Invoice, origin: string): Promise<{ id: string; url: string }> {
  const gw = gateway();
  if (!gw) throw new Error(PAYMENT_UNAVAILABLE);
  const number = invoice.number || String(invoice.id);
  if (invoice.status === "void") throw new Error(`Invoice ${number} is void`);
  const due = invoice.due ?? 0;
  if (due <= 0) throw new Error(`Invoice ${number} has nothing to pay`);
  if (!invoice.token) throw new Error(`Invoice ${number} has no link`);
  return gw.createInvoiceCheckout({
    invoiceId: invoice.id,
    invoiceNumber: number,
    token: invoice.token,
    origin,
    amount: due,
    name: `Invoice ${number} — Hand Eye Ceramics`,
    customerEmail: invoice.customer?.email || undefined,
    expiresAt: new Date(Date.now() + CHECKOUT_TTL_MS),
  });
}

const refOf = (session: GatewaySession) => session.paymentIntentId || session.id;
const recorded = (invoice: Invoice, ref: string) => (invoice.payments || []).some((p) => p.ref === ref);

/** Marks the session as being written: true for the one caller whose UPDATE changed the row. */
async function claim(p: Payload, invoiceId: number, sessionId: string): Promise<boolean> {
  const changed = await affected(
    p,
    `UPDATE ${table(p, "invoices")} SET claimed_session = ${literal(sessionId)} ` +
      `WHERE id = ${Math.trunc(invoiceId)} AND (claimed_session IS NULL OR claimed_session <> ${literal(sessionId)})`,
  );
  return changed === 1;
}

/** Gives the claim back after a failure, so the next caller writes the payment. */
async function unclaim(p: Payload, invoiceId: number, sessionId: string): Promise<void> {
  await affected(p, `UPDATE ${table(p, "invoices")} SET claimed_session = NULL WHERE id = ${Math.trunc(invoiceId)} AND claimed_session = ${literal(sessionId)}`);
}

/** The invoice once whoever claimed the session wrote it: polled for a few seconds. */
async function settled(p: Payload, id: number, ref: string): Promise<Invoice | null> {
  for (let i = 0; i < 20; i++) {
    const invoice = await read(p, id);
    if (!invoice || recorded(invoice, ref)) return invoice;
    await new Promise((r) => setTimeout(r, 250));
  }
  return read(p, id);
}

/**
 * Reads the Checkout session and, when it is paid, writes the payment on its
 * invoice — once, however many times the page and the webhook ask. Null when
 * the session is unknown or is not an invoice's; the invoice as it is when
 * the session is not paid.
 */
export async function finalizeInvoicePayment(sessionId: string, payload?: Payload): Promise<Invoice | null> {
  const gw = gateway();
  if (!gw) return null;
  const session = await gw.retrieveSession(sessionId);
  const invoiceId = Number(session?.metadata.invoiceId);
  if (!session || !Number.isInteger(invoiceId) || invoiceId <= 0) return null;
  const p = payload || (await getCMS());
  const invoice = await read(p, invoiceId);
  if (!invoice) return null;
  if (session.paymentStatus !== "paid") return invoice;
  const ref = refOf(session);
  if (recorded(invoice, ref)) return invoice;
  if (!(await claim(p, invoiceId, sessionId))) return settled(p, invoiceId, ref);
  try {
    const fresh = (await read(p, invoiceId))!;
    if (recorded(fresh, ref)) return fresh;
    const amount = (session.amountTotal ?? fresh.due ?? 0) / 100;
    const who = [session.customer.name, session.customer.email].filter(Boolean).join(", ");
    const updated = (await p.update({
      collection: "invoices",
      id: invoiceId,
      data: { payments: [...(fresh.payments || []), { at: new Date().toISOString(), amount, method: "card", ref, note: who || undefined }] },
      depth: 0,
      overrideAccess: true,
    })) as Invoice;
    const sending = notifyOwner(p, updated, amount).catch((err) => p.logger.error({ err, msg: `invoice ${updated.number}: the owner was not notified` }));
    await inBackground(sending);
    return updated;
  } catch (err) {
    await unclaim(p, invoiceId, sessionId).catch((e) => p.logger.error({ err: e, msg: `invoice ${invoiceId}: the claim could not be given back` }));
    throw err;
  }
}

/** A plain letter to the address in the site settings: who paid what, what is left, the admin link. */
export function invoicePaidLetter(invoice: Invoice, amount: number, adminURL: string): { subject: string; text: string } {
  const number = invoice.number || String(invoice.id);
  const client = [invoice.customer?.name, invoice.customer?.company].filter(Boolean).join(", ") || "The client";
  const due = (invoice.due ?? 0) / 100;
  const text = [
    `${client} paid ${formatPrice(amount)} by card on invoice ${number}.`,
    due > 0 ? `Still due: ${formatPrice(due)}.` : "The invoice is paid in full.",
    `In the admin: ${adminURL}/admin/collections/invoices/${invoice.id}`,
  ].join("\n");
  return { subject: `Invoice ${number} paid: ${formatPrice(amount)}`, text };
}

async function notifyOwner(p: Payload, invoice: Invoice, amount: number): Promise<void> {
  const settings = await p.findGlobal({ slug: "settings", depth: 0, overrideAccess: true });
  if (!settings?.email) {
    p.logger.warn({ msg: `Invoice ${invoice.number} paid: no email in the site settings, the owner was not notified` });
    return;
  }
  const letter = invoicePaidLetter(invoice, amount, serverURL());
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    p.sendEmail({ to: settings.email, ...letter }),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("sending the email timed out")), SEND_TIMEOUT);
    }),
  ]).finally(() => clearTimeout(timer));
}

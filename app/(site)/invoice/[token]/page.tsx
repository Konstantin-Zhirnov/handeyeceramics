import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/invoice/PrintButton";
import { addressParts } from "@/lib/cms/address";
import { relId } from "@/lib/cms/relations";
import { getCMS } from "@/lib/cms/resolve";
import { SITE_NAME, SITE_SUFFIX, formatPrice } from "@/lib/cms/text";
import { INVOICE_DEFAULT_PROVINCE, INVOICE_STATUS_LABELS, invoiceTotals } from "@/lib/invoices/totals";
import { finalizeInvoicePayment, gateway, invoiceByToken, studioProvince } from "@/lib/payments";
import { STUDIO_TIME_ZONE } from "@/lib/time";
import type { Invoice, Studio } from "@/payload-types";

/**
 * The client's invoice (the owner sends this link): the latest version of the
 * invoice — the owner may edit it after sending, the link stays the same —
 * with its payments and the balance, a card button for what is still due and
 * a print button. The token in the address is the only key: the invoice is
 * read by it (`invoiceByToken`), and everything else here as a visitor. `?session_id=`
 * — back from Checkout: the payment is written here if the webhook has not
 * done it yet. Never indexed.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Invoice${SITE_SUFFIX}`,
  robots: { index: false, follow: false },
};

const dollars = (cents: number | null | undefined) => formatPrice((cents || 0) / 100);
const day = (iso: string | null | undefined, withTime = false) =>
  iso
    ? new Intl.DateTimeFormat("en-CA", {
        timeZone: STUDIO_TIME_ZONE,
        dateStyle: "long",
        ...(withTime ? { timeStyle: "short" as const } : {}),
      }).format(new Date(iso))
    : "";

const METHOD: Record<string, string> = { card: "Card", "e-transfer": "E-transfer", cash: "Cash", other: "Payment" };

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ session_id?: string; error?: string }>;
}) {
  const { token } = await params;
  const { session_id: sessionId, error } = await searchParams;
  let invoice = await invoiceByToken(token);
  if (!invoice) notFound();
  if (sessionId) {
    const paid = await finalizeInvoicePayment(sessionId).catch((err) => {
      console.error(`invoice ${invoice?.number}: the payment could not be written on return`, err);
      return null;
    });
    if (paid?.id === invoice.id) invoice = paid;
  }

  const payload = await getCMS();
  const [settings, studio] = await Promise.all([
    payload.findGlobal({ slug: "settings", depth: 0, overrideAccess: false }),
    relId(invoice.studio)
      ? (payload.findByID({ collection: "studios", id: relId(invoice.studio)!, depth: 0, overrideAccess: false, disableErrors: true }) as Promise<Studio | null>)
      : Promise.resolve(null),
  ]);
  const t = invoiceTotals(invoice.lines, studioProvince(studio) || INVOICE_DEFAULT_PROVINCE, invoice.payments, Boolean(invoice.voided));
  const number = invoice.number || String(invoice.id);
  const address = addressParts(studio?.address);
  const canPay = t.status !== "void" && t.due > 0 && Boolean(gateway());
  const justPaid = Boolean(sessionId) && (invoice.payments || []).length > 0 && t.due <= 0;
  const statusTone = t.status === "paid" ? "bg-emerald-100 text-emerald-900" : t.status === "void" ? "bg-neutral-200 text-neutral-700" : "bg-amber-100 text-amber-900";

  return (
    <main data-invoice className="mx-auto max-w-[46rem] px-4 py-8 text-ink sm:px-8 print:max-w-none print:p-0">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-clay-200 pb-6">
        <div>
          <p className="font-display text-2xl">{SITE_NAME}</p>
          <div className="mt-2 text-sm text-ink-soft">
            {studio && <p>{studio.name}</p>}
            {address.street && <p>{address.street}</p>}
            {address.locality && <p>{`${address.locality}, ${address.regionCode} ${address.postalCode}`.trim()}</p>}
            {settings.phone && <p>{settings.phone}</p>}
            {settings.email && <p>{settings.email}</p>}
            {settings.invoices?.gstNumber && <p>GST {settings.invoices.gstNumber}</p>}
          </div>
        </div>
        <div className="sm:text-right">
          <h1 className="text-2xl font-semibold">Invoice {number}</h1>
          <p className="mt-1 text-sm text-ink-soft">Issued {day(invoice.createdAt)}</p>
          <p className={`mt-2 inline-block rounded px-2 py-0.5 text-sm font-semibold ${statusTone}`} data-invoice-status={t.status}>
            {t.status === "partially_paid" ? `${INVOICE_STATUS_LABELS.partially_paid} · ${dollars(t.due)} due` : INVOICE_STATUS_LABELS[t.status]}
          </p>
        </div>
      </header>

      {justPaid && (
        <p role="status" className="mt-6 rounded-md bg-emerald-50 px-4 py-3 text-emerald-900 print:hidden">
          Thank you — your payment went through. You can come back to this page any time to print the invoice.
        </p>
      )}
      {error === "unavailable" && (
        <p role="alert" className="mt-6 rounded-md bg-amber-50 px-4 py-3 text-amber-900 print:hidden">
          Card payment is not available right now{settings.phone ? ` — please call the studio at ${settings.phone}` : ""}.
        </p>
      )}

      <section className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="eyebrow text-clay-600">Bill to</h2>
          <div className="mt-2">
            <p>{invoice.customer?.name}</p>
            {invoice.customer?.company && <p>{invoice.customer.company}</p>}
            {invoice.customer?.email && <p className="text-ink-soft">{invoice.customer.email}</p>}
            {invoice.customer?.phone && <p className="text-ink-soft">{invoice.customer.phone}</p>}
          </div>
        </div>
        {invoice.eventDate && (
          <div>
            <h2 className="eyebrow text-clay-600">Event</h2>
            <p className="mt-2">{day(invoice.eventDate, true)}</p>
          </div>
        )}
      </section>

      <section className="mt-8" aria-label="Lines">
        <ul className="divide-y divide-clay-200 border-y border-clay-200">
          {(invoice.lines || []).map((l, i) => (
            <li key={l.id || i} className="flex items-baseline justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="break-words">{l.description}</p>
                <p className="text-sm text-ink-soft">
                  {l.quantity} × {formatPrice(l.unitPrice)}
                </p>
              </div>
              <p className="shrink-0 tabular-nums">{dollars(t.lines[i]?.amount)}</p>
            </li>
          ))}
        </ul>
        <dl className="ml-auto mt-4 grid max-w-[20rem] grid-cols-[1fr_auto] gap-x-6 gap-y-1 tabular-nums">
          <dt className="text-ink-soft">Subtotal</dt>
          <dd className="text-right">{dollars(t.subtotal)}</dd>
          {t.taxes.map((tax) => (
            <div key={`${tax.code}${tax.percentage}`} className="contents">
              <dt className="text-ink-soft">
                {tax.code} {tax.percentage}%
              </dt>
              <dd className="text-right">{dollars(tax.amount)}</dd>
            </div>
          ))}
          <dt className="font-semibold">Total</dt>
          <dd className="text-right font-semibold">{dollars(t.total)}</dd>
          {(invoice.payments || []).map((p, i) => (
            <div key={p.id || i} className="contents">
              <dt className="text-ink-soft">
                {p.amount < 0 ? "Refund" : METHOD[p.method] || "Payment"} {day(p.at)}
              </dt>
              <dd className="text-right">{p.amount < 0 ? `+${formatPrice(-p.amount)}` : `−${formatPrice(p.amount)}`}</dd>
            </div>
          ))}
          {t.status !== "void" && (
            <>
              <dt className="font-semibold">{t.due < 0 ? "Credit" : "Balance due"}</dt>
              <dd className="text-right font-semibold" data-invoice-due>
                {dollars(Math.abs(t.due))}
              </dd>
            </>
          )}
        </dl>
      </section>

      {invoice.note && <p className="mt-8 whitespace-pre-line text-ink-soft">{invoice.note}</p>}
      {t.status !== "void" && t.due > 0 && settings.invoices?.paymentNote && (
        <p className="mt-4 whitespace-pre-line text-sm text-ink-soft">{settings.invoices.paymentNote}</p>
      )}

      <div className="mt-10 flex flex-col gap-3 sm:flex-row print:hidden">
        {canPay && (
          <form method="post" action={`/invoice/${encodeURIComponent(token)}/pay`}>
            <button type="submit" className="w-full rounded-md bg-ink px-6 py-3 text-white sm:w-auto">
              Pay {dollars(t.due)} by card
            </button>
          </form>
        )}
        <PrintButton className="rounded-md border border-clay-400 px-6 py-3" />
      </div>
    </main>
  );
}

import type { UIFieldServerComponent } from "payload";
import { formatPrice } from "../../lib/cms/text";
import { INVOICE_STATUS_LABELS, type InvoiceStatus } from "../../lib/invoices/totals";
import { invoiceUrl } from "../../lib/payments/invoices";
import { CopyLink } from "./CopyLink";

const dollars = (cents: unknown) => formatPrice((typeof cents === "number" ? cents : 0) / 100);

/**
 * First on an invoice in the admin: the one link to send the client — it
 * always shows the latest version, so editing after sending needs no new
 * link — and the sums as last saved: total, paid, still due.
 */
export const InvoiceLink: UIFieldServerComponent = ({ data }) => {
  const token = typeof data?.token === "string" ? data.token : "";
  if (!token) {
    return (
      <p className="field-type" style={{ color: "var(--theme-elevation-600)" }}>
        Save the invoice to get the link for the client.
      </p>
    );
  }
  const status = (data?.status as InvoiceStatus) || "open";
  const due = typeof data?.due === "number" ? data.due : 0;
  const number = typeof data?.number === "string" ? data.number : "";
  return (
    <div className="field-type he-invoice" style={{ marginBottom: "var(--base)" }}>
      <style>{CSS}</style>
      <div className="he-invoice__head">
        <span className="he-invoice__title">Client link</span>
        <span className={`he-invoice__status he-invoice__status--${status}`}>{INVOICE_STATUS_LABELS[status]}</span>
      </div>
      <CopyLink url={invoiceUrl(token)} title={`Invoice ${number} — Hand Eye Ceramics`} />
      <dl className="he-invoice__sums">
        <div>
          <dt>Total</dt>
          <dd>{dollars(data?.total)}</dd>
        </div>
        <div>
          <dt>Paid</dt>
          <dd>{dollars(data?.paid)}</dd>
        </div>
        <div>
          <dt>{due < 0 ? "Credit" : "Due"}</dt>
          <dd className={due > 0 && status !== "void" ? "he-invoice__due" : undefined}>{dollars(Math.abs(due))}</dd>
        </div>
      </dl>
      <p className="he-invoice__hint">Edits show on the same link after you save. Card payments appear under Payments by themselves.</p>
    </div>
  );
};

const CSS = `
.he-invoice__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.he-invoice__title { font-size: 16px; font-weight: 600; }
.he-invoice__status { font-size: 13px; font-weight: 600; padding: 2px 8px; border-radius: 4px; background: var(--theme-warning-100, #fef3c7); color: var(--theme-warning-800, #92400e); }
.he-invoice__status--paid { background: var(--theme-success-100, #d1fae5); color: var(--theme-success-800, #065f46); }
.he-invoice__status--void { background: var(--theme-elevation-100); color: var(--theme-elevation-700); }
.he-copy__url { width: 100%; min-height: 40px; padding: 8px 10px; border: 1px solid var(--theme-elevation-150); border-radius: 6px;
  background: var(--theme-elevation-50); color: var(--theme-elevation-800); font-size: 14px; }
.he-copy__buttons { display: flex; gap: 8px; margin-top: 8px; }
.he-copy__btn { flex: 1 1 0; display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 12px;
  border: 1px solid var(--theme-elevation-200); border-radius: 6px; background: var(--theme-elevation-0); color: var(--theme-elevation-800);
  font-size: 15px; text-decoration: none; cursor: pointer; }
.he-copy__btn--main { background: var(--theme-elevation-800); border-color: var(--theme-elevation-800); color: var(--theme-elevation-0); font-weight: 600; }
.he-invoice__sums { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 12px 0 0; }
.he-invoice__sums div { padding: 8px 10px; border: 1px solid var(--theme-elevation-100); border-radius: 6px; }
.he-invoice__sums dt { font-size: 12px; color: var(--theme-elevation-500); }
.he-invoice__sums dd { margin: 2px 0 0; font-size: 16px; font-weight: 600; font-variant-numeric: tabular-nums; }
.he-invoice__due { color: var(--theme-error-650, #b42318); }
.he-invoice__hint { margin: 8px 0 0; font-size: 13px; color: var(--theme-elevation-500); }
`;

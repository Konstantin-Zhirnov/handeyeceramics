import type { TextFieldServerComponent } from "payload";

/**
 * The "Open in Stripe" field of an order in the admin (R08): the payment of
 * the order as a link into the Stripe dashboard, in test or live mode by the
 * key in use. The link is the value of the virtual `stripeUrl` field (set on
 * read from the payment id by stripeDashboardUrl); an unpaid order has none.
 */
export const StripeLink: TextFieldServerComponent = ({ data, field }) => {
  const url = typeof data?.stripeUrl === "string" && data.stripeUrl ? data.stripeUrl : null;
  const paymentId = typeof data?.stripePaymentIntentId === "string" ? data.stripePaymentIntentId : "";
  const label = typeof field.label === "string" ? field.label : "Open in Stripe";
  return (
    <div className="field-type" style={{ marginBottom: "var(--base)" }}>
      <div style={{ marginBottom: "0.25rem", fontSize: "0.8125rem", color: "var(--theme-elevation-800)" }}>{label}</div>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" style={{ wordBreak: "break-all" }}>
          {paymentId || url}
        </a>
      ) : (
        <span style={{ color: "var(--theme-elevation-500)" }}>— (no payment yet)</span>
      )}
    </div>
  );
};

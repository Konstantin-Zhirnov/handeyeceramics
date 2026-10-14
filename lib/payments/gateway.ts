/**
 * Which gateway the site pays through: PAYMENT_GATEWAY=fake — the in-process
 * fake (tests, development without keys); otherwise Stripe when
 * STRIPE_SECRET_KEY is set; otherwise none, and the caller answers "Online
 * payment is not available right now".
 */
import { fakeGateway } from "./fake";
import { stripeGateway } from "./stripe";
import type { PaymentGateway } from "./types";

/** A Checkout session lives 30 minutes — the least Stripe allows — and the seats are held for the same time. */
export const CHECKOUT_TTL_MS = 30 * 60 * 1000;

let stripe: { key: string; gateway: PaymentGateway } | undefined;

export function gateway(): PaymentGateway | null {
  if (process.env.PAYMENT_GATEWAY === "fake") return fakeGateway();
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (stripe?.key !== key) stripe = { key, gateway: stripeGateway(key) };
  return stripe.gateway;
}

/** The text the site shows when there is no gateway (R04.2). */
export const PAYMENT_UNAVAILABLE = "Online payment is not available right now";

const DASHBOARD = { payment: "payments", subscription: "subscriptions", customer: "customers" } as const;

/** A link into the Stripe dashboard; test keys open the test mode. */
export function stripeDashboardUrl(kind: keyof typeof DASHBOARD, id: string): string {
  const test = (process.env.STRIPE_SECRET_KEY || "").startsWith("sk_test_") ? "/test" : "";
  return `https://dashboard.stripe.com${test}/${DASHBOARD[kind]}/${encodeURIComponent(id)}`;
}

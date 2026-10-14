/**
 * The payments module: the gateway and its two implementations, Checkout for
 * an order and for a plan, the completion of an order and the webhook events,
 * the manual tax rates.
 */
export { CHECKOUT_TTL_MS, PAYMENT_UNAVAILABLE, gateway, stripeDashboardUrl } from "./gateway";
export { createCheckoutForOrder, createSubscriptionCheckout, studioProvince } from "./checkout";
export { finalizeOrder, handleWebhookEvent } from "./orders";
export { fakeGateway, type FakeCompletion, type FakeGateway } from "./fake";
export { stripeGateway, type StripeClient } from "./stripe";
export { ratesFor } from "./tax";
export { trackPurchase } from "./track";
export type * from "./types";

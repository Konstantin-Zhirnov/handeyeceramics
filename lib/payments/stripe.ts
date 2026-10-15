/**
 * The Stripe gateway over the official SDK: hosted Checkout with `price_data`
 * (prices stay in the admin, R20i), manual tax rates and lazily created Stripe
 * Products — both found by metadata or created, never by an id written in
 * code, so a change of Stripe account is a change of keys (R14). Found ids are
 * cached in the process.
 */
import Stripe from "stripe";
import type { CheckoutInput, GatewayEvent, GatewaySession, PaymentGateway, SubscriptionInput, TaxLine } from "./types";

/** What the gateway uses of the SDK; a test hands in a stand-in with these members. */
export type StripeClient = Pick<Stripe, "checkout" | "taxRates" | "products" | "webhooks">;

export const CURRENCY = "cad";
const ATTENDEE_FIELD = { key: "attendee", label: { type: "custom" as const, custom: "Who is attending" }, type: "text" as const, optional: true };

const urls = (origin: string) => ({
  success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${origin}/cart`,
});

const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);
/** The SDK types these as "known values or any other string"; the gateway keeps the known ones and treats the rest as the safe default. */
const paymentStatusOf = (v: string): GatewaySession["paymentStatus"] => (v === "paid" || v === "no_payment_required" ? v : "unpaid");
const statusOf = (v: string | null | undefined): GatewaySession["status"] => (v === "complete" || v === "expired" ? v : "open");
/** An expandable field: the id when it is a string, the object's id when it was expanded. */
const idOf = (v: unknown): string | undefined => (typeof v === "string" ? v : str((v as { id?: unknown } | null)?.id));

export function toGatewaySession(s: Stripe.Checkout.Session): GatewaySession {
  const customFields: Record<string, string> = {};
  for (const f of s.custom_fields || []) {
    const value = f.text?.value ?? f.numeric?.value ?? f.dropdown?.value;
    if (value) customFields[f.key] = value;
  }
  const metadata: Record<string, string> = {};
  for (const [k, v] of Object.entries(s.metadata || {})) if (typeof v === "string") metadata[k] = v;
  return {
    id: s.id,
    mode: s.mode === "subscription" ? "subscription" : "payment",
    paymentStatus: paymentStatusOf(s.payment_status),
    status: statusOf(s.status),
    paymentIntentId: idOf(s.payment_intent),
    subscriptionId: idOf(s.subscription),
    customerId: idOf(s.customer),
    customer: {
      name: str(s.customer_details?.name),
      email: str(s.customer_details?.email) || str(s.customer_email),
      phone: str(s.customer_details?.phone),
    },
    customFields,
    metadata,
  };
}

export function stripeGateway(secretKey: string, client: StripeClient = new Stripe(secretKey)): PaymentGateway {
  const taxRates = new Map<string, string>();
  const products = new Map<string, string>();

  const gateway: PaymentGateway = {
    name: "stripe",

    async ensureTaxRate(line: TaxLine): Promise<string> {
      const key = `${line.code}:${line.province}:${line.percentage}`;
      const cached = taxRates.get(key);
      if (cached) return cached;
      const existing = await client.taxRates.list({ active: true, limit: 100 });
      const found = existing.data.find(
        (r) => !r.inclusive && Number(r.percentage) === line.percentage && r.metadata?.code === line.code && r.metadata?.province === line.province,
      );
      const id =
        found?.id ||
        (
          await client.taxRates.create({
            display_name: line.code,
            jurisdiction: line.province,
            percentage: line.percentage,
            inclusive: false,
            country: "CA",
            metadata: { code: line.code, province: line.province },
          })
        ).id;
      taxRates.set(key, id);
      return id;
    },

    async findProduct(ref): Promise<string | undefined> {
      const key = `${ref.kind}:${ref.id}`;
      const cached = products.get(key);
      if (cached) return cached;
      const found = await client.products.search({
        query: `active:'true' AND metadata['cms_kind']:'${ref.kind}' AND metadata['cms_id']:'${ref.id}'`,
        limit: 1,
      });
      const id = found.data[0]?.id;
      if (id) products.set(key, id);
      return id;
    },

    async ensureProduct(ref): Promise<string> {
      const found = await gateway.findProduct(ref);
      if (found) return found;
      const metadata: Record<string, string> = { cms_kind: ref.kind, cms_id: String(ref.id) };
      if (ref.path) metadata.path = ref.path;
      if (ref.group) metadata.group = ref.group;
      const id = (await client.products.create({ name: ref.name, metadata })).id;
      products.set(`${ref.kind}:${ref.id}`, id);
      return id;
    },

    async createCheckout(input: CheckoutInput) {
      const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
      for (const line of input.lines) {
        const product = await gateway.ensureProduct(line.productRef);
        const tax_rates: string[] = [];
        for (const t of line.taxLines) tax_rates.push(await gateway.ensureTaxRate(t));
        line_items.push({
          price_data: { currency: CURRENCY, unit_amount: line.unitAmount, product },
          quantity: line.quantity,
          tax_rates,
        });
      }
      const params: Stripe.Checkout.SessionCreateParams = {
        mode: "payment",
        line_items,
        expires_at: Math.floor(input.expiresAt.getTime() / 1000),
        billing_address_collection: "auto",
        phone_number_collection: { enabled: true },
        metadata: { orderId: String(input.orderId), orderNumber: input.orderNumber },
        ...urls(input.origin),
      };
      if (input.collectAttendee) params.custom_fields = [ATTENDEE_FIELD];
      if (input.customerEmail) params.customer_email = input.customerEmail;
      const session = await client.checkout.sessions.create(params);
      if (!session.url) throw new Error("Stripe returned a Checkout session without a URL");
      return { id: session.id, url: session.url };
    },

    async createSubscriptionCheckout(input: SubscriptionInput) {
      const planId = String(input.planId);
      const session = await client.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: input.priceId, quantity: 1 }],
        metadata: { planId },
        subscription_data: { metadata: { planId } },
        ...urls(input.origin),
      });
      if (!session.url) throw new Error("Stripe returned a Checkout session without a URL");
      return { id: session.id, url: session.url };
    },

    async retrieveSession(id: string): Promise<GatewaySession | null> {
      try {
        return toGatewaySession(await client.checkout.sessions.retrieve(id));
      } catch (err) {
        if ((err as { code?: string }).code === "resource_missing") return null;
        throw err;
      }
    },

    constructEvent(rawBody: string, signature: string): GatewayEvent {
      const secret = process.env.STRIPE_WEBHOOK_SECRET || "";
      if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
      const event = client.webhooks.constructEvent(rawBody, signature, secret);
      return { id: event.id, type: event.type, data: { object: event.data.object as unknown as Record<string, unknown> } };
    },
  };
  return gateway;
}

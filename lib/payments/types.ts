/**
 * Types shared by the payments module, the cart and the booking code. The
 * money of orders and of Stripe is in integer cents, currency "cad"; the CMS
 * keeps the prices of products and plans in dollars.
 */
export type TaxGroup = "goods" | "service" | "exempt";
export type TaxLine = { code: "GST" | "PST"; province: string; percentage: number };

export type CartLineInput = { kind: "session" | "product"; id: number; quantity: number; option?: string };
export type PricedLine = CartLineInput & {
  label: string;
  unitAmount: number /* cents */;
  taxGroup: TaxGroup;
  taxLines: TaxLine[];
  taxAmount: number;
  studio?: number;
  error?: string;
};

export type CheckoutInput = {
  orderId: number;
  orderNumber: string;
  origin: string;
  customerEmail?: string;
  collectAttendee: boolean;
  expiresAt: Date;
  lines: {
    name: string;
    productRef: { kind: "session" | "product"; id: number; name: string; path?: string };
    unitAmount: number;
    quantity: number;
    taxLines: TaxLine[];
  }[];
};

export type SubscriptionInput = { planId: number; priceId: string; origin: string };

export interface PaymentGateway {
  name: "stripe" | "fake";
  createCheckout(input: CheckoutInput): Promise<{ id: string; url: string }>;
  createSubscriptionCheckout(input: SubscriptionInput): Promise<{ id: string; url: string }>;
  retrieveSession(id: string): Promise<GatewaySession | null>;
  constructEvent(rawBody: string, signature: string): GatewayEvent; // throws on a bad signature
  ensureTaxRate(line: TaxLine): Promise<string>; // id of a Stripe tax_rate
  ensureProduct(ref: { kind: "session" | "product"; id: number; name: string; path?: string }): Promise<string>;
}

export type GatewaySession = {
  id: string;
  mode: "payment" | "subscription";
  paymentStatus: "paid" | "unpaid" | "no_payment_required";
  status: "open" | "complete" | "expired";
  paymentIntentId?: string;
  subscriptionId?: string;
  customerId?: string;
  customer: { name?: string; email?: string; phone?: string };
  customFields: Record<string, string>;
  metadata: Record<string, string>;
};

export type GatewayEvent = { id: string; type: string; data: { object: Record<string, unknown> } };

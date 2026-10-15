import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { fakeGateway, gateway, type GatewayEvent, type GatewaySession } from "@/lib/payments";
import { serverURL } from "@/lib/server-url";

/**
 * The buttons of the fake checkout page: Pay completes the session, Abandon
 * expires it. Then the route does what Stripe would — posts the signed
 * `checkout.session.completed` / `checkout.session.expired` event to this
 * site's own webhook (unless the form says `skipWebhook`) — and sends the buyer
 * on to the success page or back to the cart. 404 on any other gateway.
 */
export const dynamic = "force-dynamic";

/** The event as Stripe would send it, as far as the webhook handler reads it. */
function eventFor(session: GatewaySession): GatewayEvent {
  const completed = session.status === "complete";
  return {
    id: `evt_fake_${randomBytes(12).toString("hex")}`,
    type: completed ? "checkout.session.completed" : "checkout.session.expired",
    data: {
      object: {
        id: session.id,
        object: "checkout.session",
        mode: session.mode,
        status: session.status,
        payment_status: session.paymentStatus,
        payment_intent: session.paymentIntentId,
        subscription: session.subscriptionId,
        customer: session.customerId,
        customer_details: { name: session.customer.name, email: session.customer.email, phone: session.customer.phone },
        metadata: session.metadata,
      },
    },
  };
}

/** Stripe's signature header for the body, made by the SDK's own test helper with the webhook secret; the literal "fake" when there is none. */
function sign(body: string): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return "fake";
  return new Stripe("sk_test_unused").webhooks.generateTestHeaderString({ payload: body, secret });
}

export async function POST(request: Request) {
  if (gateway()?.name !== "fake") return new NextResponse("Not found", { status: 404 });
  const data = await request.formData();
  const text = (name: string) => String(data.get(name) || "").trim() || undefined;
  const id = text("cs");
  const fake = fakeGateway();
  if (!id || !(await fake.retrieveSession(id))) return new NextResponse("Not found", { status: 404 });

  const session = text("action") === "abandon" ? fake.expire(id) : fake.complete(id, { name: text("name"), email: text("email"), phone: text("phone"), attendee: text("attendee") });
  const origin = serverURL();
  const body = JSON.stringify(eventFor(session));
  // "skipWebhook": the test of the success page finishing an order on its own, as when Stripe's event is late.
  if (data.get("skipWebhook")) return NextResponse.redirect(session.status === "complete" ? `${origin}/checkout/success?session_id=${encodeURIComponent(id)}` : `${origin}/cart`, 303);
  try {
    await fetch(`${origin}/stripe/webhook`, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": sign(body) }, body });
  } catch (err) {
    // The success page finishes the order on its own; the webhook was a courtesy.
    console.error("fake checkout: the webhook could not be delivered", err);
  }
  const next = session.status === "complete" ? `${origin}/checkout/success?session_id=${encodeURIComponent(id)}` : `${origin}/cart`;
  return NextResponse.redirect(next, 303);
}

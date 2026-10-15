import { NextResponse } from "next/server";
import { gateway, handleWebhookEvent } from "@/lib/payments";

/**
 * Stripe's events (R07, R07.1): the body is read raw, exactly as signed, and
 * the signature in `stripe-signature` is checked by the gateway before
 * anything is parsed — a wrong one is 400 and nothing is written. A handled
 * or ignored event is 200 `{ received: true, handled }`; a failure while
 * applying one is 500, so that Stripe sends the event again.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const gw = gateway();
  if (!gw) return NextResponse.json({ ok: false, message: "No payment gateway is configured" }, { status: 503 });
  const raw = await request.text();
  let event;
  try {
    event = gw.constructEvent(raw, request.headers.get("stripe-signature") || "");
  } catch {
    return NextResponse.json({ ok: false, message: "Bad signature" }, { status: 400 });
  }
  try {
    const { handled } = await handleWebhookEvent(event);
    return NextResponse.json({ received: true, handled });
  } catch (err) {
    console.error(`stripe/webhook: ${event.type} ${event.id} failed`, err);
    return NextResponse.json({ ok: false, message: "The event could not be applied; please retry" }, { status: 500 });
  }
}

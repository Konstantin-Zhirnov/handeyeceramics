import { NextResponse } from "next/server";
import { getCMS } from "@/lib/cms/resolve";
import { createSubscriptionCheckout, gateway, PAYMENT_UNAVAILABLE } from "@/lib/payments";
import { serverURL } from "@/lib/server-url";

/**
 * The Subscribe button of a membership plan (R11): a form post (or JSON) with
 * `plan` — the plan's id. A plan with a Stripe price → 303 to the subscription
 * Checkout; no such plan, or one without a price → 400; no gateway → 503.
 */
export const dynamic = "force-dynamic";

const fail = (status: number, message: string) => NextResponse.json({ ok: false, message }, { status });

async function planIdOf(request: Request): Promise<number | undefined> {
  try {
    const type = request.headers.get("content-type") || "";
    const raw = type.includes("application/json") ? ((await request.json()) as { plan?: unknown } | null)?.plan : (await request.formData()).get("plan");
    const id = Number(raw);
    return Number.isInteger(id) && id > 0 ? id : undefined;
  } catch {
    return undefined;
  }
}

export async function POST(request: Request) {
  const id = await planIdOf(request);
  if (!id) return fail(400, "Choose a plan to subscribe to.");
  const payload = await getCMS();
  const plan = await payload.findByID({ collection: "plans", id, depth: 0, overrideAccess: false, disableErrors: true });
  if (!plan?.stripePriceId?.trim()) return fail(400, "This plan cannot be subscribed to online. Please call the studio.");
  if (!gateway()) {
    const settings = await payload.findGlobal({ slug: "settings", depth: 0, overrideAccess: false });
    return fail(503, settings.phone ? `${PAYMENT_UNAVAILABLE} — call the studio at ${settings.phone}.` : `${PAYMENT_UNAVAILABLE}.`);
  }
  try {
    const { url } = await createSubscriptionCheckout(plan, serverURL());
    return NextResponse.redirect(url, 303);
  } catch (err) {
    console.error("checkout/subscribe: the gateway did not open a session", err);
    return fail(503, `${PAYMENT_UNAVAILABLE}.`);
  }
}

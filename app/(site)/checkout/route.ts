import { NextResponse } from "next/server";
import { holdSeats, releaseHolds } from "@/lib/booking/holds";
import { validateCart } from "@/lib/cart/validate";
import { getCMS } from "@/lib/cms/resolve";
import { CHECKOUT_TTL_MS, createCheckoutForOrder, gateway, PAYMENT_UNAVAILABLE } from "@/lib/payments";
import { addressOf, rateLimiter, SENDER_LIMIT } from "@/lib/rate-limit";
import { serverURL } from "@/lib/server-url";
import { trackingConfig } from "@/lib/track/config";
import type { Order } from "@/payload-types";

/**
 * Paying starts here (R04, R04.2, R04.3, R17i): the cart is priced from the
 * CMS once more, a pending order is written with those prices, its seats are
 * held for as long as the Checkout session lives, and the buyer is sent to the
 * gateway. JSON `{ lines: [{kind, id, quantity, option?}], pickupStudio? }`
 * (or the same as form fields, `lines` as JSON) →
 *   200 `{ ok: true, url, order }`     — go and pay (a form post is sent there with 303);
 *   409 `{ ok: false, message, errors, short? }` — the cart must change first;
 *   429 `{ ok: false, message }`       — too many attempts from one sender;
 *   503 `{ ok: false, message }`       — no gateway: the message names the studio's phone.
 * A GET of /checkout is a redirect to /cart (a rule of the admin, answered by proxy.ts).
 */
export const dynamic = "force-dynamic";

/** The same brake as on the enquiry forms: 5 attempts per sender within 10 minutes. */
const limiter = rateLimiter(SENDER_LIMIT);

const fail = (status: number, message: string, more: Record<string, unknown> = {}) => NextResponse.json({ ok: false, message, ...more }, { status });

type Body = { lines: unknown[]; pickupStudio?: number; newsletter: boolean; form: boolean };

/** The cart from a JSON body or from the hidden fields of the no-script form; null when neither is readable. */
async function readBody(request: Request): Promise<Body | null> {
  const type = request.headers.get("content-type") || "";
  try {
    let lines: unknown;
    let pickup: unknown;
    let newsletter = false;
    let form = false;
    if (type.includes("application/json")) {
      const body = (await request.json()) as Record<string, unknown> | null;
      lines = body?.lines;
      pickup = body?.pickupStudio;
      newsletter = body?.newsletter === true;
    } else {
      const data = await request.formData();
      lines = JSON.parse(String(data.get("lines") || "[]"));
      pickup = Number(data.get("pickupStudio")) || undefined;
      newsletter = data.get("newsletter") === "on";
      form = true;
    }
    if (!Array.isArray(lines)) return null;
    const pickupStudio = typeof pickup === "number" && Number.isInteger(pickup) && pickup > 0 ? pickup : undefined;
    return { lines, pickupStudio, newsletter, form };
  } catch {
    return null;
  }
}

/** The Meta browser cookies and the buyer's address and browser, kept on the order only while the Conversions API is on. */
function trackingContext(request: Request, address: string | undefined) {
  if (!trackingConfig().metaCapiToken) return undefined;
  const cookies = new Map(
    (request.headers.get("cookie") || "").split(";").map((c) => {
      const at = c.indexOf("=");
      const value = c.slice(at + 1).trim();
      let decoded = value;
      try {
        decoded = decodeURIComponent(value);
      } catch {
        /* a malformed cookie is taken as it is */
      }
      return [c.slice(0, at).trim(), decoded] as const;
    }),
  );
  return {
    fbp: cookies.get("_fbp") || undefined,
    fbc: cookies.get("_fbc") || undefined,
    clientIp: address,
    userAgent: request.headers.get("user-agent")?.slice(0, 500) || undefined,
  };
}

async function unavailable() {
  let phone = "";
  try {
    phone = (await (await getCMS()).findGlobal({ slug: "settings", depth: 0, overrideAccess: false })).phone || "";
  } catch {
    /* the CMS is what failed: no phone to offer */
  }
  return fail(503, phone ? `${PAYMENT_UNAVAILABLE} — call the studio at ${phone}.` : `${PAYMENT_UNAVAILABLE}.`);
}

/** The order is not going to be paid: it is closed, and whatever it held goes back on sale. */
async function abandon(payload: Awaited<ReturnType<typeof getCMS>>, order: Order, note: string) {
  await releaseHolds(String(order.id), payload);
  await payload.update({
    collection: "orders",
    id: order.id,
    data: { status: "canceled", events: [...(order.events || []), { at: new Date().toISOString(), type: "canceled", note }] },
    depth: 0,
    overrideAccess: true,
  });
}

export async function POST(request: Request) {
  const address = addressOf(request.headers);
  // Local development has no proxy and so no address; there the brake is off.
  if (address && !limiter.allow(`address:${address}`)) {
    return fail(429, "You've tried to check out several times in a row. Please wait a few minutes and try again.");
  }
  const body = await readBody(request);
  if (!body) return fail(400, "The cart could not be read. Please try again.");

  const cart = await validateCart(body.lines, body.pickupStudio);
  const lineErrors = cart.lines.filter((l) => l.error).map((l) => `${l.label || `Line ${l.id}`}: ${l.error}`);
  if (cart.errors.length || lineErrors.length || !cart.studio) {
    return fail(409, "Some items in your cart need your attention before you can pay.", { errors: [...cart.errors, ...lineErrors], lines: cart.lines });
  }
  if (!gateway()) return unavailable();

  const payload = await getCMS();
  // The order's number ("HE-000123") is set by a hook of the collection and comes back on the created document.
  const order = (await payload.create({
    collection: "orders",
    overrideAccess: true,
    depth: 0,
    data: {
      status: "pending",
      pickupStudio: cart.studio.id,
      newsletter: body.newsletter,
      currency: "cad",
      lines: cart.lines.map((l) => ({
        kind: l.kind,
        session: l.kind === "session" ? l.id : undefined,
        product: l.kind === "product" ? l.id : undefined,
        label: l.label,
        option: l.option,
        quantity: l.quantity,
        unitAmount: l.unitAmount,
        taxGroup: l.taxGroup,
        taxAmount: l.taxAmount,
        lineTotal: l.unitAmount * l.quantity + l.taxAmount,
      })),
      subtotal: cart.subtotal,
      tax: cart.tax,
      total: cart.total,
      events: [{ at: new Date().toISOString(), type: "created", note: address ? `from ${address}` : undefined }],
      tracking: trackingContext(request, address),
    },
  })) as Order;

  const seats = cart.lines.filter((l) => l.kind === "session").map((l) => ({ sessionId: l.id, qty: l.quantity }));
  const held = await holdSeats(seats, String(order.id), CHECKOUT_TTL_MS, payload);
  if (!held.ok) {
    await abandon(payload, order, "seats taken meanwhile");
    const label = (sessionId: number) => cart.lines.find((l) => l.kind === "session" && l.id === sessionId)?.label || `Date ${sessionId}`;
    const errors = held.short.map(({ sessionId, left }) => `${label(sessionId)}: ${left === 0 ? "Sold out" : `Only ${left} seats left`}`);
    return fail(409, "Some seats were taken while you were deciding.", { errors, short: held.short });
  }

  try {
    const { url } = await createCheckoutForOrder(order, serverURL(), payload);
    if (body.form) return NextResponse.redirect(url, 303);
    return NextResponse.json({ ok: true, url, order: order.number || String(order.id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("checkout: the gateway did not open a session", err);
    await abandon(payload, order, "gateway error").catch((e) => console.error("checkout: could not close the order", e));
    return unavailable();
  }
}

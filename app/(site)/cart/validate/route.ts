import { NextResponse } from "next/server";
import { validateCart } from "@/lib/cart/validate";

/**
 * Prices the browser's cart from the CMS as it is now (R03.3): JSON
 * `{ lines: [{kind, id, quantity, option?}], pickupStudio? }` → 200 with
 * `{ lines, errors, subtotal, tax, total, studio }` (see lib/cart/validate.ts).
 * A body that is not a cart → 400.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "The request must be JSON" }, { status: 400 });
  }
  const { lines, pickupStudio } = (body || {}) as { lines?: unknown; pickupStudio?: unknown };
  if (!Array.isArray(lines)) return NextResponse.json({ ok: false, message: "`lines` must be a list" }, { status: 400 });
  const studio = typeof pickupStudio === "number" && Number.isInteger(pickupStudio) ? pickupStudio : undefined;
  try {
    const result = await validateCart(lines, studio);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("cart/validate:", err);
    return NextResponse.json({ ok: false, message: "We could not check your cart just now" }, { status: 500 });
  }
}

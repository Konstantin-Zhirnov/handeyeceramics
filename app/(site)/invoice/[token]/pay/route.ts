import { NextResponse } from "next/server";
import { INVOICE_TOKEN } from "@/lib/invoices/totals";
import { createInvoiceCheckout, gateway, invoiceByToken } from "@/lib/payments";
import { addressOf, rateLimiter, SENDER_LIMIT } from "@/lib/rate-limit";
import { serverURL } from "@/lib/server-url";

/**
 * The "Pay by card" button of an invoice: a Checkout session for what is still
 * due right now (the owner may have edited the invoice since the client opened
 * it), and a 303 to the gateway. A void or paid invoice, or no gateway, sends
 * the client back to the invoice, which says why. Unknown token — 404.
 */
export const dynamic = "force-dynamic";

/** The same brake as on checkout: 5 attempts per sender within 10 minutes. */
const limiter = rateLimiter(SENDER_LIMIT);

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!INVOICE_TOKEN.test(token)) return new NextResponse("Not found", { status: 404 });
  const origin = serverURL();
  const back = `${origin}/invoice/${encodeURIComponent(token)}`;
  const address = addressOf(request.headers);
  if (address && !limiter.allow(`address:${address}`)) {
    return new NextResponse("Too many attempts. Please wait a few minutes and try again.", { status: 429 });
  }
  const invoice = await invoiceByToken(token);
  if (!invoice) return new NextResponse("Not found", { status: 404 });
  if (invoice.status === "void" || (invoice.due ?? 0) <= 0) return NextResponse.redirect(back, 303);
  if (!gateway()) return NextResponse.redirect(`${back}?error=unavailable`, 303);
  try {
    const { url } = await createInvoiceCheckout(invoice, origin);
    return NextResponse.redirect(url, 303);
  } catch (err) {
    console.error(`invoice ${invoice.number}: the gateway did not open a session`, err);
    return NextResponse.redirect(`${back}?error=unavailable`, 303);
  }
}

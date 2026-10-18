import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fakeGateway, gateway } from "@/lib/payments";

/**
 * The fake gateway's checkout page (PAYMENT_GATEWAY=fake, tests and
 * development without keys): what Stripe's hosted page is to a buyer. A form
 * with the buyer's details and two buttons — Pay and Abandon — posted to
 * /checkout/fake/pay. 404 on any other gateway.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Fake checkout", robots: { index: false, follow: false } };

const field = "mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2";

export default async function FakeCheckout({ searchParams }: { searchParams: Promise<{ cs?: string }> }) {
  const gw = gateway();
  if (gw?.name !== "fake") notFound();
  const { cs = "" } = await searchParams;
  const session = cs ? await fakeGateway().retrieveSession(cs) : null;
  if (!session) notFound();
  const payment = session.mode === "payment";

  return (
    <main data-fake-checkout className="mx-auto max-w-md px-5 py-16 font-sans text-neutral-900">
      <p className="text-xs uppercase tracking-wide text-neutral-500">Fake payment gateway — no money moves</p>
      <h1 className="mt-2 text-2xl font-semibold">{!payment ? "Start the subscription" : session.metadata.invoiceNumber ? `Pay invoice ${session.metadata.invoiceNumber}` : `Pay for order ${session.metadata.orderNumber || ""}`}</h1>
      <p className="mt-2 text-sm text-neutral-600">Session {session.id} is {session.status}.</p>
      <form method="post" action="/checkout/fake/pay" className="mt-8 flex flex-col gap-4">
        <input type="hidden" name="cs" value={session.id} />
        <label className="block text-sm">
          Name
          <input name="name" className={field} defaultValue="Test Buyer" />
        </label>
        <label className="block text-sm">
          Email
          <input name="email" type="email" className={field} defaultValue={session.customer.email || "buyer@example.com"} />
        </label>
        <label className="block text-sm">
          Phone
          <input name="phone" className={field} />
        </label>
        {payment && !session.metadata.invoiceNumber && (
          <label className="block text-sm">
            Who is attending
            <input name="attendee" className={field} />
          </label>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="skipWebhook" value="1" />
          Do not send the webhook (the success page finishes the order alone)
        </label>
        <div className="mt-4 flex gap-3">
          <button type="submit" name="action" value="pay" className="rounded-md bg-neutral-900 px-5 py-2 text-white">
            Pay
          </button>
          <button type="submit" name="action" value="abandon" className="rounded-md border border-neutral-400 px-5 py-2">
            Abandon
          </button>
        </div>
      </form>
    </main>
  );
}

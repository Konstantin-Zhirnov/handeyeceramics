import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClearCart } from "@/components/cart/ClearCart";
import { PageHeading, SiteShell } from "@/components/site/SiteShell";
import { addressParts } from "@/lib/cms/address";
import { getCMS } from "@/lib/cms/resolve";
import { SITE_SUFFIX, formatPrice } from "@/lib/cms/text";
import { finalizeOrder, gateway } from "@/lib/payments";
import { relId } from "@/lib/payments/checkout";
import type { Order, Studio } from "@/payload-types";

/**
 * Where the gateway sends the buyer after paying (R24i, R24i.1):
 * `?session_id=` names the Checkout session. The page finishes the order
 * itself — the same `finalizeOrder` the webhook calls, so whichever comes
 * first does the work and the other finds it done — and shows what was
 * bought, where to pick it up and what happens next. A session the site does
 * not know is a 404.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Thank you${SITE_SUFFIX}`,
  robots: { index: false, follow: false },
};

const dollars = (cents: number | null | undefined) => formatPrice((cents || 0) / 100);
const wrap = "mx-auto mt-10 max-w-[62rem] px-5 sm:px-8";
const panel = "rounded-panel border border-clay-200 bg-clay-100 px-6 py-6";

export default async function Success({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id: id = "" } = await searchParams;
  if (!id) notFound();
  const order = await finalizeOrder(id);
  if (!order) {
    const session = await gateway()?.retrieveSession(id);
    if (session?.mode === "subscription" && session.paymentStatus === "paid") {
      const settings = await (await getCMS()).findGlobal({ slug: "settings", depth: 0, overrideAccess: false });
      return <SubscriptionActive portalUrl={settings.stripePortalUrl || ""} />;
    }
    notFound();
  }
  const payload = await getCMS();
  const studioId = relId(order.pickupStudio);
  const studio = studioId ? ((await payload.findByID({ collection: "studios", id: studioId, depth: 0, overrideAccess: false, disableErrors: true })) as Studio | null) : null;
  const number = order.number || String(order.id);
  const paid = order.status === "paid" || order.status === "refunded" || order.status === "partially_refunded";

  if (!paid) return <NotPaid order={order} />;

  const address = addressParts(studio?.address);
  const seats = (order.lines || []).some((l) => l.kind === "session");
  const goods = (order.lines || []).some((l) => l.kind === "product");

  return (
    <SiteShell>
      <ClearCart order={number} />
      <PageHeading eyebrow={`Order ${number}`} title="Thank you for your order">
        <p className="mt-4 max-w-[40rem] text-lg text-ink-soft">
          Your payment went through{order.customer?.email ? ` and a confirmation is on its way to ${order.customer.email}` : ""}.
        </p>
      </PageHeading>

      <div className={`${wrap} grid gap-10 lg:grid-cols-[1fr_22rem]`}>
        <section data-order-lines aria-labelledby="order-lines">
          <h2 id="order-lines" className="eyebrow text-clay-600">
            What you bought
          </h2>
          <ul className="mt-4 divide-y divide-clay-200">
            {(order.lines || []).map((l, i) => (
              <li key={l.id || i} className="flex items-baseline justify-between gap-4 py-3">
                <div>
                  <p className="text-ink">{l.label}</p>
                  {l.option && <p className="text-caption text-ink-soft">{l.option}</p>}
                  <p className="text-caption text-ink-soft">
                    {l.quantity} × {dollars(l.unitAmount)}
                  </p>
                </div>
                <p className="text-ink">{dollars(l.lineTotal ?? l.unitAmount * l.quantity + (l.taxAmount || 0))}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-4 flex flex-col gap-1 border-t border-clay-200 pt-4 text-ink">
            <div className="flex justify-between">
              <dt className="text-ink-soft">Subtotal</dt>
              <dd>{dollars(order.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">Tax</dt>
              <dd>{dollars(order.tax)}</dd>
            </div>
            <div className="flex justify-between text-lg font-semibold">
              <dt>Total</dt>
              <dd data-order-total>{dollars(order.total)}</dd>
            </div>
          </dl>
          {order.status !== "paid" && (
            <p className="mt-4 text-ink-soft">This order has since been {order.status === "refunded" ? "refunded" : "partially refunded"}.</p>
          )}
        </section>

        <aside className="flex flex-col gap-6">
          {studio && (
            <div data-pickup-studio className={panel}>
              <h2 className="eyebrow text-clay-600">Your studio</h2>
              <p className="mt-2 text-lg text-ink">{studio.name}</p>
              {address.street && <p className="text-ink-soft">{address.street}</p>}
              {address.locality && (
                <p className="text-ink-soft">
                  {[address.locality, address.regionCode].filter(Boolean).join(", ")} {address.postalCode}
                </p>
              )}
              {studio.phone && <p className="mt-2 text-ink-soft">{studio.phone}</p>}
            </div>
          )}
          <div data-what-next className={panel}>
            <h2 className="eyebrow text-clay-600">What happens next</h2>
            <ul className="mt-2 flex flex-col gap-2 text-ink-soft">
              <li>Your confirmation email has the details of this order{seats ? ", your class dates and how to get into the studio" : ""}.</li>
              {seats && <li>Come to the studio a few minutes before your class starts. No ticket needed — you are on the list.</li>}
              {goods && <li>Pieces and clay are picked up at the studio{studio ? ` (${studio.name})` : ""}; we do not ship.</li>}
              <li>Questions? Call or email the studio — the contacts are in the footer.</li>
            </ul>
          </div>
        </aside>
      </div>
    </SiteShell>
  );
}

/** The buyer came back without paying, or the session ran out: nothing is charged, the cart is still theirs. */
function NotPaid({ order }: { order: Order }) {
  const expired = order.status !== "pending";
  return (
    <SiteShell>
      <PageHeading eyebrow={`Order ${order.number || order.id}`} title={expired ? "This checkout has expired" : "Your payment has not gone through yet"}>
        <p className="mt-4 max-w-[40rem] text-lg text-ink-soft">
          {expired ? "Nothing was charged and the seats went back on sale. Your cart is still here." : "If you have just paid, give it a moment and reload this page. Nothing is charged twice."}
        </p>
        <Link href="/cart" className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-terracotta px-7 text-copy font-semibold text-clay-50 hover:bg-ink">
          Back to the cart
        </Link>
      </PageHeading>
    </SiteShell>
  );
}

/** A membership paid through Checkout: there is no order to show, only the good news and where the subscription is managed. */
function SubscriptionActive({ portalUrl }: { portalUrl: string }) {
  return (
    <SiteShell>
      <PageHeading eyebrow="Membership" title="Your subscription is active">
        <p data-subscription-active className="mt-4 max-w-[40rem] text-lg text-ink-soft">
          Thank you — the first payment went through and the membership starts now.{" "}
          {portalUrl ? (
            <>
              To change your card or cancel, use the{" "}
              <a href={portalUrl} className="underline" rel="noopener">
                membership portal
              </a>
              .
            </>
          ) : (
            "To change your card or cancel, contact the studio — the contacts are in the footer."
          )}
        </p>
      </PageHeading>
    </SiteShell>
  );
}

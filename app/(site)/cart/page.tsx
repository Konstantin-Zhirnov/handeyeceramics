import type { Metadata } from "next";
import { CartPage } from "@/components/cart/CartPage";
import { PageHeading, SiteShell } from "@/components/site/SiteShell";
import { SHOP_PATH } from "@/lib/cms/resolve";
import { SITE_SUFFIX } from "@/lib/cms/text";

/** The cart (R03): a static route outside the catch-all; the lines live in the browser and are priced by POST /cart/validate. */
export const dynamic = "force-dynamic";

const TITLE = "Your cart";

export const metadata: Metadata = {
  title: `${TITLE}${SITE_SUFFIX}`,
  description: "What you are about to buy: class seats, clay and pieces, with tax, picked up at the studio.",
  robots: { index: false, follow: true },
};

export default function Cart() {
  return (
    <SiteShell>
      <PageHeading eyebrow="Shop" title={TITLE} />
      <div className="mx-auto mt-10 max-w-[62rem] px-5 sm:px-8">
        <CartPage shopPath={SHOP_PATH} />
      </div>
    </SiteShell>
  );
}

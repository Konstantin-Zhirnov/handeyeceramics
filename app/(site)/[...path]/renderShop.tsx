import type { Page } from "@/payload-types";
import { ShopPage } from "@/components/shop/ShopPage";

/** Storefront (/shop and the old category pages). The template lives in components/shop. */
export function renderShop(doc: Page) {
  return <ShopPage doc={doc} />;
}

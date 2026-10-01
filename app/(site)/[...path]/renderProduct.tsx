import type { Product } from "@/payload-types";
import { ProductPage } from "@/components/shop/ProductPage";

/** Product page. The template lives in components/shop. */
export function renderProduct(doc: Product) {
  return <ProductPage doc={doc} />;
}

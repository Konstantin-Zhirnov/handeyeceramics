import { productsOfList } from "@/components/shop/data";
import { ProductGrid, ProductShelves } from "@/components/shop/parts";

/**
 * `productList` block: the visible products of one category, or — with `all` —
 * the whole shop, a shelf per category. An empty list says so.
 */
export async function ProductListBlock({
  heading,
  category,
  all,
}: {
  heading?: string | null;
  category?: string | null;
  all?: boolean | null;
}) {
  const products = await productsOfList({ category, all });
  return (
    <section data-product-list>
      {heading && <h2 className="display mb-4 text-2xl text-ink">{heading}</h2>}
      {all ? <ProductShelves products={products} /> : <ProductGrid products={products} />}
    </section>
  );
}

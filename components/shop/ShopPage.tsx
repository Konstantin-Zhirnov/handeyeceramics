import type { Page } from "@/payload-types";
import { Blocks } from "@/components/blocks/Blocks";
import { ProductListBlock } from "@/components/blocks/ProductListBlock";
import { PageHeading, SiteShell } from "@/components/site/SiteShell";
import { StorefrontNav } from "./parts";

const band = "mx-auto max-w-[62rem] px-5 sm:px-8";

/** A storefront: the page's own blocks, its product list among them; buying happens on the product pages. */
export function ShopPage({ doc }: { doc: Page }) {
  const hasList = doc.blocks?.some((b) => b.blockType === "productList");
  return (
    <SiteShell>
      <PageHeading title={doc.h1 || doc.title} />
      <StorefrontNav current={doc.path} />
      <Blocks blocks={doc.blocks} />
      {!hasList && (
        <div className={`${band} mt-10`}>
          <ProductListBlock all />
        </div>
      )}
    </SiteShell>
  );
}

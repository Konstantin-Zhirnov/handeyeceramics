import Image from "next/image";
import type { Product } from "@/payload-types";
import { PageHeading, SiteShell } from "@/components/site/SiteShell";
import { site } from "@/lib/site";
import { splitCategories } from "./data";
import { BuyNotice, Price, ProductOptions, currentPrice, productImages } from "./parts";

const absolute = (url: string) => (url.startsWith("/") ? `${site.url}${url}` : url);

/** schema.org Product: what the page says, nothing more. */
function jsonLd(doc: Product) {
  const price = currentPrice(doc);
  const images = productImages(doc).map((m) => absolute(m.url!));
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: doc.name,
    ...(doc.description ? { description: doc.description } : {}),
    ...(images.length ? { image: images } : {}),
    ...(doc.category ? { category: doc.category } : {}),
    ...(typeof price === "number"
      ? { offers: { "@type": "Offer", price: price.toFixed(2), priceCurrency: "CAD", url: `${site.url}${doc.path}` } }
      : {}),
  };
}

/** Product page: photos, price, variants, description; no checkout yet. */
export function ProductPage({ doc }: { doc: Product }) {
  const [first, ...rest] = productImages(doc);
  return (
    <SiteShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(doc)).replace(/</g, "\\u003c") }}
      />
      <PageHeading eyebrow={splitCategories(doc.category)[0]} title={doc.name}>
        <p className="mt-4 text-xl text-ink">
          <Price product={doc} />
        </p>
      </PageHeading>
      <div className="mx-auto mt-8 grid max-w-[62rem] gap-10 px-5 sm:px-8 md:grid-cols-2">
        <div className="min-w-0">
          {first ? (
            <Image
              src={first.url!}
              alt={first.alt}
              width={first.width || 1200}
              height={first.height || 1200}
              sizes="(max-width: 768px) 100vw, 30rem"
              priority
              className="h-auto w-full rounded-[20px] bg-clay-100"
            />
          ) : (
            <div aria-hidden className="aspect-square w-full rounded-[20px] bg-clay-100" />
          )}
          {rest.length > 0 && (
            <ul className="mt-3 grid grid-cols-3 gap-3">
              {rest.map((m) => (
                <li key={m.id}>
                  <Image
                    src={m.url!}
                    alt={m.alt}
                    width={320}
                    height={320}
                    sizes="(max-width: 768px) 33vw, 10rem"
                    className="aspect-square w-full rounded-[14px] bg-clay-100 object-cover"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-8">
          <ProductOptions options={doc.options} />
          <BuyNotice />
          {doc.description && (
            <div className="whitespace-pre-line leading-relaxed text-ink-soft [overflow-wrap:anywhere]">{doc.description}</div>
          )}
        </div>
      </div>
    </SiteShell>
  );
}

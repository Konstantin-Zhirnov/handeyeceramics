import type { Product } from "@/payload-types";
import { AddToCart } from "@/components/cart/AddToCart";
import { formatPrice } from "@/lib/cms/text";
import { PageHeading, SiteShell } from "@/components/site/SiteShell";
import { TrackOnMount } from "@/components/site/TrackEvents";
import { giftAmountChoices } from "@/lib/giftcards/code";
import { site } from "@/lib/site";
import { ProductGallery } from "./ProductGallery";
import { recommendedFor, sessionChoices, splitCategories } from "./data";
import { CallStudio, Price, ProductGrid, currentPrice, optionChoices, productImages } from "./parts";

const absolute = (url: string) => (url.startsWith("/") ? `${site.url}${url}` : url);

/** The amounts a gift card product offers, in dollars, for the buying controls; undefined for any other product. */
function giftOffer(doc: Product) {
  if (!doc.giftCard) return undefined;
  const choices = giftAmountChoices(doc.giftAmounts).map((c) => c / 100);
  const otherMin = typeof doc.giftOtherMin === "number" ? doc.giftOtherMin : undefined;
  if (!choices.length && otherMin === undefined) return undefined;
  return { choices, ...(otherMin !== undefined ? { otherMin, otherMax: typeof doc.giftOtherMax === "number" ? doc.giftOtherMax : undefined } : {}) };
}

/** schema.org Product: what the page says, nothing more. */
function jsonLd(doc: Product) {
  const price = doc.giftCard ? (giftAmountChoices(doc.giftAmounts)[0] ?? 0) / 100 || null : currentPrice(doc);
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

/** What the ad tags learn about the product shown: the same item id the purchase carries. */
function viewContent(doc: Product) {
  const price = currentPrice(doc);
  return {
    content_ids: [`product-${doc.id}`],
    content_type: "product",
    content_name: doc.name,
    ...(typeof price === "number" ? { value: price, currency: "CAD" } : {}),
  };
}

/** Product page: photos, price, the dates of a class or the variants, Add to cart, description, then "You might also like". */
export async function ProductPage({ doc }: { doc: Product }) {
  const photos = productImages(doc);
  const [{ choices: sessions, scheduled }, recommended] = await Promise.all([sessionChoices(doc), recommendedFor(doc)]);
  // A class whose dates are all over or hidden is not for sale until a date is added in the admin.
  const noDates = scheduled && !sessions.length;
  const gift = giftOffer(doc);
  return (
    <SiteShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(doc)).replace(/</g, "\\u003c") }}
      />
      <PageHeading eyebrow={splitCategories(doc.category)[0]} title={doc.name}>
        <p className="mt-4 text-xl text-ink">
          {gift ? <span data-price>{gift.choices.length ? `From ${formatPrice(Math.min(...gift.choices))}` : "Any amount"}</span> : <Price product={doc} />}
        </p>
      </PageHeading>
      <div className="mx-auto mt-8 grid max-w-[62rem] gap-10 px-5 sm:px-8 md:grid-cols-2">
        <div className="min-w-0 md:sticky md:top-32 md:self-start">
          <ProductGallery photos={photos.map((m) => ({ id: m.id, url: m.url!, alt: m.alt, width: m.width, height: m.height }))} />
        </div>
        <div className="flex min-w-0 flex-col gap-8">
          <div data-buy className="flex flex-col gap-5">
            {noDates ? (
              <p data-no-dates className="rounded-inset border border-dashed border-clay-200 px-5 py-4 text-copy text-ink-soft">
                No dates scheduled — call the studio to ask about the next one.
              </p>
            ) : (
              <AddToCart productId={doc.id} price={gift ? null : currentPrice(doc) ?? null} options={gift ? [] : optionChoices(doc.options)} sessions={gift ? [] : sessions} gift={gift} />
            )}
            <TrackOnMount meta={{ name: "ViewContent", data: viewContent(doc) }} google={{ name: "view_item", data: viewContent(doc) }} />
            <CallStudio />
          </div>
          {doc.description && (
            <div className="whitespace-pre-line leading-relaxed text-ink-soft [overflow-wrap:anywhere]">{doc.description}</div>
          )}
        </div>
      </div>
      {recommended.length > 0 && (
        <section data-recommended aria-labelledby="recommended-heading" className="mx-auto mt-16 max-w-[62rem] px-5 sm:px-8">
          <h2 id="recommended-heading" className="display mb-6 text-heading-sm text-ink">
            You might also like
          </h2>
          <ProductGrid products={recommended} four />
        </section>
      )}
    </SiteShell>
  );
}

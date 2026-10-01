import Image from "next/image";
import Link from "next/link";
import type { Media, Product } from "@/payload-types";
import { getCMS } from "@/lib/cms/resolve";
import { formatPrice } from "@/lib/cms/text";

/** `productList` block: visible products, optionally of one category. */
export async function ProductListBlock({ heading, category }: { heading?: string | null; category?: string | null }) {
  const payload = await getCMS();
  const { docs } = await payload.find({
    collection: "products",
    where: { visible: { not_equals: false }, ...(category ? { category: { contains: category } } : {}) },
    limit: 200,
    depth: 1,
    pagination: false,
  });
  if (!docs.length) return null;
  return (
    <section>
      {heading && <h2 className="display mb-4 text-2xl text-ink">{heading}</h2>}
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {(docs as Product[]).map((p) => {
          const img = p.images?.[0] && typeof p.images[0] === "object" ? (p.images[0] as Media) : null;
          return (
            <li key={p.id}>
              <Link href={p.path} className="block">
                {img?.url && (
                  <Image src={img.url} alt={img.alt} width={480} height={480} className="aspect-square w-full rounded-[16px] object-cover" />
                )}
                <span className="mt-2 block text-ink">{p.name}</span>
                <span className="block text-sm text-ink-soft">{formatPrice(p.price)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

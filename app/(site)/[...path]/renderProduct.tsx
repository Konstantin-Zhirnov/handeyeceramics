import Image from "next/image";
import type { Media, Product } from "@/payload-types";
import { PageHeading, SiteShell } from "@/components/site/SiteShell";
import { formatPrice } from "@/lib/cms/text";

/** Product page. Task 05 owns this template. */
export function renderProduct(doc: Product) {
  const images = (doc.images || []).filter((m): m is Media => typeof m === "object" && !!m?.url);
  return (
    <SiteShell>
      <PageHeading eyebrow={doc.category || undefined} title={doc.name}>
        <p className="mt-4 text-xl text-ink">{formatPrice(doc.price)}</p>
      </PageHeading>
      <div className="mx-auto mt-8 grid max-w-[62rem] gap-8 px-5 sm:px-8 md:grid-cols-2">
        <div className="grid gap-3">
          {images.map((m) => (
            <Image key={m.id} src={m.url!} alt={m.alt} width={m.width || 1200} height={m.height || 1200} className="h-auto w-full rounded-[20px]" />
          ))}
        </div>
        <div className="whitespace-pre-line leading-relaxed text-ink-soft [overflow-wrap:anywhere]">{doc.description}</div>
      </div>
    </SiteShell>
  );
}

import Image from "next/image";
import Link from "next/link";
import type { Media, Plan, Product } from "@/payload-types";
import { mediaSrc } from "@/lib/cms/media";
import { formatPrice } from "@/lib/cms/text";
import { splitCategories, storefronts, studioPhone } from "./data";

/** Shown wherever the admin holds no fact yet. */
const TBD = "[TBD]";

export const BUY_LABEL = "Online checkout coming soon — call the studio";

export { mediaSrc };

export const productImages = (p: Product): Media[] =>
  (p.images || [])
    .filter((m): m is Media => typeof m === "object" && !!m?.url)
    .map((m) => ({ ...m, url: mediaSrc(m.url!) }));

/** The price a visitor pays: the sale price when one is set. */
export const currentPrice = (p: Pick<Product, "price" | "salePrice">) =>
  typeof p.salePrice === "number" && p.salePrice !== p.price ? p.salePrice : p.price;

/** CA$371.00 struck through next to CA$296.80, or one price. */
export function Price({ product }: { product: Pick<Product, "price" | "salePrice"> }) {
  const current = currentPrice(product);
  const onSale = current !== product.price && typeof product.price === "number";
  return (
    <span data-price>
      {onSale && (
        <s data-price-regular className="mr-2 text-ink-soft">
          {formatPrice(product.price)}
        </s>
      )}
      <span data-price-current>{formatPrice(current) || TBD}</span>
    </span>
  );
}

/** Checkout is not built yet (stage 3): a disabled button and the phone to call. */
export async function BuyNotice() {
  const phone = await studioPhone();
  return (
    <div data-buy className="flex flex-col items-start gap-3">
      <button
        type="button"
        disabled
        aria-disabled="true"
        className="cursor-not-allowed rounded-stage border border-clay-200 bg-clay-100 px-6 py-3 text-left text-copy font-semibold text-ink-soft"
      >
        {BUY_LABEL}
      </button>
      {phone.href && (
        <a
          href={phone.href}
          className="flex h-12 items-center justify-center rounded-full bg-sky-brand px-7 text-copy font-semibold text-sky-ink transition-transform hover:-translate-y-0.5"
        >
          Call {phone.display}
        </a>
      )}
    </div>
  );
}

export const EmptyShelf = () => (
  <p data-empty className="rounded-card border border-dashed border-clay-200 px-6 py-10 text-center text-ink-soft">
    No products here yet.
  </p>
);

/** `lead` — the first grid of a page: its first row is on the first screen of a phone and loads at once. */
export function ProductGrid({ products, lead = false }: { products: Product[]; lead?: boolean }) {
  if (!products.length) return <EmptyShelf />;
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3">
      {products.map((p, i) => {
        const img = productImages(p)[0];
        return (
          <li key={p.id} data-product className="min-w-0">
            {/* No prefetch: a shelf is dozens of links, and fetching every product page in advance stalls a phone. */}
            <Link href={p.path} prefetch={false} className="group block">
              {img ? (
                <Image
                  src={img.url!}
                  alt={img.alt}
                  width={480}
                  height={480}
                  sizes="(max-width: 640px) 50vw, 20rem"
                  loading={lead && i < 2 ? "eager" : undefined}
                  fetchPriority={lead && i === 0 ? "high" : undefined}
                  className="aspect-square w-full rounded-inset bg-clay-100 object-cover transition-transform group-hover:-translate-y-0.5"
                />
              ) : (
                <span aria-hidden className="block aspect-square w-full rounded-inset bg-clay-100" />
              )}
              <span className="mt-3 block leading-snug text-ink [overflow-wrap:anywhere] group-hover:underline">{p.name}</span>
              <span className="mt-1 block text-sm text-ink-soft">
                <Price product={p} />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** A list with no category shows the whole shop, one shelf per category. */
export function ProductShelves({ products, lead = false }: { products: Product[]; lead?: boolean }) {
  if (!products.length) return <EmptyShelf />;
  const shelves = new Map<string, Product[]>();
  for (const p of products) {
    const name = splitCategories(p.category)[0] || "Other";
    shelves.set(name, [...(shelves.get(name) || []), p]);
  }
  return (
    <div className="flex flex-col gap-10">
      {[...shelves].map(([name, items], i) => (
        <div key={name} data-shelf>
          <h3 className="eyebrow mb-4 text-clay-600">{name}</h3>
          <ProductGrid products={items} lead={lead && i === 0} />
        </div>
      ))}
    </div>
  );
}

/** The variants the old store offered, in the same drop-downs. Choosing one buys nothing yet. */
export function ProductOptions({ options }: { options: Product["options"] }) {
  if (!options?.length) return null;
  return (
    <div className="flex flex-col gap-5">
      {options.map((o, i) => {
        const choices = o.choices
          .split(/\r?\n/)
          .map((c) => c.trim())
          .filter(Boolean);
        return (
          <div key={o.id || i} data-product-option className="flex min-w-0 flex-col gap-2">
            <label htmlFor={`option-${i}`} className="eyebrow text-clay-600">
              <span data-option-title>{o.title}</span> *
            </label>
            <select
              id={`option-${i}`}
              defaultValue=""
              className="w-full min-w-0 rounded-inset border border-clay-200 bg-clay-50 px-4 py-3 text-ink"
            >
              <option value="">Select</option>
              {choices.map((c, j) => (
                <option key={j} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}

/** Links between the shop's sections; the current one is marked. */
export async function StorefrontNav({ current }: { current: string }) {
  const all = await storefronts();
  if (all.length < 2) return null;
  return (
    <nav aria-label="Shop sections" className="mx-auto mt-8 max-w-[62rem] px-5 sm:px-8">
      <ul className="flex flex-wrap gap-2">
        {all.map((s) => (
          <li key={s.path} className="max-w-full">
            <Link
              href={s.path}
              aria-current={s.path === current ? "page" : undefined}
              className={`flex min-h-11 items-center rounded-full border px-4 py-2 text-sm [overflow-wrap:anywhere] ${
                s.path === current ? "border-ink bg-ink text-clay-50" : "border-clay-200 text-ink hover:bg-clay-100"
              }`}
            >
              {s.title}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Plans from the admin; `grouped` puts them under their `group` headings. */
export function PlanList({ plans, grouped = true }: { plans: Plan[]; grouped?: boolean }) {
  if (!plans.length) {
    return (
      <p data-empty className="rounded-card border border-dashed border-clay-200 px-6 py-10 text-center text-ink-soft">
        No plans here yet.
      </p>
    );
  }
  const groups = new Map<string, Plan[]>();
  for (const p of plans) {
    const name = grouped ? p.group?.trim() || "" : "";
    groups.set(name, [...(groups.get(name) || []), p]);
  }
  return (
    <div className="flex flex-col gap-12">
      {[...groups].map(([name, items]) => (
        <section key={name} data-plan-group>
          {name && <h2 className="display mb-5 text-title text-ink">{name}</h2>}
          <ul className="grid gap-4 sm:grid-cols-2">
            {items.map((p) => (
              <li key={p.id} data-plan className="flex min-w-0 flex-col rounded-panel border border-clay-200 bg-clay-100 px-6 py-6">
                <h3 className="text-lg font-semibold text-ink [overflow-wrap:anywhere]">{p.name}</h3>
                <p className="display mt-3 text-title-lg leading-none text-ink">
                  <span data-plan-price>{formatPrice(p.price) || TBD}</span>
                </p>
                {p.period && (
                  <p data-plan-period className="mt-1 text-sm text-ink-soft">
                    {p.period}
                  </p>
                )}
                {p.description && (
                  <p className="mt-4 whitespace-pre-line leading-relaxed text-ink-soft [overflow-wrap:anywhere]">{p.description}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

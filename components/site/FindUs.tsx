import type { Page } from "@/payload-types";
import { openStudios } from "@/lib/cms/site";

type Node = { type?: string; text?: string; children?: Node[] };
const FIND_US = /^\s*find us\s*$/i;

/** True when the page carries Wix's "FIND US" heading (a map on Wix): the studios are listed under it. */
export function hasFindUs(blocks: Page["blocks"]): boolean {
  const heads = (n: Node | undefined): boolean =>
    !!n && ((n.type === "heading" && FIND_US.test((n.children || []).map((c) => c.text || "").join(""))) || !!n.children?.some(heads));
  return (blocks || []).some(
    (b) => b.blockType === "text" && (FIND_US.test(b.heading || "") || heads((b.body as { root?: Node } | null | undefined)?.root)),
  );
}

/** Addresses and phones of the open studios, from the admin: what the map showed on the old contact page. */
export async function FindUs() {
  const studios = await openStudios();
  if (!studios.length) return null;
  return (
    <section data-find-us className="mx-auto mt-6 grid max-w-[62rem] gap-4 px-5 sm:grid-cols-3 sm:px-8">
      {studios.map((s) => (
        <div key={s.id} className="rounded-[20px] border border-clay-200 bg-clay-100 px-5 py-4">
          <h3 className="display text-lg text-ink">{s.name}</h3>
          <p className="mt-2 text-ink-soft">{s.street}</p>
          {(s.locality || s.regionCode) && (
            <p className="text-ink-soft">{[s.locality, [s.regionCode, s.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</p>
          )}
          {s.phoneHref && (
            <a href={s.phoneHref} className="mt-3 inline-block font-semibold text-sky-deep underline">
              {s.phone}
            </a>
          )}
        </div>
      ))}
    </section>
  );
}

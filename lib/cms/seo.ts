import type { Metadata } from "next";
import type { Page } from "@/payload-types";
import { site } from "@/lib/site";
import type { Resolved } from "./resolve";
import { SITE_SUFFIX, excerpt, lexicalText } from "./text";

/** All the visible text of a page's blocks, for a description fallback. */
export function pageText(page: Pick<Page, "h1" | "blocks">): string {
  const parts: string[] = [page.h1 || ""];
  for (const b of page.blocks || []) {
    if (b.blockType === "text") parts.push(b.heading || "", lexicalText(b.body));
    if (b.blockType === "cta") parts.push(b.heading, b.body || "", b.buttonLabel);
  }
  return parts.join(" ");
}

const pageMeta = (page: Page) => ({
  title: page.seo?.title || `${page.title}${SITE_SUFFIX}`,
  description: page.seo?.description || excerpt(pageText(page)),
});

/** title + description of a resolved document (story 7 and 8). */
export async function metadataFor(r: Resolved): Promise<Metadata> {
  let meta: { title: string; description: string };
  switch (r.kind) {
    case "studio": {
      const page = r.page ? pageMeta(r.page) : undefined;
      meta = {
        title: r.doc.seo?.title || page?.title || `${r.doc.name}${SITE_SUFFIX}`,
        description: r.doc.seo?.description || page?.description || excerpt(r.doc.description || ""),
      };
      break;
    }
    case "product":
      meta = {
        title: r.doc.seo?.title || `${r.doc.name}${SITE_SUFFIX}`,
        description: r.doc.seo?.description || excerpt(r.doc.description || r.doc.name),
      };
      break;
    default:
      meta = pageMeta(r.doc);
  }
  const url = `${site.url}${r.doc.path}`;
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: url },
    openGraph: { title: meta.title, description: meta.description, url, type: "website" },
  };
}

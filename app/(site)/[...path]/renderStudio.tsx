import type { Page, Studio } from "@/payload-types";
import { Blocks } from "@/components/blocks/Blocks";
import { PageHeading, SiteShell } from "@/components/site/SiteShell";

/**
 * Studio page. Task 04 owns this template. `page` is the studio's own Wix
 * page (same path), whose text and H1 are kept as they were.
 */
export function renderStudio(doc: Studio, page?: Page) {
  return (
    <SiteShell>
      <PageHeading eyebrow={doc.name} title={page?.h1 || doc.name}>
        {doc.address && <p className="mt-4 whitespace-pre-line text-ink-soft">{doc.address}</p>}
      </PageHeading>
      {page ? <Blocks blocks={page.blocks} /> : <p className="mx-auto mt-8 max-w-[62rem] px-5 sm:px-8">{doc.description}</p>}
    </SiteShell>
  );
}

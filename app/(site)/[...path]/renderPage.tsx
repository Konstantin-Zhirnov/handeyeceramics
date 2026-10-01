import type { Page } from "@/payload-types";
import { Blocks } from "@/components/blocks/Blocks";
import { PageHeading, SiteShell } from "@/components/site/SiteShell";

/** Content page: the H1, then the blocks in page order. */
export function renderPage(doc: Page) {
  return (
    <SiteShell>
      <PageHeading title={doc.h1 || doc.title} />
      <Blocks blocks={doc.blocks} />
    </SiteShell>
  );
}

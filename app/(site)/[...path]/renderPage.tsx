import type { Page } from "@/payload-types";
import { Blocks } from "@/components/blocks/Blocks";
import { FindUs, hasFindUs } from "@/components/site/FindUs";
import { PageHeading, SiteShell } from "@/components/site/SiteShell";

/** Content page: the H1, then the blocks in page order; under a "FIND US" heading (a map on Wix), the studios. */
export function renderPage(doc: Page) {
  return (
    <SiteShell>
      <PageHeading title={doc.h1 || doc.title} />
      <Blocks blocks={doc.blocks} />
      {hasFindUs(doc.blocks) && <FindUs />}
    </SiteShell>
  );
}

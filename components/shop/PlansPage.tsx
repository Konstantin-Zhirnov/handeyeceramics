import type { Page } from "@/payload-types";
import { Blocks } from "@/components/blocks/Blocks";
import { PageHeading, SiteShell } from "@/components/site/SiteShell";
import { allPlans } from "./data";
import { BuyNotice, PlanList } from "./parts";

/**
 * Plans & pricing: the plans without a group — those of the old Wix plans page.
 * Memberships and the wheel rental have a group and are listed on their own pages.
 */
export async function PlansPage({ doc }: { doc: Page }) {
  const plans = (await allPlans()).filter((p) => !(p.group || "").trim());
  return (
    <SiteShell>
      <PageHeading title={doc.h1 || doc.title} />
      <div className="mx-auto mt-10 max-w-[62rem] px-5 sm:px-8">
        <PlanList plans={plans} />
        <div className="mt-12">
          <BuyNotice />
        </div>
      </div>
      <Blocks blocks={doc.blocks} />
    </SiteShell>
  );
}

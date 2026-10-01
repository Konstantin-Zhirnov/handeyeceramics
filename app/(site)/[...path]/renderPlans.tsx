import type { Page } from "@/payload-types";
import { PlansPage } from "@/components/shop/PlansPage";

/** Plans & pricing page: the plans come from the `plans` collection. */
export function renderPlans(doc: Page) {
  return <PlansPage doc={doc} />;
}

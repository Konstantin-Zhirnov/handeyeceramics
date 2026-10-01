import type { Page } from "@/payload-types";
import { renderPage } from "./renderPage";

/** Plans & pricing page. Task 05 owns this template (plans come from the `plans` collection). */
export function renderPlans(doc: Page) {
  return renderPage(doc);
}

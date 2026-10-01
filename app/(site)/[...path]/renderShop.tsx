import type { Page } from "@/payload-types";
import { renderPage } from "./renderPage";

/** Storefront (/shop and the Wix category pages). Task 05 owns this template. */
export function renderShop(doc: Page) {
  return renderPage(doc);
}

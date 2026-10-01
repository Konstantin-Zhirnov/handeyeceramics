import "server-only";
import { cache } from "react";
import type { Page, Plan, Product } from "@/payload-types";
import { getCMS } from "@/lib/cms/resolve";
import { phoneHref } from "@/lib/cms/site";

/** "Clay, Open Studio & Private Lessons" → ["Clay", "Open Studio & Private Lessons"]. */
export const splitCategories = (category: string | null | undefined) =>
  (category || "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

/**
 * Every product a visitor may see. Read as the visitor (`overrideAccess:
 * false`), so a product hidden in the admin never reaches a storefront.
 */
export const allProducts = cache(async (): Promise<Product[]> => {
  const payload = await getCMS();
  const res = await payload.find({
    collection: "products",
    overrideAccess: false,
    sort: "name",
    depth: 1,
    limit: 1000,
    pagination: false,
  });
  return res.docs;
});

/** What a `productList` block lists: everything, or one category (exact name, any letter case); no category — nothing. */
export async function productsOfList(list: { category?: string | null; all?: boolean | null }): Promise<Product[]> {
  const all = await allProducts();
  if (list.all) return all;
  const want = (list.category || "").trim().toLowerCase();
  if (!want) return [];
  return all.filter((p) => splitCategories(p.category).some((c) => c.toLowerCase() === want));
}

/** All plans, in the order set in the admin. */
export const allPlans = cache(async (): Promise<Plan[]> => {
  const payload = await getCMS();
  const res = await payload.find({ collection: "plans", overrideAccess: false, sort: "order", limit: 500, pagination: false });
  return res.docs;
});

/** Plans of one group (exact name, any letter case); no group — all of them. */
export async function plansIn(group?: string | null): Promise<Plan[]> {
  const all = await allPlans();
  const want = (group || "").trim().toLowerCase();
  return want ? all.filter((p) => (p.group || "").trim().toLowerCase() === want) : all;
}

/** The business phone from the site settings: what to show and its tel: link. */
export const studioPhone = cache(async (): Promise<{ display: string; href: string }> => {
  const payload = await getCMS();
  const settings = await payload.findGlobal({ slug: "settings", overrideAccess: false, depth: 0 });
  return { display: settings.phone || "", href: phoneHref(settings.phone) };
});

export type Storefront = { path: string; title: string };

/** Published pages that list products and have something to list — the shop's sections. */
export const storefronts = cache(async (): Promise<Storefront[]> => {
  const payload = await getCMS();
  const res = await payload.find({ collection: "pages", overrideAccess: false, sort: "title", depth: 0, limit: 1000, pagination: false });
  const out: Storefront[] = [];
  for (const page of res.docs as Page[]) {
    const lists = (page.blocks || []).filter((b) => b.blockType === "productList");
    if (!lists.length) continue;
    const counts = await Promise.all(lists.map((b) => productsOfList(b).then((p) => p.length)));
    if (counts.some(Boolean)) out.push({ path: page.path, title: page.title });
  }
  return out;
});

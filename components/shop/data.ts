import "server-only";
import { cache } from "react";
import type { Page, Plan, Product, Session, Studio } from "@/payload-types";
import type { SessionChoice } from "@/components/cart/AddToCart";
import { isSellable } from "@/lib/booking/availability";
import { scheduledProducts, sessionPrice } from "@/lib/cart/validate";
import { addressParts } from "@/lib/cms/address";
import { relId } from "@/lib/cms/relations";
import { getCMS } from "@/lib/cms/resolve";
import { phoneHref } from "@/lib/cms/site";
import { recommend } from "./recommend";

/**
 * The dates of a class as its page lists them (R01.3, R02): the visitor's view
 * of the sessions collection (hidden ones never arrive), without the dates
 * that are over; a date that cannot be bought is listed and marked sold out.
 */
export async function sessionChoices(product: Product, now = new Date()): Promise<{ choices: SessionChoice[]; scheduled: boolean }> {
  const payload = await getCMS();
  // A class has dates of some status, even when none is open to buy: then it is not sold as a plain product.
  const scheduled = (await scheduledProducts(payload, [product.id])).has(product.id);
  if (!scheduled) return { choices: [], scheduled };
  // Only the dates not yet over are asked for: a class imported with years of past dates (hundreds of
  // them) would otherwise fill the 500 first by date with the past and show none of the coming ones.
  const res = await payload.find({
    collection: "sessions",
    where: { and: [{ product: { equals: product.id } }, { or: [{ endsAt: { greater_than_equal: now.toISOString() } }, { endsAt: { exists: false } }] }] },
    overrideAccess: false,
    sort: "startsAt",
    depth: 0,
    limit: 500,
    pagination: false,
  });
  const choices = (res.docs as Session[])
    .filter((s) => !(s.endsAt && new Date(s.endsAt).getTime() < now.getTime()))
    .map((s) => ({ id: s.id, label: s.label, price: sessionPrice(s, product), sellable: isSellable(s, now), left: s.left ?? 0 }));
  return { choices, scheduled };
}

/**
 * "You might also like" under a product (components/shop/recommend.ts): the
 * owner's pick, else other classes in the same city. Everything is read as
 * the visitor: hidden products, hidden dates and unpublished studios never count.
 */
export async function recommendedFor(product: Product, now = new Date()): Promise<Product[]> {
  const payload = await getCMS();
  const [products, studios, sessions] = await Promise.all([
    allProducts(),
    payload.find({ collection: "studios", overrideAccess: false, depth: 0, limit: 100, pagination: false }),
    payload.find({ collection: "sessions", overrideAccess: false, depth: 0, limit: 0, pagination: false }),
  ]);
  const byId = new Map(products.map((p) => [p.id, p]));
  const ids = recommend({
    product: product.id,
    picked: (product.recommended || []).map((r) => relId(r)).filter((id): id is number => !!id),
    dates: (sessions.docs as Session[]).flatMap((s) => {
      const p = relId(s.product);
      const studio = relId(s.studio);
      return p && studio ? [{ product: p, studio, startsAt: s.startsAt ?? null, sellable: isSellable(s, now) }] : [];
    }),
    studios: (studios.docs as Studio[]).map((s) => ({ id: s.id, city: addressParts(s.address).locality })),
    visible: new Set(byId.keys()),
  });
  return ids.map((id) => byId.get(id)!);
}

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

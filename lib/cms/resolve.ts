import "server-only";
import { cache } from "react";
import { getPayload, type Payload } from "payload";
import config from "@payload-config";
import { normalizePath } from "@/collections/fields/path";
import { withoutLoops } from "@/lib/redirect-loops";
import type { Page, Product, Redirect, Studio } from "@/payload-types";

export const getCMS = cache((): Promise<Payload> => getPayload({ config }));

/** Pages with this path are the plans page (story 13a). */
export const PLANS_PATH = "/pricing-plans/plans-pricing";
/** The storefront; any page carrying a product list block is a storefront too. */
export const SHOP_PATH = "/shop";

export type Resolved =
  /** `page` — the Wix page with the same path, if the studio had one. */
  | { kind: "studio"; doc: Studio; page?: Page }
  | { kind: "product"; doc: Product }
  | { kind: "plans"; doc: Page }
  | { kind: "shop"; doc: Page }
  | { kind: "page"; doc: Page };

export type Resolution = Resolved | { redirect: string } | null;

/** Where a redirect rule points, as a path or URL. */
export function redirectTarget(rule: Redirect): string | null {
  const to = rule.to;
  if (!to) return null;
  if (to.type === "custom") return to.url || null;
  const ref = to.reference?.value;
  return ref && typeof ref === "object" && "path" in ref ? (ref.path as string) : null;
}

/** One document, read as a visitor: the access rules of the collection hide what is unpublished or hidden. */
async function one<T>(payload: Payload, collection: string, where: Record<string, unknown>, depth = 1) {
  const res = await payload.find({
    collection: collection as never,
    where: where as never,
    limit: 1,
    depth,
    pagination: false,
    overrideAccess: false,
  });
  return res.docs[0] as T | undefined;
}

/** Every redirect rule from the admin, from → target, without the rules that loop. */
const redirectTable = cache(async (payload: Payload) => {
  const res = await payload.find({ collection: "redirects", limit: 0, depth: 1, pagination: false, overrideAccess: false });
  const map = new Map<string, string>();
  for (const rule of res.docs as Redirect[]) {
    const to = redirectTarget(rule);
    if (rule.from && to) map.set(rule.from, to);
  }
  return withoutLoops(map);
});

/**
 * The one router of the public site: a path → the document to show, a
 * redirect, or null (404). Unpublished and hidden documents are not shown.
 */
export const resolvePath = cache(async (input: string): Promise<Resolution> => {
  const path = normalizePath(input);
  if (!path) return null;
  const payload = await getCMS();

  // The same table as proxy.ts, with the same loop rule: a rule that leads back to itself is not applied.
  const to = (await redirectTable(payload)).get(path);
  if (to && normalizePath(to) !== path) return { redirect: to };

  const studio = await one<Studio>(payload, "studios", { path: { equals: path } });
  if (studio) {
    const page = await one<Page>(payload, "pages", { path: { equals: path } }, 2);
    return { kind: "studio", doc: studio, page };
  }

  const product = await one<Product>(payload, "products", { path: { equals: path } });
  if (product) return { kind: "product", doc: product };

  const page = await one<Page>(payload, "pages", { path: { equals: path } }, 2);
  if (page) {
    if (path === PLANS_PATH) return { kind: "plans", doc: page };
    if (path === SHOP_PATH || page.blocks?.some((b) => b.blockType === "productList")) return { kind: "shop", doc: page };
    return { kind: "page", doc: page };
  }
  return null;
});

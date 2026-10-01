import type { MetadataRoute } from "next";
import { sitePaths } from "@/lib/cms/site";
import { SITE_URL } from "@/lib/cms/text";

/** Read from the CMS on every request: a new page or product is listed as soon as it is published. */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return (await sitePaths()).map((path) => ({
    url: path === "/" ? SITE_URL : `${SITE_URL}${path}`,
    changeFrequency: "weekly" as const,
    ...(path === "/" ? { priority: 1 } : {}),
  }));
}

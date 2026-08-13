import type { MetadataRoute } from "next";
import { locations, site } from "@/lib/site";

/** Generated from the same array as the pages, so it can't drift out of sync. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: site.url, changeFrequency: "weekly", priority: 1 },
    ...locations.map((loc) => ({
      url: `${site.url}/classes/${loc.slug}`,
      changeFrequency: "weekly" as const,
      priority: loc.status === "open" ? 0.9 : 0.4,
    })),
  ];
}

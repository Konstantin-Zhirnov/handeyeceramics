import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

/** Everything is disallowed until SITE_ENV=production (test address stays unindexed). */
export default function robots(): MetadataRoute.Robots {
  if (process.env.SITE_ENV !== "production") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api"] },
    sitemap: `${site.url}/sitemap.xml`,
  };
}

import { withPayload } from "@payloadcms/next/withPayload";

// The test address must stay out of search engines until launch (spec §10).
const isProduction = process.env.SITE_ENV === "production";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Tests run their own dev server next to yours, in a separate build folder.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async headers() {
    if (isProduction) return [];
    return [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }];
  },
};

export default withPayload(nextConfig, { devBundleServerPackages: false });

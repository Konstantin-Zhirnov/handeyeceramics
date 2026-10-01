/**
 * Pages with photos. With a server URL set the CMS prints absolute links to
 * its own files, and a page must still render them. Needs a database seeded
 * WITH images: `SEED_IMAGES=1 npx vitest run tests/site/images.test.ts`, or
 * TEST_BASE_URL pointing at a server started with NEXT_PUBLIC_SERVER_URL on
 * such a database. The default test database has no images — then it skips.
 */
import { load } from "cheerio";
import { describe, expect, inject, it } from "vitest";

const base = () => inject("baseURL");

describe("pages with photos", () => {
  it("render their images when the CMS prints absolute media links", async (ctx) => {
    const media = await (await fetch(`${base()}/api/media?limit=1&depth=0`)).json();
    if (!media.totalDocs) return ctx.skip();
    expect(media.docs[0].url).toMatch(/^http/); // the case under test: absolute links
    // Pages of the old site that carry photos in their content.
    for (const path of ["/about-us", "/gift-card", "/commissions-and-film-props"]) {
      const res = await fetch(`${base()}${path}`);
      expect(res.status, path).toBe(200);
      const $ = load(await res.text());
      const srcs = $("main img").toArray().map((img) => $(img).attr("src") || "");
      expect(srcs.length, path).toBeGreaterThan(0);
      for (const src of srcs) expect(src, path).toMatch(/^\/_next\/image\?url=%2Fapi%2Fmedia%2F/);
    }
  });
});

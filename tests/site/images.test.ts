/**
 * Pages with photos. With a server URL set the CMS prints absolute links to
 * its own files, and a page must still render them. The test database is
 * seeded with the pictures of these pages (tests/site/global-setup.ts); with
 * TEST_BASE_URL the server must run with NEXT_PUBLIC_SERVER_URL on a database
 * seeded with images.
 */
import { load } from "cheerio";
import { describe, expect, inject, it } from "vitest";

const base = () => inject("baseURL");

describe("pages with photos", () => {
  it("render their images when the CMS prints absolute media links", async () => {
    const media = await (await fetch(`${base()}/api/media?limit=1&depth=0`)).json();
    expect(media.totalDocs, "the test database has pictures").toBeGreaterThan(0);
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

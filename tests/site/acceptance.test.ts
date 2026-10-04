/**
 * Checks across the whole site: the test address stays out of search engines
 * on every kind of answer, and what the crawl cut out stays cut out.
 */
import { load } from "cheerio";
import { describe, expect, inject, it } from "vitest";

const base = () => inject("baseURL");

describe("noindex while SITE_ENV is not production", () => {
  const noindex = async (url: string, init?: RequestInit) => {
    const res = await fetch(`${base()}${url}`, { redirect: "manual", ...init });
    await res.arrayBuffer();
    expect(res.headers.get("x-robots-tag") || "", `${url} (${res.status})`).toMatch(/noindex/);
    return res;
  };

  it("is on pages of every template, on redirects and on the 404 page", async () => {
    for (const url of ["/", "/about-us", "/nanaimo-pottery-classes", "/shop", "/pricing-plans/plans-pricing", "/contact-us"]) {
      expect((await noindex(url)).status, url).toBe(200);
    }
    const product = (await (await fetch(`${base()}/api/products?limit=1&depth=0`)).json()).docs[0].path as string;
    expect((await noindex(product)).status).toBe(200);
    expect((await noindex("/home")).status).toBe(301);
    expect((await noindex("/no-such-page-here")).status).toBe(404);
  });

  it("is on the API, the admin and the form endpoint", { timeout: 600_000 }, async () => {
    await noindex("/api/studios?limit=1");
    await noindex("/api/enquiries");
    await noindex("/admin");
    await noindex("/forms/enquiry", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  });

  it("is on static files, scripts, robots.txt and the sitemap", async () => {
    const $ = load(await (await fetch(`${base()}/`)).text());
    const assets = [
      ...$("script[src]").toArray().map((el) => $(el).attr("src") || ""),
      ...$('link[rel="stylesheet"]').toArray().map((el) => $(el).attr("href") || ""),
    ].filter((src) => src.startsWith("/_next/static/"));
    expect(assets.length).toBeGreaterThan(1);
    for (const src of [assets[0], assets[assets.length - 1]]) expect((await noindex(src)).status).toBe(200);
    expect((await noindex("/robots.txt")).status).toBe(200);
    expect((await noindex("/sitemap.xml")).status).toBe(200);
    // A file of the public folder: a photo of the prototype.
    expect((await noindex("/images/hands-clay.jpg")).status).toBe(200);
  });

  it("is on uploaded pictures", async () => {
    const media = (await (await fetch(`${base()}/api/media?limit=1&depth=0`)).json()).docs[0];
    expect(media, "the test database is seeded with a few pictures").toBeDefined();
    const file = new URL(media.url, base()).pathname;
    expect((await noindex(file)).status).toBe(200);
    expect((await noindex(`/_next/image?url=${encodeURIComponent(file)}&w=640&q=75`)).status).toBe(200);
  });
});

describe("what the crawl cut out", () => {
  const text = async (url: string) => load(await (await fetch(`${base()}${url}`)).text())("main").text();

  it("stays in the text of the rental page and does not travel into the plan", async () => {
    const rental = await text("/wheel-rental");
    expect(rental).toContain("[REDACTED]");
    // The rental plan lives on its own page; the plans page shows only the Wix plan.
    expect(rental).toContain("Pottery Wheel Rental Program");
    expect(await text("/pricing-plans/plans-pricing")).not.toContain("REDACTED");
  });

  it("and the rental plan in the CMS carries no such mark", async () => {
    const { docs } = await (await fetch(`${base()}/api/plans?limit=0&pagination=false`)).json();
    expect(docs.length).toBeGreaterThan(1);
    for (const plan of docs) expect(JSON.stringify(plan), plan.name).not.toContain("REDACTED");
  });
});

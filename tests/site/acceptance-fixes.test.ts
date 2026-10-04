/**
 * Defects found by the blind acceptance review (ticket 09), checked as a
 * visitor sees them. Expected values are written by hand from the inventory
 * (content/inventory.json) and the seed data, not computed by the site.
 */
import { execFile } from "node:child_process";
import path from "node:path";
import { load, type CheerioAPI } from "cheerio";
import { afterAll, describe, expect, inject, it } from "vitest";
import { assertThrowAwayTarget } from "./editor";

const root = path.resolve(import.meta.dirname, "../..");
const base = () => inject("baseURL");

async function page(url: string): Promise<{ status: number; $: CheerioAPI }> {
  const res = await fetch(`${base()}${url}`, { redirect: "manual" });
  return { status: res.status, $: load(await res.text()) };
}
const squash = (s: string) => s.replace(/\s+/g, " ").trim();

async function cms(input: Record<string, unknown>) {
  const uri = inject("databaseURI");
  assertThrowAwayTarget(base());
  await new Promise<void>((resolve, reject) => {
    execFile(
      process.execPath,
      ["--import", "tsx", "tests/site/cms-update.ts"],
      { cwd: root, encoding: "utf8", env: { ...process.env, DATABASE_URI: uri, NODE_OPTIONS: "--no-deprecation", CMS_UPDATE: JSON.stringify(input) } },
      (error, stdout, stderr) => (error ? reject(new Error(`cms-update failed:\n${(stdout + stderr).slice(-2000)}`)) : resolve()),
    );
  });
}

describe("class price", () => {
  const title = "Price Check Class — Chinatown";
  afterAll(() => cms({ collection: "classes", where: { title }, remove: true }));

  it("a new class with a price shows the price on its studio page", async () => {
    const studios = await (await fetch(`${base()}/api/studios?where[path][equals]=/classes/vancouver-chinatown&depth=0`)).json();
    const studio = studios.docs[0].id;
    await cms({ collection: "classes", create: { title, price: "$77 per seat", studio: [studio], sessions: [{ weekday: "monday", time: "6pm" }] } });
    const { $ } = await page("/classes/vancouver-chinatown");
    const row = $("[data-schedule] > *").filter((_, el) => $(el).text().includes("Price Check Class"));
    expect(row).toHaveLength(1);
    expect(row.text()).toContain("$77 per seat");
  }, 300_000);
});

describe("plans page", () => {
  it("lists only the plan of the old Wix page", async () => {
    const { $ } = await page("/pricing-plans/plans-pricing");
    const body = squash($("main").text() || $("body").text());
    expect(body).toContain("Tuesday Evening");
    // Memberships and the wheel rental live on their own pages.
    expect(body).not.toMatch(/Option 1\b/);
    expect(body).not.toMatch(/wheel rental program costs/i);
  });
});

describe("Wix markup litter", () => {
  it("the home page prints no anchors, slide counters or social icons", async () => {
    const { $ } = await page("/");
    const text = squash($("body").text());
    expect(text).not.toContain("Anchor 1");
    expect(text).not.toMatch(/(^| )1 \/ 3( |$)/);
    expect($('img[alt="Instagram"]')).toHaveLength(0);
  });

  it("a phrase Wix split into lines is one paragraph", async () => {
    const { $ } = await page("/");
    const paras = $("p").toArray().map((p) => squash($(p).text()));
    expect(paras).toContain("Unlock creative potential with a Studio access");
    expect(paras.some((p) => p.startsWith("Pottery workshops for team building") && p.endsWith("kid's birthday parties."))).toBe(true);
  });
});

describe("empty storefronts", () => {
  for (const [url, h1] of [
    ["/saturday-night-drop-in", "Saturday Night Drop in"],
    ["/youth-pottery-classes-shop", null],
  ] as const) {
    it(`${url}: the H1 is the page title, the empty-store notice is text`, async () => {
      const { status, $ } = await page(url);
      expect(status).toBe(200);
      const got = squash($("h1").text());
      expect(got).not.toMatch(/products to show/);
      if (h1) expect(got).toBe(h1);
      expect($("h2, h3").filter((_, el) => /products to show/.test($(el).text()))).toHaveLength(0);
    });
  }
});

describe("FIND US", () => {
  // Both Wix pages ended on an empty "FIND US" heading (a map on Wix).
  it.each(["/contact-us", "/commissions-form"])("%s lists the open studios with address and phone under FIND US", async (url) => {
    const { $ } = await page(url);
    const find = $("[data-find-us]");
    expect(find).toHaveLength(1);
    const text = squash(find.text());
    expect(text).toContain("739 Gore Ave");
    expect(text).toContain("322 E 5th Ave");
    expect(text).toContain("3168 Uplands");
    expect(text).not.toMatch(/Calgary/i);
    expect(find.find('a[href^="tel:+1"]').length).toBeGreaterThan(0);
  });
});

describe("broken addresses", () => {
  it("a malformed percent escape is a 404 in the site design, not a 500", async () => {
    const res = await fetch(`${base()}/abc%zz`, { redirect: "manual" });
    expect(res.status).toBe(404);
    // The same page as any unknown address: the site's 404, with its title.
    expect(load(await res.text())("title").text()).toMatch(/^Page not found/);
  });
});

describe("redirect loops from the admin", () => {
  const loop = ["/loop-check-a", "/loop-check-b"];
  afterAll(async () => {
    for (const from of loop) await cms({ collection: "redirects", where: { from }, remove: true });
  });

  it("a rule that leads back to its own address is not applied", async () => {
    await cms({ collection: "redirects", create: { from: loop[0], to: { type: "custom", url: loop[1] } } });
    await cms({ collection: "redirects", create: { from: loop[1], to: { type: "custom", url: loop[0] } } });
    await new Promise((r) => setTimeout(r, 11_000)); // the redirect table is cached for 10 s
    let url = loop[0];
    let hops = 0;
    for (; hops < 5; hops++) {
      const res = await fetch(`${base()}${url}`, { redirect: "manual" });
      // Any redirect counts: the proxy's 301 and the page router's 307/308 alike.
      if (res.status < 300 || res.status >= 400) break;
      url = new URL(res.headers.get("location")!, base()).pathname;
    }
    expect(hops).toBeLessThan(2);
  }, 400_000); // each CMS edit boots Payload in a child process, about a minute under load
});

/**
 * Story 3: on a phone every page reads without scrolling sideways, the text
 * is large enough and the phone number is one tap away. A real browser
 * (Chromium, 390px wide) opens every URL of the inventory that answers 200,
 * and the studio pages of the prototype — with `npm run test:mobile`, which
 * takes a while. The usual `npm test` opens one page of every template.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { expected404, expectedRedirects } from "./expected";

const root = path.resolve(import.meta.dirname, "../..");
const inv = JSON.parse(readFileSync(path.join(root, "content/inventory.json"), "utf8"));
const fromInventory: string[] = [...inv.pages, ...inv.products, ...inv.pricing, ...inv.other].map((r: { path: string }) => r.path);
// Templates that have no address on the old site: the studio pages of the prototype and the shop.
const everything = process.env.MOBILE_ALL === "1";
// One page of every template: home, a studio from the old site and one from the prototype, a text page,
// a page with a form, the shop, a product, the plans.
const templates = [
  "/",
  "/nanaimo-pottery-classes",
  "/classes/vancouver-chinatown",
  "/about-us",
  "/contact-us",
  "/shop",
  "/product-page/6-week-wheel-throwing-pottery-classes-in-vancouver",
  "/pricing-plans/plans-pricing",
];
const paths = !everything ? templates : [...new Set([...fromInventory, "/shop", "/classes/vancouver-chinatown", "/classes/vancouver-mount-pleasant", "/classes/calgary"])];

let browser: Browser;
let page: Page;
let opened = 0;

beforeAll(async () => {
  // Playwright's own Chromium; without it (browsers not downloaded) the Chrome installed on the machine.
  browser = await chromium.launch().catch(() => chromium.launch({ channel: "chrome" }));
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  page = await phone.newPage();
  // A cold dev server compiles the home page and its scripts for minutes: let it, before the clock of a test runs.
  await page.goto(`${inject("baseURL")}/`, { waitUntil: "load", timeout: 600_000 });
});

afterAll(async () => {
  await browser?.close();
});

describe("on a 390px phone", () => {
  it.each(paths)("%s fits the screen, reads well and has the phone", { timeout: 300_000 }, async (p) => {
    const url = `${inject("baseURL")}${p}`;
    // Redirects and the one dead address of the old site are checked in inventory.test.ts.
    const plain = await fetch(url, { redirect: "manual" });
    await plain.arrayBuffer();
    // Only the known redirects and the one dead address may answer anything but 200.
    if (expectedRedirects[p]) return expect(plain.status).toBe(301);
    if (expected404.has(p)) return expect(plain.status).toBe(404);
    expect(plain.status, `${p} answers`).toBe(200);
    opened++;
    await page.goto(url, { waitUntil: "load", timeout: 240_000 });
    const seen = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      rootFont: parseFloat(getComputedStyle(document.documentElement).fontSize),
      tel: document.querySelectorAll('a[href^="tel:"]').length,
    }));
    expect(seen.clientWidth).toBe(390);
    expect(seen.scrollWidth, "scrolls sideways").toBe(seen.clientWidth);
    expect(seen.rootFont).toBeGreaterThanOrEqual(17);
    expect(seen.tel, "tel: links").toBeGreaterThan(0);
  });

  it(everything ? "opened the pages of the inventory, not a handful" : "opened every template", () => {
    // Every address that should answer 200 was opened: no more, no less.
    expect(opened).toBe(paths.filter((p) => !expectedRedirects[p] && !expected404.has(p)).length);
  });
});

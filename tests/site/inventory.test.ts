/**
 * The seam: the crawl inventory. Every URL of the old site must answer on the
 * new one by the same path — 200 with the old title, description, one H1 and
 * the old text, or a 301 to the right place.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { load } from "cheerio";
import { beforeAll, describe, expect, inject, it } from "vitest";
import { isWixLitter } from "../../scripts/seed/wix-litter";
import { expected404, expectedRedirects } from "./expected";

type Block = { type: string; text?: string; level?: number };
type Rec = {
  path: string;
  status: number;
  title: string;
  description: string;
  h1: string[];
  headings: { level: number; text: string }[];
  blocks: Block[];
  name?: string;
};

const root = path.resolve(import.meta.dirname, "../..");
const inv = JSON.parse(readFileSync(path.join(root, "content/inventory.json"), "utf8"));
const records: Rec[] = [...inv.pages, ...inv.products, ...inv.pricing, ...inv.other];

// Hand-written from the redirect rules (story 6 and the task brief).
// No exemptions: the home page carries the H1 and the text of the old one, like every other page.
const prototypeTemplates = new Set<string>();
// Story 8: this title repeats the title of a content page, so the product's
// category is added to it (content/seo-fixes.md).
const retitled: Record<string, string> = {
  "/product-page/6-week-wheel-throwing-pottery-classes-in-vancouver":
    "6-Week Pottery Classes in Vancouver | Classes | Hand Eye Ceramics",
};

// Wix store and navigation chrome, not page content.
const chrome = (b: Block) => {
  const t = (b.text || "").trim();
  if (isWixLitter(b)) return true;
  if (!t) return true;
  if (b.type === "text" && ["*", "Excluding Sales Tax", "Quantity *", "Price", "Regular Price", "Sale Price"].includes(t)) return true;
  if (b.type === "button" && t === "Add to Cart") return true;
  if (b.type === "list-item" && (["Top of Page", "Home", "Service list"].includes(t) || t.startsWith("Quick View"))) return true;
  // A card of the Wix pricing widget, glued by the crawl into one line ("Tuesday Evening CA$ 267.75 … Buy Now …").
  // The plan is a document of the plans collection and is printed from there, part by part.
  if (b.type === "list-item" && /CA\$ ?[\d.]+ .* Buy Now /.test(t)) return true;
  return false;
};
const squash = (s: string) => s.replace(/\s+/g, " ").trim();

let base = "";
const pages = new Map<string, { status: number; location: string | null; html: string }>();

beforeAll(async () => {
  base = inject("baseURL");
  for (const r of records) {
    const res = await fetch(base + r.path, { redirect: "manual" });
    pages.set(r.path, { status: res.status, location: res.headers.get("location"), html: await res.text() });
  }
});

describe.each(records.map((r) => [r.path, r] as const))("%s", (p, rec) => {
  it("answers with the expected status", () => {
    const got = pages.get(p)!;
    if (expected404.has(p)) return expect(got.status).toBe(404);
    if (expectedRedirects[p]) {
      expect(got.status).toBe(301);
      expect(new URL(got.location || "", base).pathname).toBe(expectedRedirects[p]);
      return;
    }
    expect(got.status).toBe(200);
  });

  const isPage = !expected404.has(p) && !expectedRedirects[p];
  it.runIf(isPage)("has a title, a description and exactly one H1", () => {
    const $ = load(pages.get(p)!.html);
    const title = $("head title").text();
    const description = $('head meta[name="description"]').attr("content") || "";
    expect($("h1")).toHaveLength(1);
    expect(title).not.toBe("");
    expect(description).not.toBe("");
    if (prototypeTemplates.has(p)) return;

    if (retitled[p]) expect(title).toBe(retitled[p]);
    else expect(title).toBe(rec.title);
    if (rec.description) expect(description).toBe(rec.description);
    // The notice of an empty Wix storefront is not a heading of the page: the H1 is then the title.
    const h1 = rec.h1[0] ?? rec.headings.find((h) => !/products to show here right now/.test(h.text))?.text;
    if (h1) expect(squash($("h1").text())).toBe(squash(h1));
  });

  it.runIf(isPage && !prototypeTemplates.has(p))("contains the text of the old page", () => {
    const body = squash(load(pages.get(p)!.html)("body").text());
    const missing = rec.blocks
      .filter((b) => b.text !== undefined && !chrome(b))
      .map((b) => squash(b.text!))
      .filter((t) => !body.includes(t));
    expect(missing).toEqual([]);
  });
});

it("gives every page its own title", () => {
  const seen = new Map<string, string>();
  const dupes: string[] = [];
  for (const [p, got] of pages) {
    if (got.status !== 200) continue;
    const title = load(got.html)("head title").text();
    if (seen.has(title)) dupes.push(`${title}: ${seen.get(title)} & ${p}`);
    seen.set(title, p);
  }
  expect(dupes).toEqual([]);
});

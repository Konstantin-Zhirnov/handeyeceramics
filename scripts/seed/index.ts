/**
 * npm run seed — fills the CMS from the crawl inventory (content/inventory.json)
 * and the prototype data (lib/site.ts). Idempotent: every document is found by
 * its key (path, title, name, filename, from) and updated, never duplicated.
 *
 * SEED_IMAGES=0 skips uploading pictures; SEED_IMAGES="/about-us,/gift-card"
 * uploads only the pictures of these pages (the tests use it for speed).
 * Writes content/seo-fixes.md: every finding of content/crawl-issues.json and
 * what was done about it (not with SEED_FIXES=0: a seed of a throw-away database).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getPayload, type Payload } from "payload";
import config from "../../payload.config";
import { classTabs, gallery, locations, reviews, site, stageChapters, steps } from "../../lib/site";
import { SITE_SUFFIX, excerpt, formatPrice } from "../../lib/cms/text";
import { continuesLine, isWixLitter } from "./wix-litter";
import { homeMoves } from "./home-moves";
import { writesFixes } from "./fixes";
import * as L from "./lexical";
import * as homeText from "./home";

const root = process.cwd();
const withImages = process.env.SEED_IMAGES !== "0";

type Block = {
  type: string;
  text?: string;
  level?: number;
  href?: string;
  src?: string;
  alt?: string;
  local?: string;
};
type Rec = {
  path: string;
  status: number;
  title: string;
  description: string;
  h1: string[];
  headings: { level: number; text: string }[];
  text: string;
  blocks: Block[];
  images: { src: string; alt: string; local: string }[];
  kind: string;
  name?: string;
  price?: number;
  category?: string;
  categories?: string[];
  categoryPath?: string;
  plans?: { name: string; price: string; period: string; description: string; benefits: string[] }[];
};
type Issue = { type: string; [k: string]: unknown };

const inv = JSON.parse(readFileSync(path.join(root, "content/inventory.json"), "utf8"));
const issues: { path: string; issues: Issue[] }[] = JSON.parse(
  readFileSync(path.join(root, "content/crawl-issues.json"), "utf8"),
);

// ---- Decisions (story 6 and the task brief) --------------------------------
const STUDIO_PATHS: Record<string, string> = {
  "vancouver-chinatown": "/classes/vancouver-chinatown",
  "vancouver-mount-pleasant": "/classes/vancouver-mount-pleasant",
  nanaimo: "/nanaimo-pottery-classes", // the one studio with its own Wix page
  calgary: "/classes/calgary",
};
const VANCOUVER_CLASSES = "/adult-beginner-pottery-classes-in-vancouver";
/** Wix system page ("You don't have permissions…"): nothing to carry over. */
const SYSTEM_PAGES: Record<string, string> = { "/home": "/", "/paywall": "/" };
/** A dead link found by the crawl, and where it now points. */
const LINK_FIXES: Record<string, string> = { "/product-page/private-lessons": "/open-studio-private-lessons" };
const FORM_TYPES: Record<string, "contact" | "commission"> = { "/contact-us": "contact", "/commissions-form": "commission" };

/** Wix store and navigation chrome — not page content. */
function isChrome(b: Block): boolean {
  const t = (b.text || "").trim();
  if (isWixLitter(b)) return true;
  if (b.type === "image" || b.type === "form") return false;
  if (!t) return true;
  if (b.type === "text" && ["*", "Excluding Sales Tax", "Quantity *", "Price", "Regular Price", "Sale Price"].includes(t)) return true;
  if (b.type === "button" && t === "Add to Cart") return true;
  if (b.type === "list-item" && ["Top of Page", "Home", "Service list"].includes(t)) return true;
  return false;
}
const isProductTile = (b: Block) => b.type === "list-item" && (b.text || "").startsWith("Quick View");
/** What a Wix storefront prints when its category has no products. */
const isEmptyStore = (b: Block) => b.type === "heading" && /^We don.t have any products to show here right now\.?$/.test((b.text || "").trim());
/** The price and option widget of a Wix product page — not part of the description. */
const WIX_PRICE = /^CA\$[\d,]+(\.\d+)?$/;
type ProductOption = { title: string; choices: string[] };
const optionsOf = (r: Rec) =>
  ((r as { options?: ProductOption[] }).options || []).filter((o) => o.title && o.choices?.length);
/** Labels and "Select" placeholders of the drop-downs that became the product's options. */
function isOptionWidget(b: Block, options: ProductOption[]): boolean {
  const t = (b.text || "").trim();
  if (!options.length) return false;
  if (b.type === "button") return t === "Select";
  return b.type === "label" && options.some((o) => t === `${o.title} *`);
}

// ---- Report of SEO fixes ----------------------------------------------------
const fixes: string[] = [];
const cell = (t: string) => t.replace(/\|/g, "\\|");
const fixed = (p: string, finding: string, done: string) => fixes.push(`| \`${p}\` | ${cell(finding)} | ${cell(done)} |`);

// ---- Helpers ----------------------------------------------------------------
let payload: Payload;

async function upsert(collection: string, where: Record<string, unknown>, data: Record<string, unknown>): Promise<{ id: number }> {
  const found = await payload.find({ collection: collection as never, where: where as never, limit: 1, depth: 0 });
  if (found.docs[0]) {
    return (await payload.update({ collection: collection as never, id: (found.docs[0] as { id: number }).id, data: data as never, depth: 0 })) as { id: number };
  }
  return (await payload.create({ collection: collection as never, data: data as never, depth: 0 })) as { id: number };
}

/** SEED_IMAGES as a list of paths: only the pictures the crawl found on these pages. */
const imagePages = (process.env.SEED_IMAGES || "").startsWith("/")
  ? new Set(process.env.SEED_IMAGES!.split(",").map((p) => p.trim()))
  : null;
const onlyImages =
  imagePages &&
  new Set(
    (inv.images as { local: string; usedOn?: string[] }[])
      .filter((img) => img.usedOn?.some((p) => imagePages.has(p)))
      .map((img) => img.local),
  );

const mediaByLocal = new Map<string, number>();
async function media(local: string | undefined, alt: string): Promise<number | undefined> {
  if (!withImages || !local) return undefined;
  if (onlyImages && !onlyImages.has(local)) return undefined;
  if (mediaByLocal.has(local)) return mediaByLocal.get(local);
  const file = path.join(root, local);
  if (!existsSync(file)) return undefined;
  const filename = path.basename(file);
  const found = await payload.find({ collection: "media", where: { filename: { equals: filename } }, limit: 1, depth: 0 });
  const doc =
    found.docs[0] ??
    (await payload.create({ collection: "media", data: { alt: alt || filename }, filePath: file, depth: 0 }).catch((e) => {
      console.warn(`  ! image ${filename}: ${(e as Error).message}`);
      return undefined;
    }));
  if (doc) mediaByLocal.set(local, doc.id as number);
  return doc?.id as number | undefined;
}

const altFor = (img: { alt?: string }, fallback: string) => (img.alt || "").trim() || fallback;
const pageName = (r: Rec) => r.title.replace(SITE_SUFFIX, "");

/**
 * Story 8: the first H1 stays; with no H1 the first heading becomes it. The
 * notice of an empty Wix storefront is not a heading of the page: with nothing
 * else, the H1 is the page title.
 */
function pickH1(r: Rec): { index: number; text: string } {
  let index = r.blocks.findIndex((b) => b.type === "heading" && b.level === 1);
  if (index < 0) index = r.blocks.findIndex((b) => b.type === "heading" && !isEmptyStore(b));
  return index >= 0 ? { index, text: r.blocks[index].text! } : { index: -1, text: pageName(r) };
}

/**
 * The category a storefront page lists: the one whose products are exactly
 * the products the Wix page links to. No exact match — the last category
 * those products share.
 */
function categoryOf(pagePath: string): string {
  const page = inv.pages.find((p: Rec) => p.path === pagePath) as { links?: string[] } | undefined;
  const linked = new Set((page?.links || []).filter((l) => l.startsWith("/product-page/")));
  const prods: Rec[] = inv.products.filter((p: Rec) => linked.has(p.path));
  if (!prods.length) return "";
  const shared = prods.map((p) => p.categories || []).reduce((acc, cats) => acc.filter((c) => cats.includes(c)));
  const size = (c: string) => inv.products.filter((p: Rec) => (p.categories || []).includes(c)).length;
  return shared.find((c) => size(c) === prods.length) || shared[shared.length - 1] || "";
}

/** Inventory blocks → page blocks, in page order. */
async function toBlocks(r: Rec, h1Index: number) {
  const out: Record<string, unknown>[] = [];
  let nodes: L.Node[] = [];
  let list: string[] = [];
  let images: number[] = [];
  let tilesDone = false;
  let tile = "";
  let emptyStore = false;
  const planSpot = textPlans().spots.get(r.path);
  let plansDone = false;
  // The home page's testimonial and membership line stand in their own sections of the home global (home-moves.ts).
  const moved = r.path === "/" ? homeMoves(r.blocks).skip : new Set<number>();

  /** The paragraph last added to `nodes`, to glue a line Wix split onto it. */
  let lastPara: string | null = null;
  const flushList = () => {
    if (list.length) nodes.push(L.list(list));
    list = [];
  };
  const flushText = () => {
    flushList();
    if (nodes.length) out.push({ blockType: "text", body: L.root(nodes) });
    nodes = [];
    lastPara = null;
  };
  const flushImages = () => {
    if (images.length === 1) out.push({ blockType: "image", image: images[0] });
    else if (images.length > 1) out.push({ blockType: "gallery", images });
    images = [];
  };

  for (const [i, b] of r.blocks.entries()) {
    if (planSpot?.indices.has(i)) {
      // These paragraphs are plans now: one plan list stands where the first of them stood.
      if (!plansDone) {
        flushImages();
        flushText();
        out.push({ blockType: "planList", group: planSpot.group || undefined });
        plansDone = true;
      }
      continue;
    }
    if (isEmptyStore(b)) emptyStore = true;
    if (i === h1Index || moved.has(i) || isChrome(b)) continue;
    // A tile's picture and the name printed under it belong to the product list.
    if (isProductTile(b)) images = [];
    if (b.type === "paragraph" && tile.includes((b.text || "").trim())) continue;
    tile = isProductTile(b) ? b.text || "" : b.type === "image" ? tile : "";
    if (b.type !== "image") flushImages();
    const joinsLine = b.type === "paragraph" && lastPara !== null && continuesLine(lastPara, b.text || "");
    if (b.type !== "paragraph") lastPara = null;
    if (isProductTile(b)) {
      if (!tilesDone) {
        flushText();
        out.push({ blockType: "productList", category: categoryOf(r.path) || undefined });
        tilesDone = true;
      }
      continue;
    }
    switch (b.type) {
      case "image": {
        flushText();
        const id = await media(b.local, altFor(b, pageName(r)));
        if (id) images.push(id);
        break;
      }
      case "form":
        flushText();
        out.push({ blockType: "form", formType: FORM_TYPES[r.path] || "contact" });
        break;
      case "list-item":
        list.push(b.text!);
        break;
      case "heading":
        flushList();
        // The empty-storefront notice is a sentence, not a section heading.
        nodes.push(isEmptyStore(b) ? L.paragraph(b.text!) : L.heading(b.text!, Math.min(6, Math.max(2, b.level || 2))));
        break;
      case "button": {
        flushList();
        const href = b.href ? LINK_FIXES[b.href] || b.href : "";
        if (b.href && LINK_FIXES[b.href]) fixed(r.path, `broken link ${b.href}`, `the button “${b.text}” leads to ${href}`);
        nodes.push(href ? L.linkParagraph(b.text!, href) : L.paragraph(b.text!));
        break;
      }
      default:
        flushList();
        if (joinsLine) {
          nodes.pop();
          lastPara = `${lastPara} ${b.text!.trim()}`;
        } else lastPara = b.type === "paragraph" ? b.text!.trim() : null;
        nodes.push(L.paragraph(b.type === "paragraph" ? lastPara! : b.text!));
    }
  }
  flushImages();
  flushText();
  // A Wix storefront with an empty grid stays a storefront: the category of the
  // products it links to, or none — then the list is empty until the owner names one.
  if (emptyStore && !tilesDone) out.push({ blockType: "productList", category: categoryOf(r.path) || undefined });
  return out;
}

const contentText = (r: Rec) =>
  r.blocks.filter((b) => b.text && !isChrome(b) && !isProductTile(b)).map((b) => b.text).join(" ");

function seoFor(r: Rec) {
  let description = r.description;
  if (!description) {
    description = excerpt(contentText(r)) || pageName(r);
    fixed(r.path, "empty description", `the first ${description.length} characters of the page text`);
  }
  return { title: r.title, description };
}

function noteH1(r: Rec, h1: { index: number; text: string }) {
  if (r.h1.length > 1) fixed(r.path, `${r.h1.length} H1`, `H1 is “${h1.text}”, the others became H2`);
  if (r.h1.length === 0)
    fixed(
      r.path,
      "no H1",
      h1.index >= 0
        ? `the first heading “${h1.text}” became H1`
        : r.blocks.some(isEmptyStore)
          ? `H1 is “${h1.text}”, from the title; the empty-store notice stays plain text`
          : `no headings: H1 is “${h1.text}”, from the title`,
    );
}

// ---- Seed steps ---------------------------------------------------------------
async function seedPage(r: Rec) {
  const h1 = pickH1(r);
  noteH1(r, h1);
  await upsert("pages", { path: { equals: r.path } }, {
    title: pageName(r),
    path: r.path,
    h1: h1.text,
    seo: seoFor(r),
    blocks: await toBlocks(r, h1.index),
    published: true,
  });
}

/** /service-page/*: the studio is named in the page text (Gore Ave / East 5th Avenue). */
function studioOfService(r: Rec): string {
  return /gore/i.test(r.text) ? "vancouver-chinatown" : /5th\s+ave/i.test(r.text) ? "vancouver-mount-pleasant" : "";
}

/**
 * A studio's own phone: the one printed in the contact details of that
 * studio's classes on the old site. No such page, or two different numbers —
 * no phone (the business phone lives in the site settings).
 */
function phoneOf(slug: string): string | null {
  const phones = new Set<string>();
  for (const r of (inv.other as Rec[]).filter((o) => o.path.startsWith("/service-page/") && studioOfService(o) === slug)) {
    for (const m of r.text.match(/\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}/g) || []) phones.add(m);
  }
  return phones.size === 1 ? [...phones][0] : null;
}

/** Schedule rows of lib/site.ts that are classes; the rest are notes about the studio. */
const CLASS_ROWS = new Set([
  "Six-week courses",
  "Daytime classes",
  "Afternoon course",
  "Weekend course",
  "Date night",
  "Drop-in hand building",
  "Drop-in wheel",
]);
/** Which schedule row says that a studio runs the class of a home-page tab. */
const TAB_ROW: Record<string, string> = {
  wheel: "Six-week courses",
  handbuilding: "Drop-in hand building",
  datenight: "Date night",
};

async function seedStudios() {
  const ids: Record<string, number> = {};
  for (const loc of locations) {
    const p = STUDIO_PATHS[loc.slug];
    const wix: Rec | undefined = inv.pages.find((r: Rec) => r.path === p);
    const photo = await media(path.join("public", loc.image), loc.name);
    // Membership, access and opening notes are not classes: they stay studio text.
    const notes = loc.schedule.filter((row) => !CLASS_ROWS.has(row.label)).map((row) => `${row.label}: ${row.times}`);
    const doc = await upsert("studios", { path: { equals: p } }, {
      name: loc.name,
      path: p,
      address: [loc.street, `${loc.locality}, ${loc.regionCode}${loc.postalCode ? " " + loc.postalCode : ""}`].join("\n"),
      phone: phoneOf(loc.slug),
      description: [loc.intro, ...notes].join("\n"),
      short: loc.short,
      status: loc.status,
      tag: loc.tag,
      region: loc.region,
      h1: loc.h1,
      // lib/site.ts names one booking page, the Vancouver classes page, for the six-week course. A Vancouver
      // studio whose schedule has that course books there; any other studio books on its own page.
      bookingPath:
        loc.locality === "Vancouver" && loc.status === "open" && loc.schedule.some((row) => row.label === TAB_ROW.wheel)
          ? new URL(site.bookingUrl).pathname
          : null,
      // The prototype's card text of a planned studio is a developer's remark; its intro is the copy.
      note: loc.status === "planned" ? loc.intro : loc.note,
      access: loc.access || null,
      highlights: loc.highlights.map((text) => ({ text })),
      google: { rating: loc.google?.rating ?? null, count: loc.google?.count ?? null, url: loc.google?.url ?? null },
      photos: photo ? [photo] : [],
      seo: wix ? seoFor(wix) : { title: loc.metaTitle, description: loc.metaDescription },
      published: true,
    });
    ids[loc.slug] = doc.id;
  }
  return ids;
}

const duplicateTitle = (p: string) =>
  issues.some((e) => e.path === p && e.issues.some((i) => i.type === "duplicate-title"));

/** The amount Wix prints just above its "Sale Price" label, when it differs from the price. */
function salePriceOf(r: Rec): number | null {
  const i = r.blocks.findIndex((b) => b.type === "text" && (b.text || "").trim() === "Sale Price");
  const text = i > 0 ? (r.blocks[i - 1].text || "").trim() : "";
  if (!WIX_PRICE.test(text)) return null;
  const n = Number(text.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n !== r.price ? n : null;
}

async function seedProducts() {
  for (const r of inv.products as Rec[]) {
    const h1 = pickH1(r);
    const price = formatPrice(r.price);
    const salePrice = salePriceOf(r);
    const options = optionsOf(r);
    const description = r.blocks
      .filter((b, i) => i !== h1.index && b.text && !isChrome(b) && !isOptionWidget(b, options) && b.type !== "image")
      .filter((b) => ![price, salePrice === null ? price : formatPrice(salePrice)].includes(b.text!.trim()))
      .map((b) => b.text!.trim())
      .join("\n\n");
    const images: number[] = [];
    for (const img of r.images) {
      const id = await media(img.local, altFor(img, r.name || pageName(r)));
      if (id && !images.includes(id)) images.push(id);
    }
    const category = r.categories?.[0] || r.category || "";
    const seo = { title: r.title, description: r.description };
    if (!seo.description) {
      seo.description = excerpt(description) || r.name || pageName(r);
      fixed(r.path, "empty description", `the first ${seo.description.length} characters of the product text`);
    }
    // Story 8: a title that repeats a page's title gets the category added.
    if (duplicateTitle(r.path)) {
      seo.title = `${pageName(r)} | ${category || "Shop"}${SITE_SUFFIX}`;
      fixed(r.path, "duplicate title", `the category was added to the title: “${seo.title}”`);
    }
    await upsert("products", { path: { equals: r.path } }, {
      name: r.name || h1.text,
      path: r.path,
      price: r.price ?? null,
      salePrice,
      images,
      description,
      options: options.map((o) => ({ title: o.title, choices: o.choices.join("\n") })),
      category: (r.categories?.length ? r.categories.join(", ") : r.category) || undefined,
      seo,
      visible: true,
    });
  }
}

type PlanData = { name: string; price: number | null; period: string; description: string; group: string };
/** The inventory blocks of a page that became plans: one plan list stands in their place. */
type PlanSpot = { group: string; indices: Set<number> };
const MEMBERSHIPS_PATH = "/membership-rentals";
const RENTAL_PATH = "/wheel-rental";
/** "$175+gst per month", "$150 monthly", "$125/month": a period stated with the amount. */
const MONTHLY = /\$\s?\d+(?:\.\d+)?(?:\s*\+\s*gst)?\s*(?:per month|monthly|\/\s*month)/i;
const amounts = (text: string) => [...new Set([...text.matchAll(/\$\s?(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1])))];

/** A paragraph the crawl cut a secret out of stays text of its page; it is not copied into a plan. */
const cutOut = (text: string) => text.includes("[REDACTED]");

let planCache: { plans: PlanData[]; spots: Map<string, PlanSpot> } | undefined;

/**
 * Membership options and the wheel rental are plain paragraphs on the old
 * site. Each becomes a plan with its paragraphs, word for word, as the
 * description. Nothing is guessed: the price is the option's one amount (two
 * different amounts — no price), the period is set only where the text states
 * it next to the amount, the group is a heading of the old page.
 */
function textPlans() {
  if (planCache) return planCache;
  const plans: PlanData[] = [];
  const spots = new Map<string, PlanSpot>();
  const blocksOf = (p: string) => (inv.pages as Rec[]).find((r) => r.path === p)?.blocks || [];
  const textOf = (b: Block) => (b.text || "").trim();

  const members = blocksOf(MEMBERSHIPS_PATH);
  const memberGroup = textOf(members.find((b) => b.type === "heading" && /^Studio Memberships$/i.test(textOf(b))) || { type: "" });
  const memberSpot: PlanSpot = { group: memberGroup, indices: new Set() };
  let cur: { name: string; lines: string[]; at: number[] } | null = null;
  const close = () => {
    const c = cur as { name: string; lines: string[]; at: number[] } | null;
    if (c) {
      const text = [c.name, ...c.lines].join(" ");
      const found = amounts(text);
      plans.push({
        name: c.name,
        price: found.length === 1 ? found[0] : null,
        period: MONTHLY.test(text) ? "per month" : "",
        description: c.lines.join("\n"),
        group: memberGroup,
      });
      c.at.forEach((i) => memberSpot.indices.add(i));
    }
    cur = null;
  };
  for (const [i, b] of members.entries()) {
    const t = textOf(b);
    // "Option 5 @ 739 Gore…" names a location; "Option 5" opens an option.
    if (b.type === "paragraph" && /^Option \d+\b/.test(t) && !t.includes("@")) {
      close();
      cur = { name: t, lines: [], at: [i] };
    } else if (b.type !== "paragraph" || /^All memberships are/i.test(t)) close();
    else if (cur && !cutOut(t)) {
      (cur as { lines: string[] }).lines.push(t);
      (cur as { at: number[] }).at.push(i);
    }
  }
  close();
  if (memberSpot.indices.size) spots.set(MEMBERSHIPS_PATH, memberSpot);

  // The wheel rental: the paragraphs from "…costs $125/month…" to "A three month rental includes…".
  const rental = blocksOf(RENTAL_PATH);
  const costAt = rental.findIndex((b) => b.type === "paragraph" && /^Our pottery wheel rental program costs \$\d/.test(textOf(b)));
  const name = textOf(rental.find((b) => /^Pottery Wheel Rental Program$/.test(textOf(b))) || { type: "" });
  if (costAt >= 0 && name) {
    let end = costAt;
    for (let i = costAt + 1; i < rental.length && rental[i].type === "paragraph" && i <= costAt + 3; i++) {
      if (/^A three month rental includes/.test(textOf(rental[i]))) end = i;
    }
    const at = Array.from({ length: end - costAt + 1 }, (_, k) => costAt + k).filter((i) => !cutOut(textOf(rental[i])));
    // The price is the one the sentence calls the cost; the other amounts are its tax and its three-month totals.
    const stated = textOf(rental[costAt]).match(/costs \$(\d+(?:\.\d+)?)\s*\/\s*month/);
    const group = textOf(rental.find((b) => b.type === "heading" && b.level === 1) || { type: "" });
    plans.push({
      name,
      price: stated ? Number(stated[1]) : null,
      period: stated ? "per month" : "",
      description: at.map((i) => textOf(rental[i])).join("\n"),
      group,
    });
    spots.set(RENTAL_PATH, { group, indices: new Set(at) });
  }
  planCache = { plans, spots };
  return planCache;
}

async function seedPlans() {
  const plans: PlanData[] = [];
  for (const page of inv.pricing as Rec[]) {
    for (const plan of page.plans || []) {
      plans.push({
        name: plan.name,
        price: Number(plan.price),
        period: plan.period,
        description: [plan.description, ...plan.benefits].filter(Boolean).join("\n"),
        // Listed first, straight under the page heading.
        group: "",
      });
    }
    await seedPage(page);
    // What the crawl found on the old plans page is its pricing widget: the plan
    // cards, each glued into one line. The plans are documents now and the
    // template prints them, so the page itself carries no blocks.
    await payload.update({ collection: "pages", where: { path: { equals: page.path } }, data: { blocks: [] } });
  }
  plans.push(...textPlans().plans);
  for (const [order, plan] of plans.entries()) {
    await upsert("plans", { name: { equals: plan.name } }, { ...plan, order });
  }
}

async function seedClasses(studio: Record<string, number>) {
  // A class is offered at a studio only if that studio's schedule lists it.
  const studiosWith = (label: string) =>
    locations.filter((l) => l.schedule.some((row) => row.label === label)).map((l) => studio[l.slug]);
  for (const tab of classTabs) {
    const photo = await media(path.join("public", tab.image), tab.title);
    await upsert("classes", { title: { equals: tab.title } }, {
      title: tab.title,
      tab: tab.label,
      studio: TAB_ROW[tab.id] ? studiosWith(TAB_ROW[tab.id]) : [],
      description: [tab.body, ...tab.points.map((p) => `• ${p}`)].join("\n"),
      duration: tab.price,
      photos: photo ? [photo] : [],
      unconfirmed: true,
    });
  }
  // The schedule of each studio, as listed on the live site — not yet confirmed.
  for (const loc of locations) {
    for (const row of loc.schedule) {
      const title = `${row.label} — ${loc.short}`;
      if (!CLASS_ROWS.has(row.label)) {
        // Earlier seeds stored these notes as classes; they now live in the studio text.
        await payload.delete({ collection: "classes", where: { title: { equals: title } } });
        continue;
      }
      await upsert("classes", { title: { equals: title } }, {
        title,
        studio: [studio[loc.slug]],
        sessions: [{ time: row.times }],
        unconfirmed: true,
      });
    }
  }
}

async function seedRedirects(studio: Record<string, number>) {
  const toStudio = (slug: string) => ({ type: "reference", reference: { relationTo: "studios", value: studio[slug] } });
  const toUrl = (url: string) => ({ type: "custom", url });
  const rules: [string, Record<string, unknown>][] = [];

  rules.push(["/classes/nanaimo", toStudio("nanaimo")]);
  for (const [from, to] of Object.entries(SYSTEM_PAGES)) rules.push([from, toUrl(to)]);

  // /service-page/*: to the page of the studio the class ran at.
  const serviceStudio = new Map<string, string>();
  for (const r of (inv.other as Rec[]).filter((o) => o.path.startsWith("/service-page/"))) {
    const slug = studioOfService(r);
    serviceStudio.set(r.path.split("/").pop()!, slug);
    rules.push([r.path, slug ? toStudio(slug) : toUrl(VANCOUVER_CLASSES)]);
  }
  // /booking-calendar/*: the same studio as the service of the same name, if any.
  for (const r of (inv.other as Rec[]).filter((o) => o.path.startsWith("/booking-calendar/"))) {
    const slug = serviceStudio.get(r.path.split("/").pop()!) || "";
    rules.push([r.path, slug ? toStudio(slug) : toUrl(VANCOUVER_CLASSES)]);
  }
  for (const [from, to] of rules) {
    await upsert("redirects", { from: { equals: from } }, { from, to, type: "301" });
  }
  return rules.length;
}

async function seedGlobals() {
  const link = (l: { text: string; href: string }) => ({ label: l.text, href: l.href });
  await payload.updateGlobal({
    slug: "settings",
    data: {
      phone: site.phoneDisplay,
      email: site.email,
      instagram: site.instagram,
      nav: inv.site.nav.map(link),
      footer: { text: homeText.footerText, links: inv.site.footer.map(link) },
    },
  });
  const homeRec: Rec = inv.pages.find((r: Rec) => r.path === "/");
  const galleryIds: number[] = [];
  for (const g of gallery) {
    const id = await media(path.join("public", g.src), g.alt);
    if (id) galleryIds.push(id);
  }
  // The old home page's own words for the membership section and the testimonial, so the page says each once.
  const moved = homeMoves(homeRec.blocks);
  const sections = homeText.sections.map((s) => (s.key === "membership" && moved.membership ? { ...s, body: moved.membership } : s));
  const testimonials = reviews.map((r, i) =>
    i === 0 && moved.review ? { ...r, quote: moved.review.quote, author: moved.review.author } : r,
  );
  await payload.updateGlobal({
    slug: "home",
    data: {
      hero: homeText.hero,
      gallery: galleryIds,
      sections: [
        ...sections,
        ...stageChapters.map((c, i) => ({ key: `stage-${i + 1}`, eyebrow: c.label, heading: c.title, body: c.body })),
        ...steps.map((s, i) => ({ key: `step-${i + 1}`, heading: s.title, body: s.body })),
        ...testimonials.map((r, i) => ({ key: `review-${i + 1}`, eyebrow: r.meta, heading: r.author, body: r.quote })),
      ],
      seo: seoFor(homeRec),
    },
  });
}

function writeFixes() {
  // Every finding of the crawl gets a row; those handled above already have one.
  const label: Record<string, string> = {
    "empty-description": "empty description",
    "no-h1": "no H1",
    "multiple-h1": " H1 |",
    "duplicate-title": "duplicate title",
    "broken-link": "broken link",
  };
  for (const entry of issues) {
    for (const i of entry.issues) {
      const has = fixes.some((f) => f.startsWith(`| \`${entry.path}\` |`) && f.includes(label[i.type] || i.type));
      if (has) continue;
      const name = (label[i.type] || i.type).replace(" H1 |", "several H1");
      if (SYSTEM_PAGES[entry.path]) {
        fixed(entry.path, name, `the page is not carried over: its address redirects (301) to ${SYSTEM_PAGES[entry.path]}`);
      } else if (/^\/(service-page|booking-calendar)\//.test(entry.path)) {
        fixed(entry.path, name, "the page is not carried over: its address redirects (301) to the page of its studio");
      } else if (i.type === "duplicate-title") {
        fixed(entry.path, name, "the title is kept as on Wix; the title of the product with the same name was made different");
      } else if (i.type === "broken-link") {
        fixed(entry.path, `${name} ${String(i.target || "")}`, "the link is not among the blocks of the page — it was not carried over to the new site");
      } else {
        fixed(entry.path, name, "[TBD] not fixed automatically");
      }
    }
  }
  const lines = [
    "# SEO fixes made in the move",
    "",
    "Generated by `npm run seed` from `content/crawl-issues.json`; do not edit by hand.",
    "The rule: a duplicate title gets a distinguishing addition; an empty description becomes the first ~155 characters",
    "of the page's own text; with no H1 the first heading becomes H1; with several H1 the first stays and the others become H2.",
    "The text of the pages is not changed.",
    "",
    `Findings of the crawl: ${issues.reduce((n, e) => n + e.issues.length, 0)}. Rows below: ${fixes.length}.`,
    "",
    "| Page | Finding | What was done |",
    "|---|---|---|",
    ...[...new Set(fixes)].sort(),
    "",
  ];
  writeFileSync(path.join(root, "content/seo-fixes.md"), lines.join("\n"));
}

async function main() {
  payload = await getPayload({ config });
  console.log(`seed: images ${withImages ? "on" : "off"}`);

  if (withImages) {
    for (const img of inv.images as { local: string; alt: string; usedOn: string[] }[]) {
      const page = [...inv.pages, ...inv.products].find((r: Rec) => r.path === img.usedOn?.[0]);
      await media(img.local, altFor(img, page ? page.name || pageName(page) : "Hand Eye Ceramics"));
    }
  }
  const studio = await seedStudios();
  let n = 0;
  for (const r of inv.pages as Rec[]) {
    if (SYSTEM_PAGES[r.path]) continue;
    await seedPage(r); // the Nanaimo page is also kept as page content for its studio
    n++;
  }
  await seedProducts();
  await seedPlans();
  await seedClasses(studio);
  const redirects = await seedRedirects(studio);
  await seedGlobals();
  if (writesFixes(process.env)) writeFixes();

  console.log(
    `seed: ${n} pages, ${locations.length} studios, ${inv.products.length} products, ${redirects} redirects, ${mediaByLocal.size} images`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

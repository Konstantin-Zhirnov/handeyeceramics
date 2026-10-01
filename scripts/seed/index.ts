/**
 * npm run seed — fills the CMS from the crawl inventory (content/inventory.json)
 * and the prototype data (lib/site.ts). Idempotent: every document is found by
 * its key (path, title, name, filename, from) and updated, never duplicated.
 *
 * SEED_IMAGES=0 skips uploading pictures (the tests use it for speed).
 * Writes content/seo-fixes.md: every finding of content/crawl-issues.json and
 * what was done about it.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getPayload, type Payload } from "payload";
import config from "../../payload.config";
import { classTabs, gallery, locations, reviews, site, stageChapters, steps } from "../../lib/site";
import { SITE_SUFFIX, excerpt, formatPrice } from "../../lib/cms/text";
import * as L from "./lexical";

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
  if (b.type === "image" || b.type === "form") return false;
  if (!t) return true;
  if (b.type === "text" && ["*", "Excluding Sales Tax", "Quantity *", "Price", "Regular Price", "Sale Price"].includes(t)) return true;
  if (b.type === "button" && t === "Add to Cart") return true;
  if (b.type === "list-item" && ["Top of Page", "Home", "Service list"].includes(t)) return true;
  return false;
}
const isProductTile = (b: Block) => b.type === "list-item" && (b.text || "").startsWith("Quick View");

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

const mediaByLocal = new Map<string, number>();
async function media(local: string | undefined, alt: string): Promise<number | undefined> {
  if (!withImages || !local) return undefined;
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

/** Story 8: the first H1 stays; with no H1 the first heading becomes it. */
function pickH1(r: Rec): { index: number; text: string } {
  let index = r.blocks.findIndex((b) => b.type === "heading" && b.level === 1);
  if (index < 0) index = r.blocks.findIndex((b) => b.type === "heading");
  return index >= 0 ? { index, text: r.blocks[index].text! } : { index: -1, text: pageName(r) };
}

function categoryOf(pagePath: string): string {
  const prods: Rec[] = inv.products.filter((p: Rec) => p.categoryPath === pagePath);
  if (pagePath === "/shop" || !prods.length) return "";
  const common = prods
    .map((p) => p.categories || [])
    .reduce((acc, cats) => acc.filter((c) => cats.includes(c)));
  return common[common.length - 1] || "";
}

/** Inventory blocks → page blocks, in page order. */
async function toBlocks(r: Rec, h1Index: number) {
  const out: Record<string, unknown>[] = [];
  let nodes: L.Node[] = [];
  let list: string[] = [];
  let images: number[] = [];
  let tilesDone = false;

  const flushList = () => {
    if (list.length) nodes.push(L.list(list));
    list = [];
  };
  const flushText = () => {
    flushList();
    if (nodes.length) out.push({ blockType: "text", body: L.root(nodes) });
    nodes = [];
  };
  const flushImages = () => {
    if (images.length === 1) out.push({ blockType: "image", image: images[0] });
    else if (images.length > 1) out.push({ blockType: "gallery", images });
    images = [];
  };

  for (const [i, b] of r.blocks.entries()) {
    if (i === h1Index || isChrome(b)) continue;
    if (b.type !== "image") flushImages();
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
        nodes.push(L.heading(b.text!, Math.min(6, Math.max(2, b.level || 2))));
        break;
      case "button": {
        flushList();
        const href = b.href ? LINK_FIXES[b.href] || b.href : "";
        if (b.href && LINK_FIXES[b.href]) fixed(r.path, `битая ссылка ${b.href}`, `кнопка «${b.text}» ведёт на ${href}`);
        nodes.push(href ? L.linkParagraph(b.text!, href) : L.paragraph(b.text!));
        break;
      }
      default:
        flushList();
        nodes.push(L.paragraph(b.text!));
    }
  }
  flushImages();
  flushText();
  return out;
}

const contentText = (r: Rec) =>
  r.blocks.filter((b) => b.text && !isChrome(b) && !isProductTile(b)).map((b) => b.text).join(" ");

function seoFor(r: Rec) {
  let description = r.description;
  if (!description) {
    description = excerpt(contentText(r)) || pageName(r);
    fixed(r.path, "пустой description", `первые ${description.length} символов текста страницы`);
  }
  return { title: r.title, description };
}

function noteH1(r: Rec, h1: { index: number; text: string }) {
  if (r.h1.length > 1) fixed(r.path, `${r.h1.length} H1`, `H1 — «${h1.text}», остальные стали H2`);
  if (r.h1.length === 0)
    fixed(r.path, "нет H1", h1.index >= 0 ? `первый заголовок «${h1.text}» стал H1` : `заголовков нет: H1 — «${h1.text}» из title`);
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

async function seedProducts() {
  for (const r of inv.products as Rec[]) {
    const h1 = pickH1(r);
    const price = formatPrice(r.price);
    const description = r.blocks
      .filter((b, i) => i !== h1.index && b.text && !isChrome(b) && b.type !== "image" && b.text.trim() !== price)
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
      fixed(r.path, "пустой description", `первые ${seo.description.length} символов текста товара`);
    }
    // Story 8: a title that repeats a page's title gets the category added.
    if (duplicateTitle(r.path)) {
      seo.title = `${pageName(r)} | ${category || "Shop"}${SITE_SUFFIX}`;
      fixed(r.path, "повтор title", `title дополнен категорией: «${seo.title}»`);
    }
    await upsert("products", { path: { equals: r.path } }, {
      name: r.name || h1.text,
      path: r.path,
      price: r.price ?? null,
      images,
      description,
      category: (r.categories?.length ? r.categories.join(", ") : r.category) || undefined,
      seo,
      visible: true,
    });
  }
}

async function seedPlans() {
  let order = 0;
  for (const page of inv.pricing as Rec[]) {
    for (const plan of page.plans || []) {
      await upsert("plans", { name: { equals: plan.name } }, {
        name: plan.name,
        price: Number(plan.price),
        period: plan.period,
        description: [plan.description, ...plan.benefits].filter(Boolean).join("\n"),
        order: order++,
      });
    }
    await seedPage(page);
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
      footer: { links: inv.site.footer.map(link) },
    },
  });
  const homeRec: Rec = inv.pages.find((r: Rec) => r.path === "/");
  await payload.updateGlobal({
    slug: "home",
    data: {
      sections: [
        ...stageChapters.map((c, i) => ({ key: `stage-${i + 1}`, eyebrow: c.label, heading: c.title, body: c.body })),
        ...steps.map((s, i) => ({ key: `step-${i + 1}`, heading: s.title, body: s.body })),
        ...reviews.map((r, i) => ({ key: `review-${i + 1}`, eyebrow: r.meta, heading: r.author, body: r.quote })),
      ],
      seo: seoFor(homeRec),
    },
  });
  for (const g of gallery) await media(path.join("public", g.src), g.alt);
}

function writeFixes() {
  // Every finding of the crawl gets a row; those handled above already have one.
  const label: Record<string, string> = {
    "empty-description": "пустой description",
    "no-h1": "нет H1",
    "multiple-h1": " H1 |",
    "duplicate-title": "повтор title",
    "broken-link": "битая ссылка",
  };
  for (const entry of issues) {
    for (const i of entry.issues) {
      const has = fixes.some((f) => f.startsWith(`| \`${entry.path}\` |`) && f.includes(label[i.type] || i.type));
      if (has) continue;
      const name = (label[i.type] || i.type).replace(" H1 |", "несколько H1");
      if (SYSTEM_PAGES[entry.path]) {
        fixed(entry.path, name, `страница не переносится: адрес переведён 301 на ${SYSTEM_PAGES[entry.path]}`);
      } else if (/^\/(service-page|booking-calendar)\//.test(entry.path)) {
        fixed(entry.path, name, "страница не переносится: адрес переведён 301 на страницу своей студии");
      } else if (i.type === "duplicate-title") {
        fixed(entry.path, name, "title оставлен как на Wix; отличие получил title товара с тем же названием");
      } else if (i.type === "broken-link") {
        fixed(entry.path, `${name} ${String(i.target || "")}`, "ссылки нет среди блоков страницы — на новый сайт она не перенесена");
      } else {
        fixed(entry.path, name, "[TBD] не исправлено автоматически");
      }
    }
  }
  const lines = [
    "# Исправления SEO при переносе",
    "",
    "Генерируется `npm run seed` по `content/crawl-issues.json`; руками не править.",
    "Правило — история 8: повтор title дополняется отличием, пустой description — первые ~155 символов",
    "текста самой страницы, нет H1 — первый заголовок становится H1, несколько H1 — первый остаётся, остальные H2.",
    "Текст страниц не меняется.",
    "",
    `Находок в обходе: ${issues.reduce((n, e) => n + e.issues.length, 0)}. Записей ниже: ${fixes.length}.`,
    "",
    "| Страница | Находка | Что сделано |",
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
  writeFixes();

  console.log(
    `seed: ${n} pages, ${locations.length} studios, ${inv.products.length} products, ${redirects} redirects, ${mediaByLocal.size} images`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

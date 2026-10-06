/**
 * Studio pages and the home page read the CMS. Expectations are written by
 * hand from the prototype data (addresses, names, the phone) — not computed by
 * the site.
 */
import { execFile } from "node:child_process";
import path from "node:path";
import { load, type CheerioAPI } from "cheerio";
import { beforeAll, describe, expect, inject, it } from "vitest";
import { assertThrowAwayTarget } from "./editor";

const root = path.resolve(import.meta.dirname, "../..");
const base = () => inject("baseURL");

async function page(url: string): Promise<{ status: number; $: CheerioAPI }> {
  const res = await fetch(`${base()}${url}`, { redirect: "manual" });
  return { status: res.status, $: load(await res.text()) };
}

/** Every JSON-LD object of the page. */
const jsonLd = ($: CheerioAPI): Record<string, any>[] =>
  $('script[type="application/ld+json"]')
    .toArray()
    .map((el) => JSON.parse($(el).text()));

const hrefs = ($: CheerioAPI, selector: string) =>
  $(selector)
    .toArray()
    .map((a) => $(a).attr("href"));

/** An edit in the admin: Payload's Local API on the database of the running site. */
async function cmsUpdate(collection: string, where: Record<string, string>, data: Record<string, unknown>) {
  return cms({ collection, where, data });
}

/** Any edit of tests/site/cms-update.ts: an update, `create` or `remove`. */
async function cms(input: Record<string, unknown>) {
  assertThrowAwayTarget(base());
  const uri = inject("databaseURI");
  if (!uri) throw new Error("with TEST_BASE_URL also set DATABASE_URI to the database of that server");
  // Not spawnSync: a blocked event loop leaves stale keep-alive sockets behind, and the next fetch resets.
  await new Promise<void>((resolve, reject) => {
    execFile(
      process.execPath,
      ["--import", "tsx", "tests/site/cms-update.ts"],
      {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, DATABASE_URI: uri, NODE_OPTIONS: "--no-deprecation", CMS_UPDATE: JSON.stringify(input) },
      },
      (error, stdout, stderr) => (error ? reject(new Error(`cms-update failed:\n${(stdout + stderr).slice(-2000)}`)) : resolve()),
    );
  });
}

/** Titles of the classes the API gives to a visitor who is not signed in. */
async function classTitles(): Promise<string[]> {
  const res = await fetch(`${base()}/api/classes?limit=500&depth=0`);
  return ((await res.json()).docs as { title: string }[]).map((d) => d.title);
}

const CHINATOWN = "/classes/vancouver-chinatown";
const MT_PLEASANT = "/classes/vancouver-mount-pleasant";
const NANAIMO = "/nanaimo-pottery-classes";
const CALGARY = "/classes/calgary";
const PHONE = "tel:+17788983414"; // (778) 898-3414, the business phone

const OPEN = [
  { path: CHINATOWN, street: "739 Gore Ave, 2nd floor", locality: "Vancouver", postalCode: "V6A 2Z9", title: /Chinatown/ },
  { path: MT_PLEASANT, street: "322 E 5th Ave", locality: "Vancouver", postalCode: "V5T 1J1", title: /Mt Pleasant/ },
  { path: NANAIMO, street: "3168 Uplands Drive", locality: "Nanaimo", postalCode: "V9T 2S8", title: /Nanaimo/ },
];

describe("studio pages", () => {
  // A cold dev server compiles the studio template for minutes: let it, before the clock of a test runs.
  beforeAll(async () => {
    await fetch(`${inject("baseURL")}${CALGARY}`).then((r) => r.arrayBuffer());
  }, 900_000);

  it("gives every studio its own page, H1 and title", async () => {
    const titles: string[] = [];
    for (const url of [...OPEN.map((s) => s.path), CALGARY]) {
      const { status, $ } = await page(url);
      expect(status, url).toBe(200);
      expect($("h1").length, `${url} H1 count`).toBe(1);
      titles.push($("title").text());
    }
    OPEN.forEach((s, i) => expect(titles[i]).toMatch(s.title));
    expect(titles[3]).toMatch(/Calgary/);
    expect(new Set(titles).size).toBe(4);
  });

  it("describes each open studio to Google as a LocalBusiness with its own address", async () => {
    for (const s of OPEN) {
      const { $ } = await page(s.path);
      const business = jsonLd($).find((d) => d["@type"] === "LocalBusiness");
      expect(business, `${s.path} LocalBusiness`).toBeDefined();
      expect(business!.address).toMatchObject({
        "@type": "PostalAddress",
        streetAddress: s.street,
        addressLocality: s.locality,
        addressRegion: "BC",
        postalCode: s.postalCode,
        addressCountry: "CA",
      });
      // Chinatown lists its own number; the others fall back to the business phone — the same one.
      expect(business!.telephone).toBe("+17788983414");
      expect(hrefs($, "main a"), `${s.path} call link`).toContain(PHONE);
    }
  });

  it("shows the studio's address and links to the other studios", async () => {
    const { $ } = await page(CHINATOWN);
    expect($("main").text()).toContain("739 Gore Ave, 2nd floor");
    const links = hrefs($, "main a");
    for (const other of [MT_PLEASANT, NANAIMO, CALGARY]) expect(links, other).toContain(other);
  });

  it("keeps Calgary a coming-soon page: no phone, no timetable, no address for Google", async () => {
    const { status, $ } = await page(CALGARY);
    expect(status).toBe(200);
    expect(jsonLd($).filter((d) => d.address || d.telephone)).toEqual([]);
    expect(hrefs($, "main a").filter((h) => h?.startsWith("tel:"))).toEqual([]);
    expect($("main").text()).toContain("Nothing scheduled yet");
    expect($("[data-schedule]").text()).not.toMatch(/\d\s?(AM|PM)/);
  });

  it("shows a class time edited in the CMS without a rebuild", { timeout: 600_000 }, async () => {
    const title = "Six-week courses — Nanaimo";
    const before = "Mon, Tue, Wed & Thu 6 PM"; // the seeded time
    const after = "Mon & Tue 5:15 PM";
    expect((await page(NANAIMO)).$("[data-schedule]").text()).toContain(before);
    await cmsUpdate("classes", { title }, { sessions: [{ time: after }] });
    try {
      const text = (await page(NANAIMO)).$("[data-schedule]").text();
      expect(text).toContain(after);
      expect(text).not.toContain(before);
    } finally {
      await cmsUpdate("classes", { title }, { sessions: [{ time: before }] });
    }
  });

  it("drops an unpublished studio and its classes from the site", { timeout: 600_000 }, async () => {
    // "Hand building" runs only in Chinatown; "Wheel throwing" also in Nanaimo.
    const home = (await page("/")).$;
    expect(hrefs(home, "main a")).toContain(CHINATOWN);
    expect(home("#classes").text()).toContain("Hand building");
    expect(await classTitles()).toContain("Drop-in hand building — Chinatown");
    await cmsUpdate("studios", { path: CHINATOWN }, { published: false });
    try {
      const { $ } = await page("/");
      expect(hrefs($, "a")).not.toContain(CHINATOWN);
      expect($("#classes").text()).not.toContain("Hand building");
      expect($("#classes").text()).toContain("Wheel throwing");
      expect(hrefs((await page(NANAIMO)).$, "a")).not.toContain(CHINATOWN);
      expect((await page(CHINATOWN)).status).toBe(404);
      // The API follows the same rule: a class of unpublished studios only is not served to a visitor.
      const hidden = await classTitles();
      expect(hidden).not.toContain("Drop-in hand building — Chinatown");
      expect(hidden).toContain("Six-week courses — Nanaimo");
    } finally {
      await cmsUpdate("studios", { path: CHINATOWN }, { published: true });
    }
  });
});

describe("home page", () => {
  it("has the old site's H1 as its only H1 and keeps the prototype's line as decoration", async () => {
    const { $ } = await page("/");
    expect($("h1").toArray().map((el) => $(el).text().trim())).toEqual(["Hands-on Pottery Classes"]);
    expect($("main").text()).toContain("your first pot");
  });

  it("puts the H1 on the first screen, in the hero, and the old site's text in a section below", async () => {
    const { $ } = await page("/");
    const hero = $("main").children().first();
    expect(hero.find("h1").text().trim()).toBe("Hands-on Pottery Classes");
    // The prototype's large line is still there, next to the H1 and not inside it.
    expect(hero.text()).toContain("your first pot");
    expect(hero.find("h1").text()).not.toContain("your first pot");
    // The text of the old home page stays a block of its own: "Group Workshops" is one of its headings.
    expect($("#about h1")).toHaveLength(0);
    expect($("#about h2").toArray().map((el) => $(el).text().trim())).toContain("Group Workshops");
  });

  it("says each thing once: the old page's testimonial and membership line stand in their sections, not in the old text too", async () => {
    const { $ } = await page("/");
    const main = $("main").text().replace(/\s+/g, " ");
    const times = (s: string) => main.split(s).length - 1;
    expect(times("Courtney P.")).toBe(1);
    expect(times("I recently finished a 6 week")).toBe(1);
    expect(times("as low as $145 monthly")).toBe(1);
    expect($("#about").text()).not.toContain("Courtney P.");
    expect($("#about").text()).not.toContain("Unlock creative potential");
  });
});

describe("class list block", () => {
  it("leaves out the classes of a studio that is not published", { timeout: 600_000 }, async () => {
    const probe = "/zz-class-list-probe";
    const block = { blockType: "classList", heading: "All classes" };
    await cms({ collection: "pages", create: { title: "Class list probe", path: probe, h1: "Class list probe", published: true, blocks: [block] } });
    try {
      const shown = (await page(probe)).$("main").text();
      expect(shown).toContain("Drop-in hand building — Chinatown");
      expect(shown).toContain("Six-week courses — Nanaimo");
      await cmsUpdate("studios", { path: CHINATOWN }, { published: false });
      try {
        const hidden = (await page(probe)).$("main").text();
        expect(hidden).not.toContain("Drop-in hand building — Chinatown");
        expect(hidden).toContain("Six-week courses — Nanaimo");
      } finally {
        await cmsUpdate("studios", { path: CHINATOWN }, { published: true });
      }
    } finally {
      await cms({ collection: "pages", where: { path: probe }, remove: true });
    }
  });
});

describe("book links", () => {
  /** Where the "Book now" link of the classes section leads. */
  const bookLink = ($: CheerioAPI, from: string) => {
    const link = $("#classes a").filter((_, a) => $(a).text().trim() === "Book now");
    return new URL(link.attr("href") || "about:blank", `${base()}${from}`).pathname;
  };

  it("lead to the booking page of the studio, not to one page for all studios", async () => {
    // The Vancouver classes page is the booking page of the Vancouver studios; Nanaimo books on its own page.
    expect(bookLink((await page(CHINATOWN)).$, CHINATOWN)).toBe("/adult-beginner-pottery-classes-in-vancouver");
    expect(bookLink((await page(NANAIMO)).$, NANAIMO)).toBe(NANAIMO);
  });

  it("keep Mt Pleasant on its own page: the beginner courses do not run there", async () => {
    const res = await fetch(`${base()}/api/studios?limit=0&pagination=false&depth=0`);
    const studios = (await res.json()).docs as { path: string; bookingPath?: string | null }[];
    expect(studios.find((s) => s.path === MT_PLEASANT)?.bookingPath || "").toBe("");
    expect(studios.find((s) => s.path === CHINATOWN)?.bookingPath).toBe("/adult-beginner-pottery-classes-in-vancouver");
    const { $ } = await page(MT_PLEASANT);
    expect(hrefs($, "main a")).not.toContain("/adult-beginner-pottery-classes-in-vancouver");
  });
});

describe("header and footer", () => {
  it("carry the phone, e-mail and links of the site settings on every template", async () => {
    for (const url of ["/", CALGARY, "/about-us"]) {
      const { status, $ } = await page(url);
      expect(status, url).toBe(200);
      expect(hrefs($, "header a"), `${url} header`).toContain(PHONE);
      expect(hrefs($, "footer a"), `${url} footer`).toContain(PHONE);
      expect($("footer").text(), `${url} footer`).toContain("(778) 898-3414");
      expect(hrefs($, "footer a"), `${url} footer`).toContain("mailto:info@handeyeceramics.com");
      expect(hrefs($, "footer a"), `${url} footer`).toContain("/contact-us");
    }
  });
});

describe("sitemap", () => {
  it("lists the real addresses of studios, pages and products, and no redirected ones", async () => {
    const res = await fetch(`${base()}/sitemap.xml`);
    expect(res.status).toBe(200);
    const $ = load(await res.text(), { xmlMode: true });
    const paths = $("url > loc")
      .toArray()
      .map((el) => new URL($(el).text()).pathname);
    // Written by hand: the Wix address of Nanaimo, the prototype addresses of the
    // other studios, a page and a product of the old site.
    for (const p of ["/", NANAIMO, CHINATOWN, MT_PLEASANT, CALGARY, "/contact-us", "/shop", "/product-page/apron"]) {
      expect(paths, p).toContain(p);
    }
    // These answer 301 (prototype address of Nanaimo, Wix duplicates of the home page).
    for (const p of ["/classes/nanaimo", "/home", "/paywall"]) expect(paths, p).not.toContain(p);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("and canonical links and JSON-LD carry the address the site is served from", async () => {
    const xml = load(await (await fetch(`${base()}/sitemap.xml`)).text(), { xmlMode: true });
    const origins = new Set(xml("url > loc").toArray().map((el) => new URL(xml(el).text()).origin));
    expect([...origins]).toEqual([base()]);
    const { $ } = await page(NANAIMO);
    expect($('link[rel="canonical"]').attr("href")).toBe(`${base()}${NANAIMO}`);
    expect(jsonLd($).find((o) => o["@type"] === "LocalBusiness")?.url).toBe(`${base()}${NANAIMO}`);
    expect((await page("/")).$('link[rel="canonical"]').attr("href")).toBe(base());
  });
});

const MENU = 'nav[aria-label="Site menu"] a';

describe("menu", () => {
  it("is in the HTML the server sends, without JavaScript", async () => {
    const { $ } = await page("/");
    const menu = hrefs($, MENU);
    // Links of the old site's menu, written by hand.
    for (const href of ["/adult-beginner-pottery-classes-in-vancouver", "/youth-pottery-classes", "/membership-rentals", "/gift-card", "/contact-us", "/open-studio"]) {
      expect(menu, href).toContain(href);
    }
    const studio = await page(NANAIMO);
    expect(hrefs(studio.$, MENU)).toContain("/contact-us");
  });
});

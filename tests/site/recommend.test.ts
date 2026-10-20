/**
 * "You might also like" under a product page: other classes in the same city,
 * the other studio's first, unless the owner picks the products in the admin
 * (the next level after a course). The rule itself — tests/unit/recommend.test.ts;
 * here the page, and the admin edits reaching it on the next request.
 */
import { load, type CheerioAPI } from "cheerio";
import { beforeAll, describe, expect, inject, it } from "vitest";
import { assertThrowAwayTarget, editorToken } from "./editor";

const base = () => inject("baseURL");

const WHEEL = "/product-page/6-week-wheel-throwing-pottery-classes-in-vancouver";
const HAND_BUILDING = "/product-page/hand-building-beginner-to-intermediate";
const DROP_IN = "/product-page/fri-sat-sun-date-night-wheel-seats-sold-separately-bigger-groups-welcome-also";
const NANAIMO = "/product-page/demystifying-slip-casting-and-marbling-clay";
const NANAIMO_YOUTH = "/product-page/glaze-chemistry-class-1";
const APRON = "/product-page/apron";
const MT_PLEASANT = "/classes/vancouver-mount-pleasant";
const CHINATOWN = "/classes/vancouver-chinatown";

type Doc = Record<string, any>;

let token = "";
async function api(p: string, init: RequestInit = {}): Promise<Doc> {
  token ||= await editorToken(base());
  const res = await fetch(`${base()}/api${p}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `JWT ${token}`, ...(init.headers || {}) },
  });
  expect(res.status, `${init.method || "GET"} /api${p}`).toBe(200);
  return res.json();
}
const one = async (collection: string, path: string): Promise<Doc> =>
  (await api(`/${collection}?where[path][equals]=${encodeURIComponent(path)}&depth=0`)).docs[0];
const patch = (collection: string, id: number, data: Doc) => api(`/${collection}/${id}`, { method: "PATCH", body: JSON.stringify(data) });

async function page(path: string): Promise<CheerioAPI> {
  const res = await fetch(`${base()}${path}`);
  expect(res.status, path).toBe(200);
  return load(await res.text());
}
/** The product paths in the block, in order; null — no block at all. */
async function recommended(path: string): Promise<string[] | null> {
  const $ = await page(path);
  const block = $("main [data-recommended]");
  if (!block.length) return null;
  expect(block.find("h2").text().trim()).toBe("You might also like");
  return block
    .find("[data-product] a")
    .toArray()
    .map((a) => $(a).attr("href")!);
}

// A cold dev server compiles the product template for minutes when the machine is busy.
beforeAll(async () => {
  await (await fetch(`${base()}${WHEEL}`)).arrayBuffer();
}, 600_000);

describe("you might also like", () => {
  it("a Vancouver class recommends other Vancouver classes, never itself or Nanaimo", async () => {
    const paths = await recommended(WHEEL);
    expect(paths).not.toBeNull();
    expect(paths).toEqual(expect.arrayContaining([HAND_BUILDING, DROP_IN]));
    expect(paths).not.toContain(WHEEL);
    expect(paths).not.toContain(NANAIMO);
    expect(paths).not.toContain(NANAIMO_YOUTH);
    // Each card: photo (or its placeholder when the product has none), name and price, as on the shop shelves.
    const $ = await page(WHEEL);
    for (const el of $("main [data-recommended] [data-product]").toArray()) {
      const card = $(el);
      expect(card.find("img[alt]").length + card.find("span[aria-hidden]").length).toBe(1);
      expect(card.find("a").text()).toMatch(/\S/);
      expect(card.find("[data-price-current]").text()).toMatch(/^CA\$/);
    }
  });

  it("a Nanaimo class recommends Nanaimo classes only", async () => {
    const paths = await recommended(NANAIMO);
    expect(paths).toEqual([NANAIMO_YOUTH]);
  });

  it("a product with no dates and no pick has no block", async () => {
    expect(await recommended(APRON)).toBeNull();
  });

  it("puts the classes of the other Vancouver studio first", async () => {
    assertThrowAwayTarget(base());
    const hb = await one("products", HAND_BUILDING);
    const [chinatown, mtPleasant] = [await one("studios", CHINATOWN), await one("studios", MT_PLEASANT)];
    const sessions = (await api(`/sessions?where[product][equals]=${hb.id}&where[status][equals]=open&sort=startsAt&limit=0&depth=0`)).docs as Doc[];
    const date = sessions.find((s) => s.left > 0 && (!s.endsAt || new Date(s.endsAt) > new Date()));
    expect(date, "an open Hand Building date").toBeDefined();
    await patch("sessions", date!.id, { studio: mtPleasant.id });
    try {
      expect((await recommended(WHEEL))![0]).toBe(HAND_BUILDING);
      // …and back: a Mt Pleasant class points to Chinatown.
      expect(await recommended(HAND_BUILDING)).toEqual(expect.arrayContaining([WHEEL, DROP_IN]));
    } finally {
      await patch("sessions", date!.id, { studio: chinatown.id });
    }
  });

  it("the owner's pick in the admin replaces the rule, in the owner's order", async () => {
    assertThrowAwayTarget(base());
    const wheel = await one("products", WHEEL);
    const [nanaimo, apron] = [await one("products", NANAIMO), await one("products", APRON)];
    await patch("products", wheel.id, { recommended: [nanaimo.id, apron.id] });
    try {
      expect(await recommended(WHEEL)).toEqual([NANAIMO, APRON]);
      // A picked product hidden in the admin drops out.
      await patch("products", apron.id, { visible: false });
      try {
        expect(await recommended(WHEEL)).toEqual([NANAIMO]);
      } finally {
        await patch("products", apron.id, { visible: true });
      }
    } finally {
      await patch("products", wheel.id, { recommended: [] });
    }
    expect(await recommended(WHEEL)).toEqual(expect.arrayContaining([HAND_BUILDING, DROP_IN]));
  });
});

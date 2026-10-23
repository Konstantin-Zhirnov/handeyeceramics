/**
 * The shop: product pages, storefronts and plans. Expected values are written
 * by hand from the old site (content/inventory.json), not computed by the code.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { load, type CheerioAPI } from "cheerio";
import { beforeAll, describe, expect, inject, it } from "vitest";
import { parseSessionLabel } from "../../scripts/seed/sessions";

const base = () => inject("baseURL");

async function get(path: string): Promise<{ status: number; $: CheerioAPI }> {
  const res = await fetch(`${base()}${path}`);
  return { status: res.status, $: load(await res.text()) };
}

const text = ($: CheerioAPI) => $("main").text().replace(/\s+/g, " ");

function productJsonLd($: CheerioAPI): Record<string, any> | undefined {
  return $('script[type="application/ld+json"]')
    .toArray()
    .flatMap((el) => [JSON.parse($(el).text())].flat())
    .find((d) => d["@type"] === "Product");
}

const POT = "/product-page/hanging-plant-pot";
const CLASS = "/product-page/6-week-wheel-throwing-pottery-classes-in-vancouver";

describe("product page", () => {
  // A cold dev server compiles the product template for minutes when the machine is busy: let it, before the clock of a test runs.
  beforeAll(async () => {
    await (await fetch(`${base()}${POT}`)).arrayBuffer();
  }, 600_000);

  it("shows the price, the description and the variants of the old page", async () => {
    const { status, $ } = await get(POT);
    expect(status).toBe(200);
    expect($("h1").text().trim()).toBe("Hanging Plant Pot");
    const body = text($);
    expect(body).toContain("CA$95.00");
    expect(body).toContain('10"W x 5" H.');
    expect(body).toContain("Available with blue or black bubbles.");
    // The old drop-down keeps its variants.
    const options = $("[data-product-option]");
    expect(options).toHaveLength(1);
    expect(options.find("[data-option-title]").text().trim()).toBe("Glaze Colour");
    expect(options.find("option").toArray().map((o) => $(o).text().trim())).toEqual(["Select", "Blue bubbles", "Black bubbles"]);
    // …and its label is not repeated inside the description.
    expect(body.split("Glaze Colour")).toHaveLength(2);
  });

  it("describes the product to search engines with its price in CAD", async () => {
    const { $ } = await get(POT);
    const ld = productJsonLd($);
    expect(ld).toBeDefined();
    expect(ld!.name).toBe("Hanging Plant Pot");
    expect(ld!.description).toContain("Available with blue or black bubbles.");
    expect(Number(ld!.offers.price)).toBe(95);
    expect(ld!.offers.priceCurrency).toBe("CAD");
    expect(ld!.offers.url).toMatch(/\/product-page\/hanging-plant-pot$/);
  });

  it("offers Add to cart with the studio's phone beside it; the old notice is gone", async () => {
    const { $ } = await get(POT);
    const buy = $("main [data-buy]");
    expect(buy).toHaveLength(1);
    expect(buy.find("button[data-add]").text().trim()).toBe("Add to cart");
    expect(buy.find("a[data-call-studio]").attr("href")).toBe("tel:+17788983414");
    expect(text($)).not.toContain("Online checkout coming soon");
    // A pot has no dates: variants and quantity only.
    expect($("[data-product-sessions]")).toHaveLength(0);
  });

  it("shows the sale price next to the regular one", async () => {
    const { $ } = await get(CLASS);
    const price = $("[data-price]").first();
    expect(price.find("[data-price-regular]").text().trim()).toBe("CA$371.00");
    expect(price.find("[data-price-current]").text().trim()).toBe("CA$296.80");
    expect(Number(productJsonLd($)!.offers.price)).toBe(296.8);
  });

  it("lists the dates of the old Date drop-down as sessions, the finished ones left out, each with its price", async () => {
    const { $ } = await get(CLASS);
    // The Date drop-down is a list of sessions now, not a product option.
    expect($("[data-product-option]")).toHaveLength(0);
    const dates = $("[data-product-sessions]");
    expect(dates).toHaveLength(1);
    expect(dates.find("[data-option-title]").text().trim()).toBe("Date");
    // The 66 labels of the old drop-down (content/inventory.json), read by the seed's own parser:
    // those not over by today are listed, word for word, with the class's sale price.
    const inv = JSON.parse(readFileSync(path.join(import.meta.dirname, "../../content/inventory.json"), "utf8"));
    const labels: string[] = inv.products.find((p: { path: string }) => p.path === CLASS).options.find((o: { title: string }) => o.title === "Date").choices;
    expect(labels).toHaveLength(66);
    const now = Date.now();
    const expected = labels.filter((l) => {
      const parsed = parseSessionLabel(l, new Date("2026-08-01T00:00:00Z"));
      return parsed.endsAt && parsed.endsAt.getTime() >= now;
    });
    const shown = dates.find("option[value!='']").toArray().map((o) => $(o).text().trim());
    expect(shown.length).toBeGreaterThan(0);
    // The page orders them by date; the old drop-down did not.
    expect(shown.map((s) => s.replace(/ — CA\$296\.80.*$/, "")).sort()).toEqual([...expected].sort());
    expect(shown.every((s) => s.includes(" — CA$296.80"))).toBe(true);
    // Nothing is sold yet: no date is marked sold out.
    expect(dates.find("option[disabled]")).toHaveLength(0);
  });
});

const productLinks = ($: CheerioAPI) =>
  [...new Set($("main [data-product] a").toArray().map((a) => $(a).attr("href")!.replace("/product-page/", "")))].sort();

describe("storefronts", () => {
  // Written by hand from the tiles of the old pages.
  const shelves: Record<string, string[]> = {
    "/pieces-for-sale": [
      "coming-back-to-under-glaze-1-off-pottery-workshop-pots",
      "hanging-plant-pot",
      "studio-membership-subscription",
    ],
    "/memberships-rentals-shop": ["studio-membership-subscription", "wheel-rental-subscription"],
    "/shop": [
      "6-week-wheel-throwing-pottery-classes-in-vancouver",
      "demystifying-slip-casting-and-marbling-clay",
      "fri-sat-sun-date-night-wheel-seats-sold-separately-bigger-groups-welcome-also",
      "glaze-chemistry-class-1",
      "hand-building-beginner-to-intermediate",
      "wheel-throwing-intermediate-only-spring",
    ],
  };

  it.each(Object.entries(shelves))("%s lists the products of the old page", async (path, expected) => {
    const { status, $ } = await get(path);
    expect(status).toBe(200);
    expect(productLinks($)).toEqual(expected);
  });

  it("prints each product's name and price on its tile", async () => {
    const { $ } = await get("/memberships-rentals-shop");
    const tile = $('[data-product]:has(a[href="/product-page/wheel-rental-subscription"])');
    expect(tile.text()).toContain("Wheel Rental Subscription");
    expect(tile.find("[data-price-current]").text().trim()).toBe("CA$132.00");
    const { $: shop } = await get("/shop");
    const sale = shop('[data-product]:has(a[href="/product-page/hand-building-beginner-to-intermediate"])');
    expect(sale.find("[data-price-regular]").text().trim()).toBe("CA$371.00");
    expect(sale.find("[data-price-current]").text().trim()).toBe("CA$278.25");
  });

  it("has as many products as the old storefront had tiles", async () => {
    // Counted by hand on the old pages (13 aprons and tools, 16 clays, 1 drop-in).
    for (const [path, count] of [["/apron-tools", 13], ["/clay", 16], ["/friday-night-drop-in", 1]] as const) {
      const { $ } = await get(path);
      expect(productLinks($), path).toHaveLength(count);
    }
  });

  it("says so when a storefront is empty", async () => {
    // The two storefronts the old site showed empty.
    for (const path of ["/youth-pottery-classes-shop", "/art-gallery"]) {
      const { status, $ } = await get(path);
      expect(status, path).toBe(200);
      expect($("main [data-product]"), path).toHaveLength(0);
      expect($("main [data-empty]").text().trim(), path).toBe("No products here yet.");
    }
  });

  it("lists the product the old Saturday page linked to", async () => {
    const { $ } = await get("/saturday-night-drop-in");
    expect(productLinks($)).toEqual(["fri-sat-sun-date-night-wheel-seats-sold-separately-bigger-groups-welcome-also"]);
    expect($("main [data-empty]")).toHaveLength(0);
  });

  it("links the shop's sections to each other, the empty ones left out", async () => {
    const { $ } = await get("/shop");
    const nav = $('nav[aria-label="Shop sections"]');
    const hrefs = nav.find("a").toArray().map((a) => $(a).attr("href"));
    expect(hrefs).toEqual(expect.arrayContaining(["/shop", "/clay", "/apron-tools", "/pieces-for-sale", "/memberships-rentals-shop"]));
    expect(hrefs).not.toContain("/youth-pottery-classes-shop");
    expect(nav.find('a[aria-current="page"]').attr("href")).toBe("/shop");
  });

  it("drops a product hidden in the admin from its page and from the storefront", async () => {
    const { editorToken } = await import("./editor");
    const token = await editorToken(base());
    const path = "/product-page/hanging-plant-pot";
    const found = await (await fetch(`${base()}/api/products?where[path][equals]=${encodeURIComponent(path)}&depth=0`)).json();
    const id = found.docs[0].id;
    const setVisible = async (visible: boolean) => {
      const res = await fetch(`${base()}/api/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `JWT ${token}` },
        body: JSON.stringify({ visible }),
      });
      expect(res.status).toBe(200);
    };
    await setVisible(false);
    try {
      expect((await get(path)).status).toBe(404);
      expect(productLinks((await get("/pieces-for-sale")).$)).toEqual([
        "coming-back-to-under-glaze-1-off-pottery-workshop-pots",
        "studio-membership-subscription",
      ]);
    } finally {
      await setVisible(true);
    }
    expect((await get(path)).status).toBe(200);
    expect(productLinks((await get("/pieces-for-sale")).$)).toContain("hanging-plant-pot");
  });
});

describe("plans", () => {
  const PLANS = "/pricing-plans/plans-pricing";
  const MEMBERSHIPS = "/membership-rentals";
  const RENTAL = "/wheel-rental";
  const plan = ($: CheerioAPI, name: string) => $("main [data-plan]").filter((_, el) => $(el).find("h3").text().trim() === name);
  const price = ($: CheerioAPI, name: string) => plan($, name).find("[data-plan-price]").text().trim();
  const period = ($: CheerioAPI, name: string) => plan($, name).find("[data-plan-period]").toArray().map((el) => $(el).text().trim());

  it("prints the plans of the old site word for word", async () => {
    const { status, $ } = await get(PLANS);
    expect(status).toBe(200);
    // The old plans page had one plan; memberships and the rental stay on their own pages.
    expect($("main [data-plan] h3").toArray().map((h) => $(h).text().trim())).toEqual(["Tuesday Evening"]);
    const tuesday = plan($, "Tuesday Evening");
    expect(price($, "Tuesday Evening")).toBe("CA$267.75");
    expect(period($, "Tuesday Evening")).toEqual(["Valid for 7 days"]);
    expect(tuesday.text()).toContain("6 week Tuesday evening wheel throwing classes (6:30-9:00PM)");
    const { $: m } = await get(MEMBERSHIPS);
    expect(price(m, "Option 1")).toBe("CA$230.00");
    expect(plan(m, "Option 1").text()).toContain("24/7 access every day of month");
    expect(price(m, "Option 8 Semi Clay Craver (Nanaimo)")).toBe("CA$80.00");
    const { $: r } = await get(RENTAL);
    expect(plan(r, "Pottery Wheel Rental Program").text()).toContain(
      "Our pottery wheel rental program costs $125/month + GST ($131.25 after tax).",
    );
    // The old pricing widget's card, glued into one line by the crawl, is not page text.
    expect(text($)).not.toContain("Buy Now");
  });

  it("names a period only where the old text names one", async () => {
    const { $ } = await get(MEMBERSHIPS);
    // "$175+gst per month", "$150 monthly", "$80 per month", "$125/month" — and for the options that give
    // the amount alone ("$230+Gst (location …)", "$145+gst", …) the page's "All memberships … renew
    // automatically each month".
    const options = ["Option 1", "Option 2", "Option 3", "Option 4", "Option 5", "Option 6 (Nanaimo)", "Option 7 Clay Craver (Nanaimo)", "Option 8 Semi Clay Craver (Nanaimo)"];
    for (const name of options) {
      expect(period($, name), name).toEqual(["per month"]);
      expect(price($, name), name).toMatch(/^CA\$\d+\.00$/);
    }
    expect(period((await get(RENTAL)).$, "Pottery Wheel Rental Program")).toEqual(["per month"]);
  });

  it("puts memberships and the rental on their own pages, inside the old copy", async () => {
    const { $: m } = await get(MEMBERSHIPS);
    expect(m("main [data-plan] h3").toArray().map((h) => m(h).text().trim())).toEqual([
      "Option 1",
      "Option 2",
      "Option 3",
      "Option 4",
      "Option 5",
      "Option 6 (Nanaimo)",
      "Option 7 Clay Craver (Nanaimo)",
      "Option 8 Semi Clay Craver (Nanaimo)",
    ]);
    expect(plan(m, "Option 3").text()).toContain("2 full days per wk $175+gst per month");
    // The option's text is printed once — in its plan, not also as page copy.
    expect(text(m).split("Midnight to noon $175+gst per month")).toHaveLength(2);
    expect(text(m)).toContain("All memberships are a 2 month minimum commitment");

    const { $: r } = await get(RENTAL);
    expect(r("main [data-plan] h3").toArray().map((h) => r(h).text().trim())).toEqual(["Pottery Wheel Rental Program"]);
    expect(price(r, "Pottery Wheel Rental Program")).toBe("CA$125.00");
    expect(text(r).split("Our pottery wheel rental program costs")).toHaveLength(2);

    // The storefront keeps what the old one showed: two products, no plans.
    const { $: shop } = await get("/memberships-rentals-shop");
    expect(shop("main [data-plan]")).toHaveLength(0);
    expect(productLinks(shop)).toHaveLength(2);
  });

  it("shows the plans of the admin that belong to no page group, and a price changed there on every page that lists it", async () => {
    const { editorToken } = await import("./editor");
    const token = await editorToken(base());
    const { docs } = await (await fetch(`${base()}/api/plans?limit=200&depth=0`)).json();
    const { $ } = await get(PLANS);
    const shown = $("main [data-plan] h3").toArray().map((h) => $(h).text().trim()).sort();
    expect(shown).toEqual(docs.filter((d: { group?: string | null }) => !d.group).map((d: { name: string }) => d.name).sort());

    const option = docs.find((d: { name: string }) => d.name === "Option 2");
    const setPrice = async (value: number) => {
      const res = await fetch(`${base()}/api/plans/${option.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `JWT ${token}` },
        body: JSON.stringify({ price: value }),
      });
      expect(res.status).toBe(200);
    };
    await setPrice(181.5);
    try {
      expect(price((await get(MEMBERSHIPS)).$, "Option 2")).toBe("CA$181.50");
    } finally {
      await setPrice(175);
    }
    expect(price((await get(MEMBERSHIPS)).$, "Option 2")).toBe("CA$175.00");
  });

  it("shows Subscribe only on a plan with a Stripe price; the phone stays", async () => {
    const { $ } = await get(PLANS);
    expect($("main [data-subscribe]")).toHaveLength(0);
    expect(text($)).not.toContain("Online checkout coming soon");
    expect($("main [data-buy] a[data-call-studio]").attr("href")).toBe("tel:+17788983414");

    const { editorToken } = await import("./editor");
    const token = await editorToken(base());
    const { docs } = await (await fetch(`${base()}/api/plans?limit=200&depth=0`)).json();
    const tuesday = docs.find((d: { name: string }) => d.name === "Tuesday Evening");
    const setPrice = async (stripePriceId: string | null) => {
      const res = await fetch(`${base()}/api/plans/${tuesday.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `JWT ${token}` },
        body: JSON.stringify({ stripePriceId }),
      });
      expect(res.status).toBe(200);
    };
    await setPrice("price_test_tuesday");
    try {
      const { $: withId } = await get(PLANS);
      const form = plan(withId, "Tuesday Evening").find("form[data-subscribe]");
      expect(form.attr("action")).toBe("/checkout/subscribe");
      expect(form.attr("method")).toBe("post");
      expect(form.find('input[name="plan"]').attr("value")).toBe(String(tuesday.id));
      expect(form.find("button").text().trim()).toBe("Subscribe");
    } finally {
      await setPrice(null);
    }
    expect((await get(PLANS)).$("main [data-subscribe]")).toHaveLength(0);
  });
});

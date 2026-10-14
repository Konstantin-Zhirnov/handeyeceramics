/**
 * The cart over HTTP (R03, R03.3, R02, R16i, R10): the page, and the server's
 * pricing of a cart from the CMS of the seeded site. Expected figures are
 * worked out by hand from the old site's prices (content/inventory.json) and
 * the tax table: BC charges GST 5% on a class seat, GST 5% + PST 7% on clay.
 */
import { load } from "cheerio";
import { describe, expect, inject, it } from "vitest";

const base = () => inject("baseURL");

const CLASS = "/product-page/6-week-wheel-throwing-pottery-classes-in-vancouver"; // CA$371.00, on sale at CA$296.80
const CLAY = "/product-page/coffee-clay"; // CA$4.75
const GLAZE = "/product-page/glaze-chemistry-class-1"; // CA$199.00, one date in the old Date drop-down

type Doc = Record<string, any>;
const where = (field: string, value: string | number) => `where[${field}][equals]=${encodeURIComponent(String(value))}`;
const list = async (p: string): Promise<Doc[]> => (await (await fetch(`${base()}/api${p}`)).json()).docs || [];
const productId = async (path: string) => (await list(`/products?${where("path", path)}&depth=0`))[0].id as number;
/** An open date of the class with all its seats still free. */
async function openSession(): Promise<Doc> {
  const docs = await list(`/sessions?${where("product", await productId(CLASS))}&${where("status", "open")}&depth=0&limit=100`);
  const free = docs.find((d) => d.left === d.seats && d.seats > 0);
  expect(free, "an open date with free seats").toBeDefined();
  return free!;
}

async function validate(body: unknown) {
  const res = await fetch(`${base()}/cart/validate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: res.status, body: (await res.json()) as Doc };
}

describe("the cart page", () => {
  it("answers with one H1 and the way back to the shop", async () => {
    const res = await fetch(`${base()}/cart`);
    expect(res.status).toBe(200);
    const $ = load(await res.text());
    expect($("h1")).toHaveLength(1);
    expect($("h1").text().trim()).toBe("Your cart");
    expect($("head title").text()).toBe("Your cart | Hand Eye Ceramics");
    // The lines live in the browser: the server's page carries the empty cart and the header's cart link.
    expect($("a[data-cart-link]").attr("href")).toBe("/cart");
  });
});

describe("POST /cart/validate", () => {
  it("prices a class seat at today's sale price with GST only, taxed for the studio in BC", async () => {
    const session = await openSession();
    const { status, body } = await validate({ lines: [{ kind: "session", id: session.id, quantity: 2 }] });
    expect(status).toBe(200);
    expect(body.errors).toEqual([]);
    const [line] = body.lines;
    expect(line.unitAmount).toBe(29680);
    expect(line.taxGroup).toBe("service");
    expect(line.taxLines).toEqual([{ code: "GST", province: "BC", percentage: 5 }]);
    expect(line.taxAmount).toBe(2968); // 5% of $593.60
    expect(line.label).toContain(session.label);
    expect(line.studio).toBe(session.studio);
    expect(line.error).toBeUndefined();
    expect(body.subtotal).toBe(59360);
    expect(body.tax).toBe(2968);
    expect(body.total).toBe(62328);
    // No studio asked for: the class's own studio is the pickup studio.
    expect(body.studio.id).toBe(session.studio);
    expect(body.studio.province).toBe("BC");
  });

  it("charges GST and PST on clay, and keeps the chosen variant on the line", async () => {
    const clay = await productId(CLAY);
    const { body } = await validate({ lines: [{ kind: "product", id: clay, quantity: 2 }] });
    const [line] = body.lines;
    expect(line.unitAmount).toBe(475);
    expect(line.taxGroup).toBe("goods");
    expect(line.taxLines.map((t: Doc) => `${t.code} ${t.percentage}`)).toEqual(["GST 5", "PST 7"]);
    expect(line.taxAmount).toBe(115); // GST 47.5¢ → 48¢ + PST 66.5¢ → 67¢, each rate rounded on its own
    expect(body.total).toBe(1065);
  });

  it("does not sell a class as a plain product, and shows no Add to cart once its only date is over", async () => {
    const { editorToken } = await import("./editor");
    const token = await editorToken(base());
    const glaze = await productId(GLAZE);
    const [date] = await list(`/sessions?${where("product", glaze)}&depth=0`);
    expect(date, "the one date of the glaze class").toBeDefined();
    // A class with dates is bought by the date, whatever the dates' state.
    expect((await validate({ lines: [{ kind: "product", id: glaze, quantity: 1 }] })).body.lines[0].error).toBe("Choose a date");
    const page = load(await (await fetch(`${base()}${GLAZE}`)).text());
    expect(page("[data-product-sessions] option[value!='']").toArray().map((o) => page(o).text().trim())).toEqual([`${date.label} — CA$199.00`]);

    const setEnd = async (endsAt: string | null) => {
      const res = await fetch(`${base()}/api/sessions/${date.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `JWT ${token}` },
        body: JSON.stringify({ endsAt }),
      });
      expect(res.status).toBe(200);
    };
    await setEnd("2020-01-01T00:00:00.000Z");
    try {
      const over = load(await (await fetch(`${base()}${GLAZE}`)).text());
      expect(over("[data-add]")).toHaveLength(0);
      expect(over("[data-no-dates]").text()).toContain("No dates scheduled");
      expect(over("[data-buy] a[data-call-studio]")).toHaveLength(1);
      expect((await validate({ lines: [{ kind: "product", id: glaze, quantity: 1 }] })).body.lines[0].error).toBe("Choose a date");
      expect((await validate({ lines: [{ kind: "session", id: date.id, quantity: 1 }] })).body.lines[0].error).toBe("This date is closed");
    } finally {
      await setEnd(date.endsAt ?? null);
    }
    expect(load(await (await fetch(`${base()}${GLAZE}`)).text())("[data-add]")).toHaveLength(1);
  });

  it("tells the browser when the price it last showed is not today's", async () => {
    const session = await openSession();
    const moved = await validate({ lines: [{ kind: "session", id: session.id, quantity: 1, seenAmount: 37100 }] });
    expect(moved.body.lines[0].unitAmount).toBe(29680);
    expect(moved.body.lines[0].priceChanged).toBe(true);
    const same = await validate({ lines: [{ kind: "session", id: session.id, quantity: 1, seenAmount: 29680 }] });
    expect(same.body.lines[0].priceChanged).toBeUndefined();
  });

  it("marks the line when more seats are asked for than are left", async () => {
    const session = await openSession();
    const { status, body } = await validate({ lines: [{ kind: "session", id: session.id, quantity: session.seats + 1 }] });
    expect(status).toBe(200);
    expect(body.lines[0].error).toBe(`Only ${session.seats} seats left`);
    // A line with an error adds nothing to the total.
    expect(body.total).toBe(0);
  });

  it("marks a line whose item is gone, and a product whose variant is not chosen", async () => {
    const pot = await productId("/product-page/hanging-plant-pot");
    const { body } = await validate({ lines: [{ kind: "product", id: 999999, quantity: 1 }, { kind: "product", id: pot, quantity: 1 }] });
    expect(body.lines[0].error).toBe("This item is no longer available");
    expect(body.lines[1].error).toBe("Choose Glaze Colour");
    const chosen = await validate({ lines: [{ kind: "product", id: pot, quantity: 1, option: "Glaze Colour: Blue bubbles" }] });
    expect(chosen.body.lines[0].error).toBeUndefined();
    expect(chosen.body.lines[0].option).toBe("Glaze Colour: Blue bubbles");
  });

  it("says so when the cart is empty, and refuses a body that is not a cart", async () => {
    expect((await validate({ lines: [] })).body.errors).toEqual(["Your cart is empty"]);
    expect((await validate({ lines: "nope" })).status).toBe(400);
    const res = await fetch(`${base()}/cart/validate`, { method: "POST", body: "not json" });
    expect(res.status).toBe(400);
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedClassDate, tempCMS, type ClassDate, type TempCMS } from "./payments-harness";

let cms: TempCMS;
let date: ClassDate;
let classTabs: typeof import("../../lib/cms/site").classTabs;

beforeAll(async () => {
  cms = await tempCMS();
  ({ classTabs } = await import("../../lib/cms/site"));
  date = await seedClassDate(cms.payload, 10);
}, 120_000);

afterAll(async () => {
  await cms?.stop();
});

const addClass = (title: string, product?: number) =>
  cms.payload.create({
    collection: "classes",
    data: { title, tab: title, studio: [date.studioId], ...(product ? { product } : {}) },
    overrideAccess: true,
    depth: 0,
  });

const bookHrefOf = async (title: string) => (await classTabs(date.studioId)).find((t) => t.title === title)?.bookHref;

describe("classTabs: Book now", () => {
  it("opens the product the class is sold as", async () => {
    await addClass("Sold as a product", date.productId);
    expect(await bookHrefOf("Sold as a product")).toBe("/test-class");
  });

  it("falls back to the studio page without a product", async () => {
    await addClass("Studio booking");
    expect(await bookHrefOf("Studio booking")).toBe("/test-studio");
  });

  it("falls back to the studio page when the product is hidden", async () => {
    const hidden = await cms.payload.create({
      collection: "products",
      data: { name: "Hidden class", path: "/hidden-class", price: 100, visible: false, taxGroup: "service" },
      overrideAccess: true,
      depth: 0,
    });
    await addClass("Hidden product", hidden.id);
    expect(await bookHrefOf("Hidden product")).toBe("/test-studio");
  });
});

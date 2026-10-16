/**
 * Which products the seed makes goods (GST + PST): exactly the products of the
 * Wix tax groups "Clay" and "Tools" (content/tax-groups.json), not the store
 * categories of the same names, which also hold gift-card and class items.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GOODS_PATHS, taxGroupOf } from "../../scripts/seed/tax-groups";

const inv = JSON.parse(readFileSync("content/inventory.json", "utf8")) as { products: { path: string; categories?: string[] }[] };

describe("seed tax groups", () => {
  it("the Wix tax groups hold 22 products, every one of them in the inventory", () => {
    expect(GOODS_PATHS.size).toBe(22);
    const paths = new Set(inv.products.map((p) => p.path));
    expect([...GOODS_PATHS].filter((p) => !paths.has(p))).toEqual([]);
  });

  it("clay and tools of the Wix groups are goods", () => {
    expect(taxGroupOf("/product-page/recycled-clay")).toBe("goods");
    expect(taxGroupOf("/product-page/apron")).toBe("goods");
    expect(taxGroupOf("/product-page/extra-workshop-pots")).toBe("goods");
  });

  it("store items filed under Clay or Tools but outside the Wix tax groups are services", () => {
    for (const path of [
      "/product-page/open-studio-drop-in",
      "/product-page/date-night-drop-in-class-if-paying-via-gift-card",
      "/product-page/gift-card-payment-for-1-in-group-of-six",
      "/product-page/private-pottery-class-for-2",
      "/product-page/coming-back-to-under-glaze-1-off-pottery-workshop-pots",
    ]) {
      expect(taxGroupOf(path), path).toBe("service");
    }
  });

  it("every other product is a service", () => {
    const services = inv.products.filter((p) => !GOODS_PATHS.has(p.path));
    expect(services.length).toBe(inv.products.length - 22);
    expect(services.every((p) => taxGroupOf(p.path) === "service")).toBe(true);
  });
});

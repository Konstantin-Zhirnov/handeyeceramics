/**
 * The tax group of a seeded product. Goods (GST and PST) are exactly the
 * products of the Wix tax groups "Clay" and "Tools" (content/tax-groups.json);
 * the store categories of the same names are not used, since they also hold
 * gift-card and class items that Wix taxes as services. Everything else is a
 * service (GST only).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const groups = JSON.parse(readFileSync(path.join(root, "content/tax-groups.json"), "utf8")) as { Clay: string[]; Tools: string[] };

export const GOODS_PATHS: ReadonlySet<string> = new Set([...groups.Clay, ...groups.Tools]);

export const taxGroupOf = (productPath: string): "goods" | "service" => (GOODS_PATHS.has(productPath) ? "goods" : "service");

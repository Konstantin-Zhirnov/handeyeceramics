/**
 * The owner reads English: everything an editor sees in the admin — names of
 * collections, globals and blocks, field labels, descriptions, select options,
 * validation messages — is in English, and so is the code of this public repo.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import config from "../../payload.config";
import { pathField } from "../../collections/fields/path";

const root = path.resolve(import.meta.dirname, "../..");
const CYRILLIC = /\p{Script=Cyrillic}/u;

/** Keys that hold a text the admin shows. */
const SHOWN = new Set(["label", "labels", "singular", "plural", "description", "group", "placeholder"]);
/** Keys under which more fields, blocks and options live. */
const NESTED = new Set(["fields", "blocks", "tabs", "options", "admin"]);

type Found = { at: string; text: string };

/** Every text the admin shows, anywhere below a collection, a global or a block. */
function shownTexts(node: unknown, at: string, shown = false, out: Found[] = []): Found[] {
  if (typeof node === "string") {
    if (shown) out.push({ at, text: node });
  } else if (Array.isArray(node)) {
    node.forEach((item, i) => shownTexts(item, `${at}[${i}]`, shown, out));
  } else if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      const where = `${at}.${key}`;
      if (shown || SHOWN.has(key)) shownTexts(value, where, true, out);
      else if (NESTED.has(key)) shownTexts(value, where, false, out);
    }
  }
  return out;
}

it("finds the labels it is meant to check", () => {
  const found = shownTexts(
    {
      labels: { singular: "Class", plural: "Classes" },
      admin: { description: "Shown under the title", group: "Site" },
      fields: [
        { name: "status", label: { en: "Status" }, options: [{ label: "New", value: "new" }] },
        { name: "blocks", blocks: [{ slug: "text", labels: { singular: "Text" }, fields: [{ name: "skipped", label: "Body" }] }] },
      ],
    },
    "x",
  ).map((f) => f.text);
  expect(found.sort()).toEqual(["Body", "Class", "Classes", "New", "Shown under the title", "Site", "Status", "Text"]);
});

it("the admin has no label or description in Cyrillic", async () => {
  const built = await config;
  const texts = [
    ...built.collections.flatMap((c) => shownTexts(c, c.slug)),
    ...built.globals.flatMap((g) => shownTexts(g, g.slug)),
    ...(built.blocks || []).flatMap((b) => shownTexts(b, b.slug)),
  ];
  // the walk reaches the collections, their fields and the blocks of pages
  expect(texts.map((t) => t.text)).toEqual(expect.arrayContaining(["Classes", "Enquiries", "Answered", "Text"]));
  expect(texts.filter((t) => CYRILLIC.test(t.text))).toEqual([]);
});

it("the messages of the page address check are in English", () => {
  const validate = pathField().validate as unknown as (value: unknown) => string | true;
  expect(validate("/about")).toBe(true);
  for (const wrong of ["", "https://example.com/about", "about", "/about us"]) {
    const message = validate(wrong);
    expect(typeof message, wrong).toBe("string");
    expect(message, wrong).not.toMatch(CYRILLIC);
  }
});

function sources(dir: string): string[] {
  return readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => {
    const file = `${dir}/${e.name}`;
    if (e.isDirectory()) return sources(file);
    return /\.(ts|tsx|js|mjs|css)$/.test(e.name) ? [file] : [];
  });
}

it("the code of the site, the seed and the how-to recorder has no Cyrillic", () => {
  const files = [
    "payload.config.ts",
    ...["collections", "globals", "components", "app", "lib", "scripts/seed", "scripts/howto", "tests"].flatMap(sources),
  ];
  expect(files.length).toBeGreaterThan(40);
  const lines = files.flatMap((file) =>
    readFileSync(path.join(root, file), "utf8")
      .split("\n")
      .flatMap((line, i) => (CYRILLIC.test(line) ? [`${file}:${i + 1}`] : [])),
  );
  expect(lines).toEqual([]);
});

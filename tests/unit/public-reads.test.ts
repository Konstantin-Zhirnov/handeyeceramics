/**
 * The public site reads the CMS as a visitor: every read in the code of the
 * site passes `overrideAccess: false`, so that the access rules of the
 * collections (published studios and pages, visible products, classes of
 * published studios) are the one place that decides what a visitor sees.
 * No read filters by `published` / `visible` by hand.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");
const DIRS = ["lib/cms", "components", "app/(site)"];

function files(dir: string): string[] {
  return readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(`${dir}/${e.name}`) : /\.tsx?$/.test(e.name) ? [`${dir}/${e.name}`] : [],
  );
}

/** The text of every `payload.find…({ … })` call: from the call to its closing brace. */
function reads(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\.find(?:ByID|Global)?\(\{/g)) {
    let depth = 0;
    let i = m.index! + m[0].length - 1;
    for (; i < text.length; i++) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}" && --depth === 0) break;
    }
    out.push(text.slice(m.index!, i + 1));
  }
  return out;
}

it("every read of the CMS by the public site goes through the access rules", () => {
  const all = DIRS.flatMap(files);
  let count = 0;
  for (const file of all) {
    for (const call of reads(readFileSync(path.join(root, file), "utf8"))) {
      count++;
      expect(call, file).toMatch(/overrideAccess: false/);
    }
  }
  expect(count).toBeGreaterThan(5);
});

it("no read filters published or hidden documents by hand", () => {
  for (const file of DIRS.flatMap(files)) {
    expect(readFileSync(path.join(root, file), "utf8"), file).not.toMatch(/\b(published|visible): \{ ?(not_)?equals/);
  }
});

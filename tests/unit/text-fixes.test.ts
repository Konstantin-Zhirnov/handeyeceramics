/**
 * The run-on lines of the old site are set as headings and lists with nothing
 * lost: every fix answers to a paragraph the inventory really has, and every
 * figure of the old line — group sizes, prices, hours — is in the new lines.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FIXED_PATHS, textFix, textFixLines, textFixNodes, textFixes } from "../../scripts/seed/text-fixes";

const root = path.resolve(import.meta.dirname, "../..");
const inv = JSON.parse(readFileSync(path.join(root, "content/inventory.json"), "utf8"));
type Block = { type: string; text?: string };
const squash = (s: string) => s.replace(/\s+/g, " ").trim();
const figures = (s: string) => s.match(/\$?\d+(?:\.\d+)?/g) || [];

describe("textFixes", () => {
  for (const p of FIXED_PATHS) {
    const page = inv.pages.find((r: { path: string }) => r.path === p);
    const paragraphs = new Set((page.blocks as Block[]).filter((b) => b.type === "paragraph").map((b) => squash(b.text || "")));

    describe(p, () => {
      for (const [line, fix] of Object.entries(textFixes(p))) {
        it(`rewrites a paragraph of the page: ${line.slice(0, 40)}…`, () => {
          expect(paragraphs.has(line)).toBe(true);
          expect(textFix(p, `  ${line.replace(/ /g, "  ")}  `)).toBe(fix);
        });

        it(`keeps every figure of: ${line.slice(0, 40)}…`, () => {
          const kept = textFixLines(fix).join(" ");
          for (const f of figures(line.replace(/(\d)-(\d)/g, "$1 $2"))) expect(kept).toContain(f);
        });

        it(`sets it as a small heading and a list: ${line.slice(0, 40)}…`, () => {
          const nodes = textFixNodes(fix);
          expect(nodes.map((n) => n.type)).toEqual([...(fix.heading ? ["heading"] : []), ...(fix.items.length ? ["list"] : [])]);
          const heading = nodes.find((n) => n.type === "heading");
          if (heading) expect(heading.tag).toBe("h3");
        });
      }
    });
  }

  it("has nothing for a line it does not know", () => {
    expect(textFix("/team-building-special-events", "Book Now")).toBeUndefined();
    expect(textFix("/contact-us", "If Hand Building Mugs")).toBeUndefined();
  });
});

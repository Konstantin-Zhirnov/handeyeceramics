/**
 * The home page says each thing once. The old home page's testimonial and its
 * membership line have a section of their own in the new design; the seed
 * moves their words there, verbatim, and leaves them out of the page's blocks.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { homeMoves } from "../../scripts/seed/home-moves";

const root = path.resolve(import.meta.dirname, "../..");
const inv = JSON.parse(readFileSync(path.join(root, "content/inventory.json"), "utf8"));
const home = inv.pages.find((r: { path: string }) => r.path === "/");

describe("homeMoves", () => {
  const moves = homeMoves(home.blocks);

  it("takes the testimonial for the reviews section, word for word", () => {
    expect(moves.review?.author).toBe("Courtney P.");
    expect(moves.review?.quote).toMatch(/^I recently finished a 6 week beginners\/introductory wheel throwing pottery course/);
    // The curly apostrophe of the old page stays: the inventory test looks for the text as it was.
    expect(moves.review?.quote).toContain("I’m really looking forward");
  });

  it("takes the membership line for the membership section, the lines Wix split joined by a space", () => {
    expect(moves.membership).toBe(
      "Unlock creative potential with a Studio access Membership with no time limits and flexible days to come use studio as low as $145 monthly",
    );
  });

  it("leaves out of the page the blocks it moved and the button under the H1 (the hero has its own)", () => {
    const skipped = [...moves.skip].sort((a, b) => a - b).map((i) => home.blocks[i].text);
    expect(skipped).toEqual([
      "See Classes",
      "Unlock",
      "creative potential with a",
      "Studio access",
      "Membership",
      "with no time limits and flexible days to come use studio",
      "as low as $145 monthly",
      "Learn More",
      "We have 3 locations",
      expect.stringMatching(/^739 gore Ave 2nd floor/),
      "322 E 5th Ave, Mt Pleasant, Vancouver Pleasant pottery, our sister studio",
      expect.stringMatching(/^If you have taken a few classes/),
      expect.stringMatching(/^3168 Uplands Drive, Nanaimo/),
      "6 pm 6 wk classes, Date Nights, Youth Classes and private party bookings held here.",
      "If booking a private class we will assign you a location depending on availability and space",
      "★★★★★",
      expect.stringMatching(/^I recently finished/),
      "Courtney P.",
    ]);
  });

  it("drops the locations paragraphs from the home page altogether and keeps the mission line", () => {
    const dropped = [...moves.dropped].sort((a, b) => a - b).map((i) => home.blocks[i].text);
    expect(dropped[0]).toBe("We have 3 locations");
    expect(dropped).toHaveLength(7);
    expect(dropped.some((t) => /^We.re here to help/.test(t))).toBe(false);
    // Moved, not dropped: the words of the testimonial and the membership line stay on the page.
    expect(moves.dropped.has([...moves.skip].find((i) => home.blocks[i].text === "Courtney P.")!)).toBe(false);
  });

  it("moves nothing from a page without these blocks", () => {
    const other = homeMoves([{ type: "heading", level: 1, text: "Shop" }, { type: "paragraph", text: "Aprons and tools." }]);
    expect(other.review).toBeUndefined();
    expect(other.membership).toBeUndefined();
    expect(other.skip.size).toBe(0);
    expect(other.dropped.size).toBe(0);
  });
});

/**
 * The home page says each thing once. The old home page's testimonial and its
 * membership line have a section of their own in the new design; the seed
 * moves their words there, verbatim, and leaves them out of the page's blocks.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { homeMoves, INTERMEDIATE_PHOTO } from "../../scripts/seed/home-moves";

const root = path.resolve(import.meta.dirname, "../..");
const inv = JSON.parse(readFileSync(path.join(root, "content/inventory.json"), "utf8"));
const home = inv.pages.find((r: { path: string }) => r.path === "/");

describe("homeMoves", () => {
  const moves = homeMoves(home.blocks);

  it("swaps the photo above the Intermediate label, a double of the gallery's, for one from the page the label leads to", () => {
    const [index, photo] = [...moves.swaps.entries()][0];
    expect(home.blocks[index].type).toBe("image");
    expect(home.blocks[index + 1].text).toBe("Intermediate");
    expect(photo).toBe(INTERMEDIATE_PHOTO);
    const replacement = inv.images.find((img: { src: string }) => img.src.includes(photo));
    expect(replacement.usedOn).toContain(home.blocks[index + 1].href);
  });

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
      "Beginner Intermediate",
      "★★★★★",
      expect.stringMatching(/^I recently finished/),
      "Courtney P.",
    ]);
  });

  it("drops the locations paragraphs from the home page altogether and keeps the mission line", () => {
    const dropped = [...moves.dropped].sort((a, b) => a - b).map((i) => home.blocks[i].text);
    expect(dropped[0]).toBe("We have 3 locations");
    expect(dropped).toHaveLength(8);
    expect(dropped).toContain("Beginner Intermediate");
    expect(dropped.some((t) => /^We.re here to help/.test(t))).toBe(false);
    // Moved, not dropped: the words of the testimonial and the membership line stay on the page.
    expect(moves.dropped.has([...moves.skip].find((i) => home.blocks[i].text === "Courtney P.")!)).toBe(false);
  });

  it("turns the GALLERY label into a link to the gallery page and keeps the class photo labels", () => {
    const [index, href] = [...moves.links.entries()][0];
    expect(home.blocks[index].text).toBe("GALLERY");
    expect(href).toBe("/gallery");
    expect(moves.skip.has(index)).toBe(false);
    const kept = home.blocks.filter((b: { text?: string }, i: number) => !moves.skip.has(i)).map((b: { text?: string }) => b.text);
    expect(kept).toContain("Beginner");
    expect(kept).toContain("Intermediate");
  });

  it("moves nothing from a page without these blocks", () => {
    const other = homeMoves([{ type: "heading", level: 1, text: "Shop" }, { type: "paragraph", text: "Aprons and tools." }]);
    expect(other.review).toBeUndefined();
    expect(other.membership).toBeUndefined();
    expect(other.skip.size).toBe(0);
    expect(other.dropped.size).toBe(0);
    expect(other.links.size).toBe(0);
  });
});

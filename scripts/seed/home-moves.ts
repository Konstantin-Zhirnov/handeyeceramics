/**
 * The old home page said things the new home page has a section for: the
 * testimonial (the reviews section), the membership line (the membership
 * section) and the "See Classes" button under the H1 (the hero's call to
 * action). Carried over twice they read as duplicates, so the seed moves their
 * words into those sections, verbatim, and leaves the blocks out of the page.
 * The "We have 3 locations" paragraphs and the heading that repeats the labels
 * of the class photos are left out altogether (decisions of 2026-10-06): the
 * studios have their cards, pages and timetables, the labels are links already.
 * The "GALLERY" label becomes the link to the gallery page it was on Wix.
 * The one rule, shared by the seed and tests/unit/home-moves.test.ts.
 */
export type HomeBlock = { type: string; text?: string; level?: number; href?: string };

/** Where the old home page's "GALLERY" label pointed: the gallery page. */
export const GALLERY_PATH = "/gallery";

export type HomeMoves = {
  /** Indices of the inventory blocks that are not blocks of the page any more. */
  skip: Set<number>;
  /**
   * Of those, the ones whose words are not on the home page at all: the old
   * "We have 3 locations" paragraphs. The studios' addresses stand in the
   * locations section and on the studio pages; the class times they listed
   * are the studios' timetables. tests/site/inventory.test.ts does not look
   * for these on the home page.
   */
  dropped: Set<number>;
  /** Blocks that become a link paragraph: the "GALLERY" label, a link to the gallery page as it was on Wix. */
  links: Map<number, string>;
  /** The testimonial: the paragraph after the stars and the name after it. */
  review?: { quote: string; author: string };
  /** The membership pitch, the lines Wix split joined by a space. */
  membership?: string;
};

const STARS = /^★+$/;
const text = (b: HomeBlock | undefined) => (b?.text || "").trim();

export function homeMoves(blocks: HomeBlock[]): HomeMoves {
  const moves: HomeMoves = { skip: new Set(), dropped: new Set(), links: new Map() };

  // The button right under the H1: the hero keeps the H1 and has its own button.
  const h1 = blocks.findIndex((b) => b.type === "heading" && b.level === 1);
  if (h1 >= 0 && blocks[h1 + 1]?.type === "button" && /^see classes$/i.test(text(blocks[h1 + 1]))) moves.skip.add(h1 + 1);

  // The membership pitch: the run of paragraphs from "Unlock" to "Learn More".
  const unlock = blocks.findIndex((b) => b.type === "paragraph" && text(b) === "Unlock");
  if (unlock >= 0) {
    const lines: string[] = [];
    for (let i = unlock; i < blocks.length && blocks[i].type === "paragraph"; i++) {
      moves.skip.add(i);
      if (/^learn more$/i.test(text(blocks[i]))) break;
      lines.push(text(blocks[i]));
    }
    moves.membership = lines.join(" ");
  }

  // The locations: "We have 3 locations" and the paragraphs after it, up to the studio's mission line ("We're here to help…").
  const locations = blocks.findIndex((b) => b.type === "paragraph" && /^We have \d+ locations$/i.test(text(b)));
  if (locations >= 0) {
    for (let i = locations; i < blocks.length && blocks[i].type === "paragraph" && !/^We.re here/i.test(text(blocks[i])); i++) {
      moves.skip.add(i);
      moves.dropped.add(i);
    }
  }

  // Wix printed the labels of the two class photos ("Beginner", "Intermediate") once more as one heading.
  // The heading goes; the labels stay as the links they are.
  blocks.forEach((b, i) => {
    if (b.type !== "heading" || (b.level ?? 0) < 2) return;
    const labels = blocks.slice(Math.max(0, i - 3), i + 4).filter((n) => n.type === "button" && n.href).map(text);
    if (labels.length >= 2 && labels.join(" ") === text(b)) {
      moves.skip.add(i);
      moves.dropped.add(i);
    }
  });

  // The "GALLERY" label: on Wix it led to the gallery page; the crawl kept the word, not the link.
  const gallery = blocks.findIndex((b) => b.type === "heading" && /^gallery$/i.test(text(b)));
  if (gallery >= 0) moves.links.set(gallery, GALLERY_PATH);

  // The testimonial: stars, the quote, the name.
  const stars = blocks.findIndex((b) => b.type === "heading" && STARS.test(text(b)));
  if (stars >= 0 && blocks[stars + 1]?.type === "paragraph" && blocks[stars + 2]?.type === "paragraph") {
    moves.review = { quote: text(blocks[stars + 1]), author: text(blocks[stars + 2]) };
    for (const i of [stars, stars + 1, stars + 2]) moves.skip.add(i);
  }

  return moves;
}

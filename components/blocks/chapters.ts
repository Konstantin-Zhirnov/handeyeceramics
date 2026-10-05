import type { Page } from "@/payload-types";

export type PageBlock = NonNullable<Page["blocks"]>[number];
type Of<T extends PageBlock["blockType"]> = Extract<PageBlock, { blockType: T }>;
export type TextBlock = Of<"text">;
export type PictureBlock = Of<"image"> | Of<"video">;
export type GalleryBlock = Of<"gallery">;
export type OtherBlock = Exclude<PageBlock, TextBlock | PictureBlock | GalleryBlock>;

export type LexNode = { type?: string; text?: string; children?: LexNode[] };

/** A text block, or a part of one: what a chapter prints in one place. */
export type Passage = { key: string; heading?: string | null; body: TextBlock["body"] };

/**
 * How a run of blocks is laid out. The old site put a picture first and its
 * words under it, so a picture or a gallery opens a chapter and the text
 * blocks after it belong to it:
 *  - `spread`  — a picture beside a column of text;
 *  - `poster`  — a picture beside a few words, set large;
 *  - `plates`  — two or more pictures in a row, each with a few words: a grid of captioned cards;
 *  - `figure`  — a picture with no words;
 *  - `gallery` — a gallery with the text that follows it;
 *  - `text`    — text with no picture before it;
 *  - `block`   — a form or a list, on its own.
 * `lead` is what stood right before the picture and introduces it: a call to
 * action on a line of its own, or the heading the previous text ended on.
 */
export type Chapter =
  | { kind: "text"; texts: Passage[] }
  | { kind: "spread" | "poster" | "figure"; media: PictureBlock; lead: Passage[]; texts: Passage[] }
  | { kind: "plates"; lead: Passage[]; items: { media: PictureBlock; texts: Passage[] }[] }
  | { kind: "gallery"; media: GalleryBlock; lead: Passage[]; texts: Passage[] }
  | { kind: "block"; block: OtherBlock };

/** Up to this many characters a caption is "a few words". */
export const FEW_WORDS = 60;
/** An opening paragraph this short is set as a lead-in. */
const LEAD_IN = 160;

const plain = (n: LexNode | undefined): string =>
  !n ? "" : typeof n.text === "string" ? n.text : (n.children || []).map(plain).join("");

const filled = (n: LexNode) => plain(n).trim().length > 0;

const nodesOf = (p: Passage) => ((p.body as { root?: LexNode } | null | undefined)?.root?.children || []) as LexNode[];

const isLink = (n: LexNode) => n.type === "link" || n.type === "autolink";

/** A paragraph that is nothing but a link, such as "See Classes" or "Book Now": a call to action. */
export function linkOnly(n: LexNode): boolean {
  if (n.type !== "paragraph") return false;
  const kids = n.children || [];
  return kids.some(isLink) && kids.every((k) => isLink(k) || !plain(k).trim());
}

/** A passage that holds calls to action and nothing else. */
const actionsOnly = (p: Passage) => {
  const nodes = nodesOf(p).filter(filled);
  return !p.heading && nodes.length > 0 && nodes.every(linkOnly);
};

/** The number of characters a reader sees in these passages. */
export const lengthOf = (texts: Passage[]) =>
  texts.reduce((sum, p) => sum + (p.heading || "").trim().length + nodesOf(p).reduce((s, n) => s + plain(n).trim().length, 0), 0);

/** True when the passages open with a short paragraph and go on after it: that paragraph reads as a lead-in. */
export function hasLeadIn(texts: Passage[]): boolean {
  const first = texts.find((p) => !actionsOnly(p));
  if (!first || first.heading) return false;
  const nodes = nodesOf(first).filter(filled);
  const length = plain(nodes[0]).trim().length;
  return nodes.length > 1 && nodes[0].type === "paragraph" && !linkOnly(nodes[0]) && length >= 20 && length <= LEAD_IN;
}

const isPicture = (b: PageBlock): b is PictureBlock => b.blockType === "image" || b.blockType === "video";
const isGallery = (b: PageBlock): b is GalleryBlock => b.blockType === "gallery";

const passage = (b: TextBlock, index: number): Passage => ({ key: b.id || `text-${index}`, heading: b.heading, body: b.body });

/** The nodes `from`…`to` of a passage, as a passage of their own. */
function part(p: Passage, from: number, to: number, suffix: string): Passage {
  const body = p.body as (TextBlock["body"] & { root: { children: unknown[] } }) | null | undefined;
  return {
    key: p.key + suffix,
    heading: from === 0 ? p.heading : null,
    body: body ? ({ ...body, root: { ...body.root, children: nodesOf(p).slice(from, to) } } as TextBlock["body"]) : body,
  };
}

/** A paragraph of a word or two with no sentence in it: a label, not a line of text. */
const isLabel = (n: LexNode) => {
  const words = plain(n).trim();
  return n.type === "paragraph" && !linkOnly(n) && words.length > 0 && words.length <= 24 && !/[.!?:,)]$/.test(words);
};

type Draft = { media?: PictureBlock | GalleryBlock; lead: Passage[]; texts: Passage[]; block?: OtherBlock };

/**
 * A text that ends on a heading right before a picture has run on into the
 * next subject: on the old site that heading stood over the picture. It moves
 * to the lead of the chapter the picture opens, provided the text it leaves
 * still says something.
 */
function passHeadingsOn(from: Draft, to: Draft) {
  const last = from.texts[from.texts.length - 1];
  if (!last) return;
  const nodes = nodesOf(last);
  let cut = nodes.length;
  while (cut > 0 && (nodes[cut - 1].type === "heading" || !filled(nodes[cut - 1]))) cut--;
  if (!nodes.slice(cut).some((n) => n.type === "heading")) return;
  // A bare label right above that heading ("Gallery" over "Instructor Work") is part of the same title.
  while (cut > 1 && isLabel(nodes[cut - 1])) cut--;
  const kept = part(last, 0, cut, "");
  // A heading over nothing but a call to action is that link's own title: the two stay together.
  const keepsWords = [...from.texts.slice(0, -1), kept].some((p) => lengthOf([p]) > 0 && !actionsOnly(p));
  if (!keepsWords) return;
  to.lead.unshift(part(last, cut, nodes.length, "-lead"));
  if (lengthOf([kept]) > 0) from.texts[from.texts.length - 1] = kept;
  else from.texts.pop();
}

/** Groups the blocks of a page into chapters, keeping their order. */
export function chapters(blocks: PageBlock[]): Chapter[] {
  const drafts: Draft[] = [];
  // A call to action that stands right before a picture introduces the chapter that picture opens.
  let lead: Passage[] = [];

  blocks.forEach((b, i) => {
    const last = drafts[drafts.length - 1];
    if (isPicture(b) || isGallery(b)) {
      drafts.push({ media: b, lead, texts: [] });
      lead = [];
    } else if (b.blockType === "text") {
      const next = blocks[i + 1];
      const p = passage(b, i);
      if (actionsOnly(p) && next && (isPicture(next) || isGallery(next)) && !(last?.media && !last.texts.length)) lead.push(p);
      else if (last && !last.block) last.texts.push(p);
      else drafts.push({ lead: [], texts: [p] });
    } else {
      drafts.push({ lead: [], texts: [], block: b as OtherBlock });
    }
  });

  drafts.forEach((d, i) => {
    const next = drafts[i + 1];
    if (!d.block && next?.media) passHeadingsOn(d, next);
  });

  const out: Chapter[] = [];
  for (const d of drafts) {
    if (d.block) out.push({ kind: "block", block: d.block });
    else if (!d.media) {
      if (d.texts.length) out.push({ kind: "text", texts: d.texts });
    } else if (isGallery(d.media)) out.push({ kind: "gallery", media: d.media, lead: d.lead, texts: d.texts });
    else if (!d.texts.length) out.push({ kind: "figure", media: d.media, lead: d.lead, texts: [] });
    else if (lengthOf(d.texts) > FEW_WORDS) out.push({ kind: "spread", media: d.media, lead: d.lead, texts: d.texts });
    else {
      const item = { media: d.media, texts: d.texts };
      const prev = out[out.length - 1];
      // A picture with an introduction of its own starts a new row.
      if (prev?.kind === "plates" && !d.lead.length) prev.items.push(item);
      else if (prev?.kind === "poster" && !d.lead.length) out[out.length - 1] = { kind: "plates", lead: prev.lead, items: [{ media: prev.media, texts: prev.texts }, item] };
      else out.push({ kind: "poster", lead: d.lead, ...item });
    }
  }
  return out;
}

/** Plain-text helpers shared by the seed and the SEO metadata. */
import { serverURL } from "../server-url";

export const SITE_NAME = "Hand Eye Ceramics";
export const SITE_SUFFIX = ` | ${SITE_NAME}`;
/** The address the site is served from: NEXT_PUBLIC_SERVER_URL, required in production (lib/server-url.ts). */
export const SITE_URL = serverURL();

export const squash = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Story 8: an empty description becomes the first ~155 characters of the
 * page's own text, cut at a word boundary. The text itself is not changed.
 */
export function excerpt(text: string, max = 155): string {
  const t = squash(text);
  if (t.length <= max) return t;
  const cut = t.slice(0, max + 1);
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.6 ? cut.slice(0, space) : t.slice(0, max)).replace(/[\s,;:–—-]+$/, "");
}

type LexNode = { type?: string; text?: string; children?: LexNode[] };

/** Text of a Lexical rich-text value, blocks separated by spaces. */
export function lexicalText(value: unknown): string {
  const out: string[] = [];
  const walk = (n: LexNode | undefined) => {
    if (!n) return;
    if (typeof n.text === "string") out.push(n.text);
    n.children?.forEach(walk);
  };
  walk((value as { root?: LexNode } | null)?.root);
  return squash(out.join(" "));
}

/** Formats a price the way the Wix store printed it: CA$20.00 */
export const formatPrice = (n: number | null | undefined) =>
  typeof n === "number" ? `CA$${n.toFixed(2)}` : "";

/**
 * Wix markup litter: what the crawl picked up from the old pages that is not
 * their text. The one rule, shared by the seed (it skips these blocks) and by
 * tests/site/inventory.test.ts (it does not expect them on the new pages).
 */
export type LitterBlock = { type: string; text?: string; alt?: string };

/** Social network icons: a picture whose alt is only the network's name. */
const SOCIAL = /^(instagram|facebook|tiktok|youtube|twitter|x|pinterest|linkedin)$/i;

export function isWixLitter(b: LitterBlock): boolean {
  const t = (b.text || "").trim();
  if (b.type === "image") return SOCIAL.test((b.alt || "").trim());
  // Wix's invisible scroll anchors ("Anchor 1") and slideshow counters ("1 / 3").
  if (/^Anchor \d+$/.test(t)) return true;
  if (/^\d+ \/ \d+$/.test(t)) return true;
  return false;
}

const BRIDGE = /\s(a|an|the|with|of|and|or|to|for|in|on|at|by|from|your|our)$/i;
/** A line that opens on one of these, in lower case, carries on the sentence before it. */
const CARRIES_ON = /^(and|or|but|as|with|without|to|of|for|in|on|at|by|from|than|is|are|was|which|that)[\s/]/;

/**
 * Wix splits one line of a text box into paragraphs where its editor wrapped
 * it. A paragraph continues the previous one only when the sentence is clearly
 * broken: the previous one stops on an article, preposition or conjunction, or
 * is a single word, and the next one goes on in lower case — or the next one
 * opens on a lower-case conjunction or preposition. Never after closing
 * punctuation (.!?:; or a bracket): separate lines on Wix stay separate.
 */
export function continuesLine(previous: string, next: string): boolean {
  const prev = previous.trim();
  const cur = next.trim();
  if (!prev || !cur || /[.!?:;)\]=]$/.test(prev)) return false;
  if (BRIDGE.test(prev)) return true;
  if (CARRIES_ON.test(cur)) return true;
  return !/\s/.test(prev) && /^[a-z]/.test(cur);
}

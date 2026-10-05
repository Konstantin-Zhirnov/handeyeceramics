import { describe, expect, it } from "vitest";
import { chapters, hasLeadIn, lengthOf, linkOnly, type Chapter, type LexNode, type PageBlock, type Passage } from "../../components/blocks/chapters";

// Blocks written by hand, the way the editor stores them.
const p = (text: string) => ({ type: "paragraph", children: [{ type: "text", text }] });
const link = (text: string) => ({ type: "paragraph", children: [{ type: "link", children: [{ type: "text", text }] }] });
const h = (text: string) => ({ type: "heading", tag: "h2", children: [{ type: "text", text }] });
const text = (...children: object[]) => ({ blockType: "text", body: { root: { children } } }) as unknown as PageBlock;
const image = () => ({ blockType: "image", image: 1 }) as unknown as PageBlock;
const gallery = () => ({ blockType: "gallery", images: [1, 2] }) as unknown as PageBlock;
const form = () => ({ blockType: "form", formType: "contact" }) as unknown as PageBlock;
const passages = (...blocks: PageBlock[]) => blocks.map((b, i) => ({ key: `t${i}`, heading: (b as { heading?: string }).heading, body: (b as { body: unknown }).body })) as Passage[];

const LONG = "Perfect for beginners who want to try just one pottery class, with every tool provided.";
const kinds = (blocks: PageBlock[]) => chapters(blocks).map((c) => c.kind);

/** Every word a list of passages prints, in order. */
const words = (list: Passage[]) => {
  const plain = (n: LexNode): string => (typeof n.text === "string" ? n.text : (n.children || []).map(plain).join(""));
  return list.flatMap((x) => (((x.body as { root?: LexNode } | null)?.root?.children || []) as LexNode[]).map(plain));
};
const wordsOf = (c: Chapter): string[] =>
  c.kind === "block" ? [] : c.kind === "text" ? words(c.texts) : c.kind === "plates" ? [...words(c.lead), ...c.items.flatMap((i) => words(i.texts))] : [...words(c.lead), ...words(c.texts)];

describe("linkOnly", () => {
  it("is true for a paragraph that holds a link and nothing else", () => {
    expect(linkOnly(link("See Classes"))).toBe(true);
    expect(linkOnly(p("See Classes"))).toBe(false);
    expect(linkOnly({ type: "paragraph", children: [{ type: "text", text: "Read " }, ...link("more").children] })).toBe(false);
    expect(linkOnly(h("See Classes"))).toBe(false);
  });
});

describe("chapters", () => {
  it("gives a picture the text that follows it", () => {
    const out = chapters([image(), text(h("Drop In"), p(LONG)), image(), text(p(LONG))]);
    expect(out.map((c) => c.kind)).toEqual(["spread", "spread"]);
    expect(out.every((c) => c.kind === "spread" && c.texts.length === 1)).toBe(true);
  });

  it("keeps text with no picture before it as a chapter of its own", () => {
    expect(kinds([text(p(LONG)), text(p(LONG)), image(), text(p(LONG))])).toEqual(["text", "spread"]);
  });

  it("lets a call to action before a picture introduce that picture's chapter", () => {
    const out = chapters([text(link("See Classes")), image(), text(p(LONG))]);
    expect(out).toHaveLength(1);
    expect(out[0].kind === "spread" && [words(out[0].lead), words(out[0].texts)]).toEqual([["See Classes"], [LONG]]);
  });

  it("leaves a call to action in place when no picture follows it", () => {
    expect(kinds([text(link("See Classes")), form()])).toEqual(["text", "block"]);
  });

  it("sets a picture with a few words as a poster, and a row of them as plates", () => {
    expect(kinds([image(), text(h("Get your hands dirty"))])).toEqual(["poster"]);
    const out = chapters([image(), text(p("Ada")), image(), text(p("Ben")), image(), text(p("Cy")), image(), text(p(LONG))]);
    expect(out.map((c) => c.kind)).toEqual(["plates", "spread"]);
    expect(out[0].kind === "plates" && out[0].items).toHaveLength(3);
  });

  it("keeps a picture with no words, a gallery and a form apart", () => {
    expect(kinds([image(), image(), gallery(), text(p(LONG)), form(), text(p(LONG))])).toEqual(["figure", "figure", "gallery", "block", "text"]);
  });

  it("moves the heading a text ends on to the picture that follows it", () => {
    const out = chapters([image(), text(p("Ada")), image(), text(p("Ben"), h("Gallery"), h("Instructor Work")), gallery(), text(p(LONG))]);
    expect(out.map((c) => c.kind)).toEqual(["plates", "gallery"]);
    expect(out[0].kind === "plates" && out[0].items.map((i) => words(i.texts))).toEqual([["Ada"], ["Ben"]]);
    expect(out[1].kind === "gallery" && words(out[1].lead)).toEqual(["Gallery", "Instructor Work"]);
  });

  it("takes a bare label above that heading along with it, and leaves the caption its name", () => {
    const out = chapters([image(), text(p("Ada (She/Her)")), image(), text(p("Hunter (He/Him)"), p("Gallery"), h("Instructor Work")), gallery()]);
    expect(out[0].kind === "plates" && out[0].items.map((i) => words(i.texts))).toEqual([["Ada (She/Her)"], ["Hunter (He/Him)"]]);
    expect(out[1].kind === "gallery" && words(out[1].lead)).toEqual(["Gallery", "Instructor Work"]);
    // A sentence above a heading stays where it is.
    const kept = chapters([image(), text(p(LONG), p("Open to all."), h("Studio")), gallery()]);
    expect(kept[0].kind === "spread" && words(kept[0].texts)).toEqual([LONG, "Open to all."]);
  });

  it("leaves a heading where it is when it is all a picture has, or titles a call to action", () => {
    const poster = chapters([image(), text(h("Get your hands dirty")), gallery()]);
    expect(poster[0].kind === "poster" && words(poster[0].texts)).toEqual(["Get your hands dirty"]);
    const titled = chapters([image(), text(link("Beginner"), h("Beginner Intermediate")), image(), text(p(LONG))]);
    expect(titled[0].kind === "poster" && words(titled[0].texts)).toEqual(["Beginner", "Beginner Intermediate"]);
    expect(titled[1].kind === "spread" && titled[1].lead).toEqual([]);
  });

  it("prints every word once, in the order of the blocks", () => {
    const blocks = [text(link("Go")), image(), text(p(LONG), h("Studio")), gallery(), text(h("Classes"), p("Bye")), form(), text(p("End"))];
    expect(chapters(blocks).flatMap(wordsOf)).toEqual(["Go", LONG, "Studio", "Classes", "Bye", "End"]);
  });
});

describe("lengthOf and hasLeadIn", () => {
  it("counts the heading and the body", () => {
    expect(lengthOf([{ ...passages(text(p("abc")))[0], heading: "de" }])).toBe(5);
  });

  it("finds a short opening paragraph that the text goes on after", () => {
    expect(hasLeadIn(passages(text(p("Unlock creative potential with a Studio access"), p(LONG))))).toBe(true);
    expect(hasLeadIn(passages(text(link("See Classes")), text(p("Unlock creative potential with a Studio access"), p(LONG))))).toBe(true);
    expect(hasLeadIn(passages(text(p("Unlock creative potential with a Studio access"))))).toBe(false);
    expect(hasLeadIn(passages(text(h("Drop In"), p(LONG))))).toBe(false);
    expect(hasLeadIn(passages(text(p(LONG.repeat(3)), p(LONG))))).toBe(false);
  });
});

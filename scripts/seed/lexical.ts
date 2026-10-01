/** Minimal Lexical (Payload rich text) node builders for the seed. */
export type Node = Record<string, unknown>;

const base = { format: "", indent: 0, version: 1, direction: "ltr" as const };
const text = (t: string): Node => ({ type: "text", text: t, format: 0, detail: 0, mode: "normal", style: "", version: 1 });

export const paragraph = (t: string): Node => ({ ...base, type: "paragraph", textFormat: 0, textStyle: "", children: [text(t)] });

export const heading = (t: string, level: number): Node => ({ ...base, type: "heading", tag: `h${level}`, children: [text(t)] });

export const list = (items: string[]): Node => ({
  ...base,
  type: "list",
  listType: "bullet",
  tag: "ul",
  start: 1,
  children: items.map((t, i) => ({ ...base, type: "listitem", value: i + 1, children: [text(t)] })),
});

export const linkParagraph = (t: string, url: string): Node => ({
  ...base,
  type: "paragraph",
  textFormat: 0,
  textStyle: "",
  children: [
    {
      ...base,
      type: "link",
      version: 3,
      fields: { url, newTab: /^https?:/.test(url), linkType: "custom" },
      children: [text(t)],
    },
  ],
});

export const root = (children: Node[]) => ({ root: { ...base, type: "root", children } });

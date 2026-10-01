/**
 * What the seed may claim about the studios. Read through the public API of
 * the seeded site; expectations are written by hand from lib/site.ts.
 */
import { beforeAll, describe, expect, inject, it } from "vitest";

type Studio = { id: number; path: string; phone?: string | null };
type Class = { title: string; studio?: Studio[] | null };

const MT_PLEASANT = "/classes/vancouver-mount-pleasant";
let classes: Class[] = [];
let studios: Studio[] = [];

beforeAll(async () => {
  const get = async (what: string) => (await (await fetch(`${inject("baseURL")}/api/${what}?limit=0&pagination=false&depth=1`)).json()).docs;
  classes = await get("classes");
  studios = await get("studios");
});

const studioPaths = (title: string) => {
  const found = classes.find((c) => c.title === title);
  expect(found, `class "${title}"`).toBeDefined();
  return (found!.studio || []).map((s) => s.path).sort();
};

describe("seeded classes and studios", () => {
  it("lists the six-week wheel course only where a studio's schedule has it", () => {
    // Six-week courses: Chinatown and Nanaimo. Mt Pleasant is members' studio space.
    expect(studioPaths("6-week beginner & intermediate course")).toEqual(["/classes/vancouver-chinatown", "/nanaimo-pottery-classes"]);
  });

  it("lists date night and hand building where the schedules have them", () => {
    expect(studioPaths("Pottery date night for two")).toEqual(["/classes/vancouver-chinatown", "/nanaimo-pottery-classes"]);
    expect(studioPaths("Friday & Saturday drop-in")).toEqual(["/classes/vancouver-chinatown"]);
  });

  it("attaches no class to Mt Pleasant", () => {
    const there = classes.filter((c) => c.studio?.some((s) => s.path === MT_PLEASANT)).map((c) => c.title);
    expect(there).toEqual([]);
  });

  it("does not turn membership and opening notes into classes", () => {
    const wrong = classes.map((c) => c.title).filter((t) => /^(membership|member access|opening)\b/i.test(t));
    expect(wrong).toEqual([]);
  });

  it("gives a studio a phone only when a source lists one for it", () => {
    const phone = (p: string) => studios.find((s) => s.path === p)?.phone || "";
    expect(studios).toHaveLength(4);
    expect(phone("/classes/calgary")).toBe("");
    expect(phone(MT_PLEASANT)).toBe("");
    expect(phone("/nanaimo-pottery-classes")).toBe("");
    expect(phone("/classes/vancouver-chinatown")).toBe("778-898-3414"); // contact details of the Gore Ave classes
  });
});

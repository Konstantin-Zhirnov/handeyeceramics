import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkHandover, readme, webmDuration, type HowtoVideo } from "../../scripts/howto/lib";

/** The start of a WebM file, written by hand: a Segment Info with a time scale and a duration. */
function webm(durationInTicks: number, nanosecondsPerTick = 1_000_000, float32 = false): Buffer {
  const scale = Buffer.from([0x2a, 0xd7, 0xb1, 0x83, 0, 0, 0]);
  scale.writeUIntBE(nanosecondsPerTick, 4, 3);
  const duration = Buffer.alloc(float32 ? 7 : 11);
  duration.set([0x44, 0x89, float32 ? 0x84 : 0x88]);
  if (float32) duration.writeFloatBE(durationInTicks, 3);
  else duration.writeDoubleBE(durationInTicks, 3);
  const info = Buffer.concat([scale, duration]);
  return Buffer.concat([
    Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x80]), // EBML header, empty
    Buffer.from([0x15, 0x49, 0xa9, 0x66, 0x80 | info.length]), // Info
    info,
    Buffer.alloc(64, 1), // the clusters would follow
  ]);
}

describe("webmDuration", () => {
  it("reads the length of a recording in seconds", () => {
    expect(webmDuration(webm(42_000))).toBe(42);
    expect(webmDuration(webm(61_500, 1_000_000, true))).toBe(61.5);
    // 5000 ticks of 0.01 s
    expect(webmDuration(webm(5_000, 10_000_000))).toBe(50);
  });

  it("gives null for a file that is not a recording", () => {
    expect(webmDuration(Buffer.from("not a video"))).toBeNull();
    expect(webmDuration(Buffer.alloc(0))).toBeNull();
  });
});

describe("checkHandover", () => {
  const videos: HowtoVideo[] = [
    { file: "01-first.webm", title: "First edit", shows: "how the first edit is made" },
    { file: "02-second.webm", title: "Second edit", shows: "how the second edit is made" },
  ];
  let dir = "";
  const make = (files: Record<string, Buffer>, readmeText: string | null = readme(videos)) => {
    dir = mkdtempSync(path.join(tmpdir(), "howto-check-"));
    mkdirSync(path.join(dir, "videos"));
    for (const [name, data] of Object.entries(files)) writeFileSync(path.join(dir, "videos", name), data);
    if (readmeText !== null) writeFileSync(path.join(dir, "README.md"), readmeText);
    return dir;
  };
  afterEach(() => dir && rmSync(dir, { recursive: true, force: true }));

  it("accepts a folder with every video, of a watchable length, and a README that lists them", () => {
    expect(checkHandover(make({ "01-first.webm": webm(42_000), "02-second.webm": webm(88_000) }), videos)).toEqual([]);
  });

  it("writes one README line per video: its file and what it shows", () => {
    const lines = readme(videos).split("\n").filter((l) => l.includes(".webm"));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("01-first.webm");
    expect(lines[0]).toContain("how the first edit is made");
    expect(lines[1]).toContain("02-second.webm");
  });

  it("reports a missing, an empty, a too short and a too long video", () => {
    const problems = checkHandover(make({ "02-second.webm": webm(5_000) }), videos).join("\n");
    expect(problems).toMatch(/01-first\.webm.*missing/);
    expect(problems).toMatch(/02-second\.webm.*5(\.0)? s/);
    rmSync(dir, { recursive: true, force: true });
    const more = checkHandover(make({ "01-first.webm": Buffer.alloc(0), "02-second.webm": webm(120_000) }), videos).join("\n");
    expect(more).toMatch(/01-first\.webm.*empty/);
    expect(more).toMatch(/02-second\.webm.*120(\.0)? s/);
  });

  it("reports a video the README does not list, and a README that lists a video that is not there", () => {
    const files = { "01-first.webm": webm(42_000), "02-second.webm": webm(42_000) };
    const extra = checkHandover(make({ ...files, "03-stray.webm": webm(42_000) }), videos).join("\n");
    expect(extra).toMatch(/03-stray\.webm/);
    rmSync(dir, { recursive: true, force: true });
    const stale = checkHandover(make(files, readme(videos) + "\n- `09-gone.webm` — gone\n"), videos).join("\n");
    expect(stale).toMatch(/README.*09-gone\.webm/);
    rmSync(dir, { recursive: true, force: true });
    expect(checkHandover(make(files, null), videos).join("\n")).toMatch(/README\.md.*missing/);
  });
});

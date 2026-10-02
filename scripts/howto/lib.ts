/**
 * The list of how-to videos, the README that goes with them, and the check
 * that the recorded folder is complete. No browser here: record.ts does the
 * recording.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export type HowtoVideo = {
  /** File name in handover/videos. */
  file: string;
  title: string;
  /** One line for the README: what the video shows. */
  shows: string;
};

export const VIDEOS: HowtoVideo[] = [
  {
    file: "01-add-a-class.webm",
    title: "Add a new class",
    shows: "how to add a new class with its studio, price and schedule, and where it appears on the studio page",
  },
  {
    file: "02-change-class-time.webm",
    title: "Change the time of a class",
    shows: "how to change the day and time of an existing class and check the schedule on the studio page",
  },
  {
    file: "03-change-a-price.webm",
    title: "Change a price",
    shows: "how to change the price of a shop product, and where the price of a class is edited",
  },
  {
    file: "04-replace-a-photo.webm",
    title: "Replace a photo",
    shows: "how to replace the photo of a product with a new one and describe it (alt text)",
  },
  {
    file: "05-upload-a-video.webm",
    title: "Upload a video",
    shows: "how to upload a video; until video hosting is connected the file is kept as a placeholder, and the admin says so",
  },
  {
    file: "06-edit-page-text.webm",
    title: "Edit the text of a page",
    shows: "how to edit a paragraph of a page and see the change on the site",
  },
  {
    file: "07-view-enquiries.webm",
    title: "Read and mark an enquiry",
    shows: "where the enquiries sent through the site forms arrive, how to read one and mark it as answered",
  },
];

/** A video the owner can sit through: long enough to show the edit, short enough to rewatch. */
export const MIN_SECONDS = 15;
export const MAX_SECONDS = 95;

const INFO = Buffer.from([0x15, 0x49, 0xa9, 0x66]);
const TIME_SCALE = Buffer.from([0x2a, 0xd7, 0xb1]);
const DURATION = Buffer.from([0x44, 0x89]);

/**
 * The length of a WebM recording in seconds, read from its Segment Info
 * (Duration × TimestampScale); null when the file has none.
 */
export function webmDuration(file: Buffer): number | null {
  const head = file.subarray(0, 1 << 16);
  const info = head.indexOf(INFO);
  if (info < 0) return null;

  let nanosecondsPerTick = 1_000_000;
  const scale = head.indexOf(TIME_SCALE, info);
  if (scale >= 0 && scale + 3 < head.length) {
    const size = head[scale + 3] & 0x7f;
    if (size >= 1 && size <= 6 && scale + 4 + size <= head.length) nanosecondsPerTick = head.readUIntBE(scale + 4, size);
  }

  for (let at = head.indexOf(DURATION, info); at >= 0; at = head.indexOf(DURATION, at + 1)) {
    const size = head[at + 2];
    let ticks: number | undefined;
    if (size === 0x88 && at + 11 <= head.length) ticks = head.readDoubleBE(at + 3);
    else if (size === 0x84 && at + 7 <= head.length) ticks = head.readFloatBE(at + 3);
    if (ticks !== undefined && Number.isFinite(ticks) && ticks > 0) {
      return Math.round(ticks * nanosecondsPerTick) / 1e9;
    }
  }
  return null;
}

export function readme(videos: HowtoVideo[] = VIDEOS): string {
  return [
    "# How-to videos",
    "",
    "Short screen recordings of the site admin, one per common edit. Each step has a caption",
    "at the bottom of the screen. They are recorded on a temporary copy of the site, so the",
    "demo values you see in them were never published.",
    "",
    ...videos.map((v) => `- \`videos/${v.file}\` — ${v.title}: ${v.shows}.`),
    "",
    "The recordings can be made again after the admin changes: `npm run howto`.",
    "",
  ].join("\n");
}

/** The video files a README names, in order. */
export function readmeFiles(text: string): string[] {
  return [...text.matchAll(/([\w.-]+\.webm)/g)].map((m) => m[1]);
}

/**
 * What is wrong with a recorded handover folder; an empty list means it is
 * complete: every video is there, not empty and of a watchable length, there
 * are no other videos, and the README lists exactly these files.
 */
export function checkHandover(dir: string, videos: HowtoVideo[] = VIDEOS): string[] {
  const problems: string[] = [];
  const videoDir = path.join(dir, "videos");
  const expected = videos.map((v) => v.file);

  for (const name of expected) {
    const file = path.join(videoDir, name);
    if (!existsSync(file)) {
      problems.push(`${name}: missing`);
      continue;
    }
    if (statSync(file).size === 0) {
      problems.push(`${name}: empty file`);
      continue;
    }
    const seconds = webmDuration(readFileSync(file));
    if (seconds === null) problems.push(`${name}: not a WebM recording, or its length is not written in the file`);
    else if (seconds < MIN_SECONDS || seconds > MAX_SECONDS) {
      problems.push(`${name}: ${seconds.toFixed(1)} s long, expected ${MIN_SECONDS} to ${MAX_SECONDS} s`);
    }
  }

  const present = existsSync(videoDir) ? readdirSync(videoDir).filter((f) => f.endsWith(".webm")) : [];
  for (const name of present) if (!expected.includes(name)) problems.push(`${name}: a video that is not in the list`);

  const readmeFile = path.join(dir, "README.md");
  if (!existsSync(readmeFile)) problems.push("README.md: missing");
  else {
    const listed = readmeFiles(readFileSync(readmeFile, "utf8"));
    for (const name of listed) if (!expected.includes(name)) problems.push(`README.md lists ${name}, which is not a video of the set`);
    for (const name of expected) {
      const times = listed.filter((l) => l === name).length;
      if (times !== 1) problems.push(`README.md lists ${name} ${times} times, expected once`);
    }
  }
  return problems;
}

/** Seconds per video file of a handover folder, for the report at the end of a run. */
export function durations(dir: string, videos: HowtoVideo[] = VIDEOS): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const v of videos) {
    const file = path.join(dir, "videos", v.file);
    out[v.file] = existsSync(file) ? webmDuration(readFileSync(file)) : null;
  }
  return out;
}

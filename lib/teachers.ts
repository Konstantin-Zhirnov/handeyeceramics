/**
 * The teacher contacts page is closed by one shared password that the owner
 * changes each term (global `teachers`). A student who typed it gets a cookie
 * holding a keyed hash of the password itself: a new password makes every old
 * cookie worthless at once, without a list of who had access.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Payload } from "payload";
import type { Studio, Teacher } from "../payload-types";
import { getCMS } from "./cms/payload";
import { relId } from "./cms/relations";

export const TEACHERS_PATH = "/teachers";
export const TEACHERS_UNLOCK_PATH = "/teachers/unlock";
export const TEACHERS_COOKIE = "he_teachers";
/** About a term: the cookie outlives a semester only if the password does too. */
export const TEACHERS_COOKIE_MAX_AGE = 60 * 60 * 24 * 150;

/** The key of the hash: the CMS secret, or a fixed local one on a development machine without it. */
const key = (secret = process.env.PAYLOAD_SECRET) => secret || "local-teachers-page";

/** The cookie value for a password; empty for no password, which opens nothing. */
export function teachersToken(password: string | null | undefined, secret?: string): string {
  const p = (password || "").trim().toLowerCase();
  return p ? createHmac("sha256", key(secret)).update(`teachers:${p}`).digest("base64url") : "";
}

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** The password typed matches the current one; spaces around it and letter case of neither are forgiven — students copy it from an email. */
export function passwordMatches(typed: string | null | undefined, actual: string | null | undefined): boolean {
  const a = (actual || "").trim().toLowerCase();
  const t = (typed || "").trim().toLowerCase();
  return !!a && same(t, a);
}

/** The cookie a student holds still opens the page under the current password. */
export function tokenOpens(token: string | null | undefined, actual: string | null | undefined, secret?: string): boolean {
  const want = teachersToken(actual, secret);
  return !!want && !!token && same(token, want);
}

export type TeacherEntry = { name: string; phone: string; classes?: string };
export type TeachersPage = { password: string; intro: string; groups: { studio: string; teachers: TeacherEntry[] }[] };

/**
 * The global as the page needs it, read past the access rules (only editors
 * may read it through the API): the password to check against and the
 * teachers grouped by the name of their studio, in the order the admin lists them.
 */
export async function readTeachersPage(payload?: Payload): Promise<TeachersPage> {
  const p = payload || (await getCMS());
  const page = (await p.findGlobal({ slug: "teachers", depth: 0, overrideAccess: true })) as Teacher;
  const list = page.teachers || [];
  const ids = [...new Set(list.map((t) => relId(t.studio)).filter((id): id is number => !!id))];
  const studios = ids.length ? ((await p.find({ collection: "studios", where: { id: { in: ids } }, depth: 0, pagination: false, overrideAccess: true })).docs as Studio[]) : [];
  const groups = new Map<string, TeacherEntry[]>();
  for (const t of list) {
    const studio = studios.find((s) => s.id === relId(t.studio))?.name || "";
    groups.set(studio, [...(groups.get(studio) || []), { name: t.name, phone: t.phone, ...(t.classes ? { classes: t.classes } : {}) }]);
  }
  return { password: page.password?.trim() || "", intro: page.intro || "", groups: [...groups].map(([studio, teachers]) => ({ studio, teachers })) };
}

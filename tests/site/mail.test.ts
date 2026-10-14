/**
 * The daily mail job over the running site (R19i, R19i.2): GET /cron/daily
 * is closed without the bearer secret, and with it sends the reminder to a
 * student whose class starts in two days and the invitation to one whose class
 * ended a day ago — once. The data is made through the editor's REST API.
 *
 * The test setup hands the site a one-off CRON_SECRET and this test the same
 * value; only a server you started yourself (TEST_BASE_URL) without the
 * variable answers 503, and then only that is checked.
 */
import { execFile } from "node:child_process";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { assertThrowAwayTarget, editorToken } from "./editor";

const base = () => inject("baseURL");
const root = path.resolve(import.meta.dirname, "../..");
// The secret the test setup gave the site (global-setup); "" only on TEST_BASE_URL without CRON_SECRET.
const secret = inject("cronSecret");

const HAND_BUILDING = "/product-page/hand-building-beginner-to-intermediate";
const CHINATOWN_STUDIO = "/classes/vancouver-chinatown";
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const EMAILS = ["mail-remind@example.com", "mail-done@example.com"];

type Doc = Record<string, any>;

let token = "";
const auth = async () => {
  token ||= await editorToken(base());
  return { Authorization: `JWT ${token}` };
};

async function api(p: string, init: RequestInit = {}, asEditor = false): Promise<{ status: number; body: Doc }> {
  const headers = { "Content-Type": "application/json", ...(asEditor ? await auth() : {}), ...(init.headers || {}) };
  const res = await fetch(`${base()}/api${p}`, { ...init, headers });
  const text = await res.text();
  let body: Doc = {};
  try {
    body = JSON.parse(text);
  } catch {
    /* an empty or HTML error body */
  }
  return { status: res.status, body };
}

const where = (field: string, value: string | number) => `where[${field}][equals]=${encodeURIComponent(String(value))}`;
async function idOf(collection: string, p: string): Promise<number> {
  const [doc] = (await api(`/${collection}?${where("path", p)}&depth=0`)).body.docs || [];
  expect(doc, p).toBeDefined();
  return doc.id;
}

const cron = (headers: Record<string, string> = {}) => fetch(`${base()}/cron/daily`, { headers });

/** Removes documents the editor's API may not delete (registrations), through the Local API in a separate process. */
async function cmsRemove(collection: string, field: string, value: string) {
  assertThrowAwayTarget(base());
  const uri = inject("databaseURI");
  if (!uri) throw new Error("with TEST_BASE_URL also set DATABASE_URI to the database of that server");
  await new Promise<void>((resolve, reject) => {
    execFile(
      process.execPath,
      ["--import", "tsx", "tests/site/cms-update.ts"],
      {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, DATABASE_URI: uri, NODE_OPTIONS: "--no-deprecation", CMS_UPDATE: JSON.stringify({ collection, where: { [field]: value }, remove: true }) },
      },
      (error, stdout, stderr) => (error ? reject(new Error(`cms-update failed:\n${(stdout + stderr).slice(-2000)}`)) : resolve()),
    );
  });
}

// The first requests compile the routes of the dev server: minutes on a slow machine, so not part of a test.
beforeAll(async () => {
  await api("/studios?limit=1&depth=0");
  await cron();
}, 600_000);

it.skipIf(secret)("without CRON_SECRET in the environment the job is off: 503", async () => {
  expect((await cron({ Authorization: "Bearer anything" })).status).toBe(503);
});

describe.skipIf(!secret)("GET /cron/daily with a secret", () => {
  const sessions: number[] = [];

  afterAll(async () => {
    for (const email of EMAILS) await cmsRemove("registrations", "email", email);
    for (const id of sessions) await api(`/sessions/${id}`, { method: "DELETE" }, true);
  }, 600_000);

  it("answers 401 without the header or with a wrong one", async () => {
    expect((await cron()).status).toBe(401);
    expect((await cron({ Authorization: `Bearer ${secret}-wrong` })).status).toBe(401);
  });

  it("sends the reminder two days before and the invitation a day after, once", { timeout: 600_000 }, async () => {
    const product = await idOf("products", HAND_BUILDING);
    const studio = await idOf("studios", CHINATOWN_STUDIO);
    const now = Date.now();
    const dates = [
      { label: "Mail test: starts in two days", startsAt: new Date(now + 2 * DAY + HOUR).toISOString(), endsAt: new Date(now + 44 * DAY).toISOString(), email: EMAILS[0], name: "Rem Inder" },
      { label: "Mail test: ended yesterday", startsAt: new Date(now - 43 * DAY).toISOString(), endsAt: new Date(now - 36 * HOUR).toISOString(), email: EMAILS[1], name: "All Done" },
    ];
    const registrations: number[] = [];
    for (const d of dates) {
      const created = await api(
        "/sessions",
        { method: "POST", body: JSON.stringify({ label: d.label, product, studio, seats: 3, status: "hidden", startsAt: d.startsAt, endsAt: d.endsAt }) },
        true,
      );
      expect(created.status, d.label).toBe(201);
      sessions.push(created.body.doc.id);
      const reg = await api(
        "/registrations",
        { method: "POST", body: JSON.stringify({ session: created.body.doc.id, product, studio, name: d.name, email: d.email, status: "confirmed" }) },
        true,
      );
      expect(reg.status, d.email).toBe(201);
      registrations.push(reg.body.doc.id);
    }

    const first = await cron({ Authorization: `Bearer ${secret}` });
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ ok: true, reminders: 1, followups: 1 });

    const reminded = (await api(`/registrations/${registrations[0]}?depth=0`, {}, true)).body;
    expect(reminded.reminderSentAt).toBeTruthy();
    expect(reminded.followupSentAt ?? null).toBeNull();
    const invited = (await api(`/registrations/${registrations[1]}?depth=0`, {}, true)).body;
    expect(invited.followupSentAt).toBeTruthy();
    expect(invited.reminderSentAt ?? null).toBeNull();

    const second = await cron({ Authorization: `Bearer ${secret}` });
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ ok: true, reminders: 0, followups: 0 });
  });
});

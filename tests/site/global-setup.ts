/**
 * Seeds a throw-away SQLite database from the inventory and starts the site on
 * it, then hands the base URL to the tests. Set TEST_BASE_URL to run the tests
 * against a server you already started instead.
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { TestProject } from "vitest/node";
import { forgetEditor } from "./editor";

const root = path.resolve(import.meta.dirname, "../..");
const port = Number(process.env.TEST_PORT || 3311);
let server: ChildProcess | undefined;
let dir: string | undefined;

declare module "vitest" {
  export interface ProvidedContext {
    baseURL: string;
    /** The database of the site under test, for tests that edit the CMS; "" if unknown. */
    databaseURI: string;
    /** The bearer secret of GET /cron/daily on the site under test; "" when none is set (TEST_BASE_URL without CRON_SECRET). */
    cronSecret: string;
    /** The webhook secret the fake gateway checks signatures with; "" when unknown (TEST_BASE_URL without STRIPE_WEBHOOK_SECRET) — then the literal "fake" signs. */
    webhookSecret: string;
  }
}

async function waitFor(url: string, ms: number) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.status < 500) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`site did not start at ${url}`);
}

export default async function setup(project: TestProject) {
  if (process.env.TEST_BASE_URL) {
    project.provide("baseURL", process.env.TEST_BASE_URL.replace(/\/$/, ""));
    project.provide("databaseURI", process.env.DATABASE_URI || "");
    project.provide("cronSecret", process.env.CRON_SECRET || "");
    project.provide("webhookSecret", process.env.STRIPE_WEBHOOK_SECRET || "");
    const target = process.env.TEST_BASE_URL.replace(/\/$/, "");
    return () => forgetEditor(target);
  }
  dir = mkdtempSync(path.join(tmpdir(), "handeye-test-"));
  const env = {
    ...process.env,
    DATABASE_URI: `file:${path.join(dir, "test.db").replace(/\\/g, "/")}`,
    SITE_ENV: "",
    NEXT_PUBLIC_SERVER_URL: `http://localhost:${port}`,
    // The pictures of three pages: enough for the tests of pages with photos, and quick to upload.
    SEED_FIXES: "0",
    SEED_IMAGES: process.env.SEED_IMAGES ?? "/about-us,/gift-card,/commissions-and-film-props",
    MUX_TOKEN_ID: "",
    MUX_TOKEN_SECRET: "",
    BLOB_READ_WRITE_TOKEN: "",
    SMTP_HOST: "",
    // The daily mail job needs a bearer secret: a one-off one for this run unless the environment names one.
    CRON_SECRET: process.env.CRON_SECRET || randomBytes(18).toString("base64url"),
    // Payments go through the in-process fake gateway: no keys, no network; the webhook is signed with a one-off secret.
    PAYMENT_GATEWAY: "fake",
    STRIPE_SECRET_KEY: "",
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || `whsec_${randomBytes(18).toString("hex")}`,
    NEXT_DIST_DIR: process.env.NEXT_DIST_DIR || ".next/test",
    NODE_ENV: "development",
  } as NodeJS.ProcessEnv;

  const seed = spawnSync("npm", ["run", "seed", "--silent"], { cwd: root, env, shell: true, encoding: "utf8" });
  if (seed.status !== 0) throw new Error(`seed failed:\n${(seed.stdout + seed.stderr).slice(-3000)}`);

  server = spawn("npx", ["next", "dev", "-p", String(port)], { cwd: root, env, shell: true, stdio: "ignore" });
  const baseURL = `http://localhost:${port}`;
  await waitFor(`${baseURL}/robots.txt`, 300_000);
  project.provide("baseURL", baseURL);
  project.provide("databaseURI", env.DATABASE_URI!);
  project.provide("cronSecret", env.CRON_SECRET!);
  project.provide("webhookSecret", env.STRIPE_WEBHOOK_SECRET!);
  return stop;
}

async function stop() {
  forgetEditor(`http://localhost:${port}`);
  if (server?.pid) {
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"]);
    else server.kill("SIGTERM");
  }
  if (dir) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* the database file may still be locked for a moment on Windows */
    }
  }
}

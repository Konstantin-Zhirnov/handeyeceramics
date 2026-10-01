/**
 * Seeds a throw-away SQLite database from the inventory and starts the site on
 * it, then hands the base URL to the tests. Set TEST_BASE_URL to run the tests
 * against a server you already started instead.
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { TestProject } from "vitest/node";

const root = path.resolve(import.meta.dirname, "../..");
const port = Number(process.env.TEST_PORT || 3311);
let server: ChildProcess | undefined;
let dir: string | undefined;

declare module "vitest" {
  export interface ProvidedContext {
    baseURL: string;
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
    return;
  }
  dir = mkdtempSync(path.join(tmpdir(), "handeye-test-"));
  const env = {
    ...process.env,
    DATABASE_URI: `file:${path.join(dir, "test.db").replace(/\\/g, "/")}`,
    SITE_ENV: "",
    NEXT_PUBLIC_SERVER_URL: `http://localhost:${port}`,
    SEED_IMAGES: process.env.SEED_IMAGES ?? "0",
    MUX_TOKEN_ID: "",
    MUX_TOKEN_SECRET: "",
    BLOB_READ_WRITE_TOKEN: "",
    SMTP_HOST: "",
    NEXT_DIST_DIR: ".next/test",
    NODE_ENV: "development",
  } as NodeJS.ProcessEnv;

  const seed = spawnSync("npm", ["run", "seed", "--silent"], { cwd: root, env, shell: true, encoding: "utf8" });
  if (seed.status !== 0) throw new Error(`seed failed:\n${(seed.stdout + seed.stderr).slice(-3000)}`);

  server = spawn("npx", ["next", "dev", "-p", String(port)], { cwd: root, env, shell: true, stdio: "ignore" });
  const baseURL = `http://localhost:${port}`;
  await waitFor(`${baseURL}/robots.txt`, 300_000);
  project.provide("baseURL", baseURL);
  return stop;
}

async function stop() {
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

/**
 * Signs in as a test editor, for tests that change a document through the API.
 * Credentials: TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD, else a throw-away user
 * registered as the first user of the test database. Its random password is
 * kept in the temp directory, so every test file of a run signs in as the same
 * user, and removed when the run ends (global-setup). Against a database that
 * already has users, set the two variables.
 *
 * Signing in is the gate of every test that writes to the CMS, so it refuses
 * any target but a throw-away database: the one the test setup seeds itself,
 * or a local server you started (TEST_BASE_URL) and declared temporary with
 * TEST_TEMP_DB=1.
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

type Creds = { email: string; password: string };

const credsFile = (base: string) => path.join(tmpdir(), `handeye-test-editor-${Buffer.from(base).toString("hex")}.json`);

/** Removes the stored password of the throw-away test user (called when a test run ends). */
export const forgetEditor = (base: string) => rmSync(credsFile(base), { force: true });

export function assertThrowAwayTarget(base: string) {
  const host = new URL(base).hostname;
  if (host !== "localhost" && host !== "127.0.0.1") {
    throw new Error(`tests that write to the CMS refuse to run against ${host}`);
  }
  if (process.env.TEST_BASE_URL && process.env.TEST_TEMP_DB !== "1") {
    throw new Error(
      "tests that write to the CMS run only on a throw-away database: " +
        "run them without TEST_BASE_URL, or set TEST_TEMP_DB=1 if that server uses a temporary database",
    );
  }
}

export async function editorToken(base: string): Promise<string> {
  assertThrowAwayTarget(base);
  const post = (p: string, body: unknown) =>
    fetch(`${base}${p}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const token = async (res: Response, creds: Creds): Promise<string | undefined> => {
    if (!res.ok) return undefined;
    const t = (await res.json()).token as string | undefined;
    return t || ((await (await post("/api/users/login", creds)).json()).token as string | undefined);
  };

  const fromEnv: Creds | undefined =
    process.env.TEST_ADMIN_EMAIL && process.env.TEST_ADMIN_PASSWORD
      ? { email: process.env.TEST_ADMIN_EMAIL, password: process.env.TEST_ADMIN_PASSWORD }
      : undefined;
  const file = credsFile(base);
  const known: Creds[] = [];
  if (fromEnv) known.push(fromEnv);
  else if (existsSync(file)) known.push(JSON.parse(readFileSync(file, "utf8")));
  for (const creds of known) {
    const t = await token(await post("/api/users/login", creds), creds);
    if (t) return t;
  }

  const creds = fromEnv || {
    email: `editor-${randomBytes(4).toString("hex")}@example.com`,
    password: randomBytes(18).toString("base64url"),
  };
  const t = await token(await post("/api/users/first-register", creds), creds);
  if (!t) throw new Error("cannot sign in: set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD to an existing local test user");
  if (!fromEnv) writeFileSync(file, JSON.stringify(creds));
  return t;
}

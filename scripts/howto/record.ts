/**
 * Records the how-to videos of the admin for the owner: `npm run howto`.
 *
 * Seeds a throw-away SQLite database, starts the site on it on its own port,
 * registers a test editor, records one short video per common edit with a
 * caption on every step, writes them to handover/videos with handover/README.md,
 * then stops the server and removes the database, the build folder and the
 * files and folders the session added to media/, and puts back tsconfig.json
 * and next-env.d.ts, which the dev server rewrites for its build folder. The
 * main database is never opened. Every video opens with a title card, so its
 * subject is on screen from the first second.
 *
 *   npm run howto                      every video, from scratch
 *   npm run howto -- --only 03,05      only these videos (the rest stay as they are)
 *   npm run howto -- --serve           seed and start the temporary site, keep it running (Ctrl+C stops and cleans)
 *   npm run howto -- --base http://localhost:3231 --only 04
 *                                      record against the site started with --serve
 *
 * The editor's password is random, lives only in this process (or in
 * HOWTO_EMAIL / HOWTO_PASSWORD, to sign in to a --serve site again) and is
 * never printed or shown in a video: the recording starts already signed in.
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, openSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from "playwright";
import { checkHandover, durations, HOWTO_DB_FILE, HOWTO_DIST_DIR, HOWTO_PRODUCT_PATH, howtoSiteEnv, localBase, readme, VIDEOS, type HowtoVideo } from "./lib";

const root = path.resolve(import.meta.dirname, "../..");
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : undefined);

const port = Number(process.env.HOWTO_PORT || 3231);
const baseOption = option("base");
const external = baseOption === undefined ? undefined : localBase(baseOption);
const base = external || `http://localhost:${port}`;
const only = option("only")?.split(",").map((s) => s.trim()).filter(Boolean);
const serveOnly = flag("serve");

const DB_FILE = HOWTO_DB_FILE;
const DIST_DIR = HOWTO_DIST_DIR;
const handover = path.join(root, "handover");
const mediaDir = path.join(root, "media");
const SIZE = { width: 1280, height: 800 };

/** Demo values: visibly not the studio's own, and the database they go to is deleted. */
const DEMO = {
  classTitle: "Demo class — delete me",
  classPrice: "$0 (demo)",
  classTime: "6:00 pm (demo)",
  newTime: "Sat 8 PM (demo)",
  videoTitle: "Demo video — delete me",
  photoAlt: "Demo photo — delete me",
  pageText: " (Demo edit — delete me.)",
  enquiryEmail: "demo@example.com",
  enquiryText: "Demo enquiry, sent to record this how-to video.",
};
const PRODUCT_PATH = HOWTO_PRODUCT_PATH;
const TEXT_PAGE_PATH = "/about-us";

type Doc = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Data = { studio: Doc; cls: Doc; product: Doc; photo: Doc; page: Doc; textBlock: number; enquiry: Doc };
type Fixtures = { photo: string; video: string };

const log = (msg: string) => console.log(`[howto] ${msg}`);
const warn = (msg: string) => console.log(`[howto] WARNING ${msg}`);
/** A step of a video that is not on screen: the video would be handed over with a step missing, so the run stops. */
const missing = (msg: string): never => {
  throw new Error(`step not found: ${msg}`);
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- The temporary site ------------------------------------------------------

const siteEnv = (): NodeJS.ProcessEnv => howtoSiteEnv(base, port, process.env);

let server: ChildProcess | undefined;
let workDir = "";
let mediaBefore: Set<string> | undefined;
let mediaFoldersBefore: Set<string> | undefined;
/** `next dev` with its own build folder rewrites these two files; they are put back as they were. */
const NEXT_REWRITES = ["tsconfig.json", "next-env.d.ts"];
let nextFiles: Map<string, string> | undefined;

function listFiles(dir: string, prefix = ""): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listFiles(path.join(dir, e.name), `${prefix}${e.name}/`) : [`${prefix}${e.name}`],
  );
}

/** Folders below a folder, the deepest first. */
function listFolders(dir: string, prefix = ""): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .flatMap((e) => [...listFolders(path.join(dir, e.name), `${prefix}${e.name}/`), `${prefix}${e.name}`]);
}

async function responds(url: string): Promise<boolean> {
  try {
    return (await fetch(url, { redirect: "manual" })).status < 500;
  } catch {
    return false; // nothing listens there
  }
}

async function waitFor(url: string, ms: number) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (await responds(url)) return;
    await sleep(1000);
  }
  throw new Error(`the site did not start at ${url}`);
}

function removeTemporaryFiles() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) rmSync(path.join(root, DB_FILE + suffix), { force: true, maxRetries: 10, retryDelay: 500 });
  rmSync(path.join(root, DIST_DIR), { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
}

async function startSite() {
  if (await responds(`${base}/robots.txt`)) {
    throw new Error(`port ${port} is taken: stop what runs there, or record against it with --base ${base}`);
  }
  removeTemporaryFiles(); // left by a run that was killed
  mediaBefore = new Set(listFiles(mediaDir));
  mediaFoldersBefore = new Set(listFolders(mediaDir));
  nextFiles = new Map(
    NEXT_REWRITES.filter((f) => existsSync(path.join(root, f))).map((f) => [f, readFileSync(path.join(root, f), "utf8")]),
  );
  const env = siteEnv();

  log("seeding the temporary database…");
  const seed = spawnSync("npm", ["run", "seed", "--silent"], { cwd: root, env, shell: true, encoding: "utf8" });
  if (seed.status !== 0) throw new Error(`seed failed:\n${(seed.stdout + seed.stderr).slice(-3000)}`);

  const serverLog = path.join(workDir, "server.log");
  const out = openSync(serverLog, "a");
  log(`starting the site on ${base} (server log: ${serverLog})…`);
  server = spawn("npx", ["next", "dev", "-p", String(port)], { cwd: root, env, shell: true, stdio: ["ignore", out, out] });
  await waitFor(`${base}/robots.txt`, 300_000);
}

/** File names the temporary database refers to, so that only its own uploads are removed from media/. */
async function uploadedNames(token: string | undefined): Promise<Set<string> | undefined> {
  if (!token) return undefined;
  try {
    const names = new Set<string>();
    for (const slug of ["media", "videos"]) {
      const res = await fetch(`${base}/api/${slug}?limit=5000&depth=0`, { headers: { Authorization: `JWT ${token}` } });
      if (!res.ok) return undefined;
      for (const doc of (await res.json()).docs as Doc[]) {
        if (doc.filename) names.add(doc.filename);
        for (const size of Object.values((doc.sizes || {}) as Record<string, Doc>)) if (size?.filename) names.add(size.filename);
      }
    }
    return names;
  } catch {
    return undefined; // the server is already down: nothing in media/ is removed
  }
}

let stopped = false;
async function stopSite(token?: string) {
  if (stopped) return;
  stopped = true;
  if (!external) {
    const names = await uploadedNames(token);
    if (server?.pid) {
      if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"]);
      else server.kill("SIGTERM");
      await sleep(2000);
    }
    for (const [file, text] of nextFiles || []) {
      if (readFileSync(path.join(root, file), "utf8") !== text) writeFileSync(path.join(root, file), text);
    }
    if (mediaBefore && !names) {
      const added = listFiles(mediaDir).filter((f) => !mediaBefore!.has(f));
      if (added.length) warn(`the list of uploaded files is not available: ${added.length} new files in media/ are left as they are (${added.slice(0, 5).join(", ")}${added.length > 5 ? ", …" : ""})`);
    } else if (mediaBefore && names) {
      let removed = 0;
      for (const file of listFiles(mediaDir)) {
        if (mediaBefore.has(file)) continue;
        if (!names.has(path.basename(file))) continue;
        rmSync(path.join(mediaDir, file), { force: true });
        removed++;
      }
      // …and the folders the uploads created (media/videos), once they are empty
      for (const folder of listFolders(mediaDir)) {
        const full = path.join(mediaDir, folder);
        if (!mediaFoldersBefore?.has(folder) && readdirSync(full).length === 0) rmSync(full, { recursive: true, force: true });
      }
      log(`removed ${removed} files this session added to media/`);
    }
    try {
      removeTemporaryFiles();
    } catch (e) {
      warn(`could not remove ${DB_FILE} or ${DIST_DIR}: ${(e as Error).message}`);
    }
  }
  if (workDir) rmSync(workDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
}

// ---- The test editor and the data the videos work on -----------------------

async function signIn(): Promise<string> {
  const fromEnv = Boolean(process.env.HOWTO_EMAIL && process.env.HOWTO_PASSWORD);
  const creds = fromEnv
    ? { email: process.env.HOWTO_EMAIL!, password: process.env.HOWTO_PASSWORD! }
    : { email: `howto-${randomBytes(4).toString("hex")}@example.com`, password: randomBytes(24).toString("base64url") };
  const post = (p: string, body: unknown) =>
    fetch(`${base}${p}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  for (const [route, body] of [
    ["/api/users/login", creds],
    ["/api/users/first-register", { ...creds, name: "Demo editor" }],
    ["/api/users/login", creds],
  ] as const) {
    const res = await post(route, body);
    const token = res.ok ? ((await res.json()).token as string | undefined) : undefined;
    if (token) return token;
  }
  throw new Error(
    fromEnv
      ? "cannot sign in with HOWTO_EMAIL / HOWTO_PASSWORD"
      : "cannot register the test editor: this database already has users (set HOWTO_EMAIL and HOWTO_PASSWORD of its test editor)",
  );
}

async function api(token: string, route: string): Promise<Doc> {
  const res = await fetch(`${base}/api${route}`, { headers: { Authorization: `JWT ${token}` } });
  if (!res.ok) throw new Error(`GET /api${route} → ${res.status}`);
  return res.json();
}

async function collect(token: string): Promise<Data> {
  const classes = (await api(token, "/classes?depth=1&limit=100")).docs as Doc[];
  const cls = classes.find(
    (c) => c.title !== DEMO.classTitle && c.sessions?.length && c.studio?.[0]?.status === "open" && c.studio[0].published !== false,
  );
  if (!cls) throw new Error("the seeded database has no class with a schedule at an open studio");
  const studio = cls.studio[0] as Doc;

  const products = (await api(token, `/products?depth=1&limit=1&where[path][equals]=${encodeURIComponent(PRODUCT_PATH)}`)).docs as Doc[];
  const product = products[0];
  const photo = product?.images?.[0] as Doc | undefined;
  if (!product || !photo?.id) throw new Error(`the seeded database has no product ${PRODUCT_PATH} with a photo`);

  const page = ((await api(token, `/pages?depth=0&limit=1&where[path][equals]=${encodeURIComponent(TEXT_PAGE_PATH)}`)).docs as Doc[])[0];
  const textBlock = ((page?.blocks || []) as Doc[]).findIndex((b) => b.blockType === "text" && b.body?.root?.children?.length);
  if (!page || textBlock < 0) throw new Error(`the seeded database has no page ${TEXT_PAGE_PATH} with a text block`);

  // The enquiry comes in the way a visitor's does: through the route the site's contact form posts to.
  const sent = await fetch(`${base}/forms/enquiry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "contact",
      page: "/contact-us",
      values: { email: DEMO.enquiryEmail, booking: "General Question", comments: DEMO.enquiryText },
    }),
  });
  if (sent.status !== 201) throw new Error(`the contact form refused the demo enquiry: ${sent.status} ${await sent.text()}`);
  const enquiry = ((await api(token, `/enquiries?depth=0&limit=1&sort=-createdAt&where[email][equals]=${DEMO.enquiryEmail}`)).docs as Doc[])[0];
  if (!enquiry) throw new Error("the demo enquiry did not reach the database");

  return { studio, cls, product, photo, page, textBlock, enquiry };
}

// ---- Caption, cursor and highlight, injected into the page being recorded ----

const OVERLAY = `(() => {
  if (window.__howto) return;
  var h = (window.__howto = {});
  var get = function (k) { try { return sessionStorage.getItem('howto-' + k) || ''; } catch (e) { return ''; } };
  var set = function (k, v) { try { sessionStorage.setItem('howto-' + k, v); } catch (e) {} };
  var make = function (id, css) {
    var el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      el.setAttribute('aria-hidden', 'true');
      el.style.cssText = css;
      document.body.appendChild(el);
    }
    return el;
  };
  var fixed = 'position:fixed;pointer-events:none;box-sizing:border-box;';
  h.ensure = function () {
    if (!document.body) return;
    // the dev server's own badge is not part of the admin the owner will see
    if (document.head && !document.getElementById('howto-style')) {
      var st = document.createElement('style');
      st.id = 'howto-style';
      st.textContent = 'nextjs-portal{display:none!important}';
      document.head.appendChild(st);
    }
    var text = get('caption');
    var c = make('howto-caption', fixed + 'left:50%;bottom:26px;transform:translateX(-50%);width:max-content;max-width:1040px;padding:14px 28px;border-radius:14px;background:rgba(24,22,20,.94);color:#fff;border:2px solid #f2b84b;box-shadow:0 10px 34px rgba(0,0,0,.4);font:600 23px/1.35 "Segoe UI",system-ui,Arial,sans-serif;text-align:center;z-index:2147483646;');
    if (c.textContent !== text) c.textContent = text;
    c.style.display = text ? 'block' : 'none';
    var r = make('howto-ring', fixed + 'border:3px solid #f2b84b;border-radius:8px;box-shadow:0 0 0 5px rgba(242,184,75,.3);z-index:2147483645;transition:all .25s ease;display:none;');
    var ring = get('ring');
    if (ring) {
      var b = ring.split(',');
      r.style.left = b[0] - 6 + 'px'; r.style.top = b[1] - 6 + 'px';
      r.style.width = +b[2] + 12 + 'px'; r.style.height = +b[3] + 12 + 'px';
      r.style.display = 'block';
    } else r.style.display = 'none';
    var m = make('howto-cursor', fixed + 'width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;background:rgba(242,184,75,.55);border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.5);z-index:2147483647;transition:transform .12s ease;');
    var at = get('cursor').split(',');
    if (at.length === 2) { m.style.left = at[0] + 'px'; m.style.top = at[1] + 'px'; m.style.display = 'block'; } else m.style.display = 'none';
  };
  h.caption = function (t) { set('caption', t); h.ensure(); };
  h.ring = function (v) { set('ring', v); h.ensure(); };
  document.addEventListener('mousemove', function (e) {
    set('cursor', e.clientX + ',' + e.clientY);
    var m = document.getElementById('howto-cursor');
    if (m) { m.style.left = e.clientX + 'px'; m.style.top = e.clientY + 'px'; m.style.display = 'block'; }
  }, true);
  document.addEventListener('mousedown', function () { var m = document.getElementById('howto-cursor'); if (m) m.style.transform = 'scale(.6)'; }, true);
  document.addEventListener('mouseup', function () { var m = document.getElementById('howto-cursor'); if (m) m.style.transform = ''; }, true);
  document.addEventListener('DOMContentLoaded', h.ensure);
  setInterval(h.ensure, 150);
})();`;

let startedAt = 0;
/** The title of the video being recorded: on its title card, and the first caption in the admin. */
let title = "";

async function inPage(page: Page, script: string) {
  for (let attempt = 0; ; attempt++) {
    try {
      await page.evaluate(`(() => { ${OVERLAY}; ${script} })()`);
      return;
    } catch (e) {
      // the page is in the middle of a navigation: try again once it settles
      if (attempt >= 5) throw e;
      await page.waitForTimeout(500);
    }
  }
}

/** Shows the caption of a step and holds it long enough to read. */
async function say(page: Page, text: string, hold?: number) {
  await inPage(page, `window.__howto.caption(${JSON.stringify(text)})`);
  const reading = Math.min(4000, Math.max(2000, 1100 + text.length * 36));
  // A run on a slow machine must still end in time: past 60 s the captions stay up for less.
  await page.waitForTimeout(Date.now() - startedAt > 60_000 ? Math.min(2000, hold ?? reading) : (hold ?? reading));
}

async function point(page: Page, target: Locator) {
  await target.waitFor({ state: "visible", timeout: 45_000 });
  await target.evaluate((el) => el.scrollIntoView({ block: "center", inline: "nearest" }));
  await page.waitForTimeout(250);
  const box = await target.boundingBox();
  if (!box) return;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 14 });
  await inPage(page, `window.__howto.ring(${JSON.stringify([box.x, box.y, box.width, box.height].map(Math.round).join(","))})`);
  await page.waitForTimeout(450);
}

const unring = (page: Page) => inPage(page, `window.__howto.ring('')`);

async function click(page: Page, target: Locator) {
  await point(page, target);
  await unring(page);
  await target.click();
  await page.waitForTimeout(300);
}

async function type(page: Page, target: Locator, text: string) {
  await click(page, target);
  await page.keyboard.press("Control+A");
  await page.keyboard.type(text, { delay: 22 });
  await page.waitForTimeout(250);
}

async function firstVisible(page: Page, selectors: string[], ms = 8000): Promise<Locator | undefined> {
  const until = Date.now() + ms;
  do {
    for (const s of selectors) {
      const l = page.locator(s).first();
      if (await l.isVisible()) return l;
    }
    await page.waitForTimeout(250);
  } while (Date.now() < until);
  return undefined;
}

async function open(page: Page, url: string) {
  await page.goto(url, { waitUntil: "load", timeout: 180_000 });
  await page.waitForTimeout(400);
}

const listURL = (slug: string) => `/admin/collections/${slug}`;

/** From the dashboard to the list of a collection, by its card. */
async function openCollection(page: Page, slug: string, caption: string) {
  const link = await firstVisible(page, [`#card-${slug}`, `#nav-${slug}`, `a[href$="${listURL(slug)}"]`]);
  if (link) await point(page, link);
  await say(page, caption);
  await unring(page);
  if (link) {
    await link.click();
    await page.waitForURL((u) => u.pathname.endsWith(listURL(slug)), { timeout: 120_000 });
    await page.waitForLoadState("load");
    await page.waitForTimeout(600);
  } else {
    missing(`no link to ${slug} on the dashboard`);
  }
}

/** From the list of a collection to one document: by its row, after a search by name when there is one. */
async function openDoc(page: Page, slug: string, doc: Doc, caption: string, search?: string) {
  const row = `a[href$="${listURL(slug)}/${doc.id}"]`;
  if (search) {
    const input = await firstVisible(page, [".search-filter input", 'input[placeholder^="Search"]'], 5000);
    if (input) {
      await type(page, input, search);
      await page.waitForTimeout(1500);
    } else missing(`no search box in the list of ${slug}`);
  }
  const link = await firstVisible(page, [row], 8000);
  if (link) await point(page, link);
  await say(page, caption);
  await unring(page);
  if (link) {
    await link.click();
    await page.waitForURL((u) => u.pathname.endsWith(`${listURL(slug)}/${doc.id}`), { timeout: 120_000 });
    await page.waitForLoadState("load");
  } else {
    missing(`${slug} ${doc.id} is not in the list on screen`);
  }
  await page.locator("#action-save").waitFor({ state: "visible", timeout: 120_000 });
  await page.waitForTimeout(500);
}

async function createNew(page: Page, slug: string, caption: string) {
  const link = await firstVisible(page, [`a[href$="${listURL(slug)}/create"]`]);
  if (link) await point(page, link);
  await say(page, caption);
  await unring(page);
  if (link) {
    await link.click();
    await page.waitForURL((u) => u.pathname.endsWith("/create"), { timeout: 120_000 });
  } else {
    missing(`no Create New link in the list of ${slug}`);
  }
  await page.locator("#action-save").waitFor({ state: "visible", timeout: 120_000 });
  await page.waitForTimeout(1000);
}

/** Picks an option of a select or relationship field. */
async function choose(page: Page, field: string, option: string | RegExp) {
  await click(page, page.locator(`${field} .rs__control`).first());
  const item = page.locator(".rs__option", { hasText: option }).first();
  await click(page, item);
}

async function save(page: Page, slug: string, caption: string) {
  const button = page.locator("#action-save").first();
  await point(page, button);
  await say(page, caption);
  await unring(page);
  const saved = page.waitForResponse(
    (r) => r.url().includes(`/api/${slug}`) && r.request().method() !== "GET" && r.status() < 400,
    { timeout: 90_000 },
  );
  await button.click();
  await saved;
  await page.waitForTimeout(1200);
}

/** Opens a page of the site and points at the text or element that shows the edit. */
async function seeOnSite(page: Page, sitePath: string, target: (p: Page) => Locator, caption: string) {
  await open(page, sitePath);
  await point(page, target(page).first());
  await say(page, caption, 3600);
  await unring(page);
}

// ---- The videos --------------------------------------------------------------

type Scenario = (page: Page, data: Data, files: Fixtures) => Promise<void>;

/**
 * The title card stays on screen while the admin loads; the admin then opens
 * with the same title as its caption (see record), so a caption is in the
 * picture from the first second on.
 */
const intro = async (page: Page) => {
  await page.waitForTimeout(1500);
  await open(page, "/admin");
  await say(page, title, 1200);
};

const scenarios: Record<string, Scenario> = {
  "01-add-a-class.webm": async (page, { studio }) => {
    await intro(page);
    await openCollection(page, "classes", "Classes are listed under “Classes”. Open it.");
    await createNew(page, "classes", "Click “Create New” to add a class.");
    await say(page, "Give the class a title.", 1800);
    await type(page, page.locator("#field-title"), DEMO.classTitle);
    await say(page, `Choose the studio where the class runs — here ${studio.name}.`, 2200);
    await choose(page, "#field-studio", studio.name);
    await say(page, "Type the price exactly as visitors should see it.", 2000);
    await type(page, page.locator("#field-price"), DEMO.classPrice);
    await say(page, "Add the schedule: one row per session — click “Add” under “Schedule”.", 2600);
    await click(page, (await firstVisible(page, ["#field-sessions .array-field__add-row", "#field-sessions button:has-text('Add')"]))!);
    await say(page, "Pick the weekday and type the time.", 2000);
    await choose(page, "#field-sessions__0__weekday", /monday/i);
    await type(page, page.locator("#field-sessions__0__time"), DEMO.classTime);
    await save(page, "classes", "Click “Save”. The class is on the site right away.");
    await seeOnSite(
      page,
      studio.path,
      (p) => p.getByText(DEMO.classTitle),
      `Here it is on the ${studio.name} page, in the schedule.`,
    );
  },

  "02-change-class-time.webm": async (page, { cls, studio }) => {
    await intro(page);
    await openCollection(page, "classes", "Open “Classes”.");
    await openDoc(page, "classes", cls, "Click the class you want to change.");
    const time = page.locator("#field-sessions__0__time");
    await point(page, time);
    await say(page, "Under “Schedule”, each row is a weekday (or a date) and a time.");
    await say(page, "Type the new time. This is a demo value on a temporary copy of the site.", 2800);
    await type(page, time, DEMO.newTime);
    await say(page, "You can also change the weekday here, or add and remove rows.", 2600);
    await save(page, "classes", "Click “Save” — the site shows the new time right away.");
    await seeOnSite(
      page,
      studio.path,
      (p) => p.getByText(DEMO.newTime),
      `The schedule on the ${studio.name} page now shows the new time.`,
    );
  },

  "03-change-a-price.webm": async (page, { product, cls }) => {
    const price = Number(product.price) + 1;
    await intro(page);
    await openCollection(page, "products", "Shop items are under “Products”. Open it.");
    await openDoc(page, "products", product, "Find the product — the search box helps — and click it.", product.name);
    const field = page.locator("#field-price");
    await point(page, field);
    await say(page, "“Price” is a number, without the $ sign.", 2800);
    await say(page, `For this demo we raise it by one dollar, to ${price}.`, 2600);
    await type(page, field, String(price));
    await save(page, "products", "Click “Save”.");
    await seeOnSite(page, product.path, (p) => p.getByText(new RegExp(`\\$\\s?${price}(\\.00)?(?!\\d)`)), "The product page shows the new price.");
    await open(page, `${listURL("classes")}/${cls.id}`);
    await point(page, page.locator("#field-price"));
    await say(page, "Class prices: open the class under “Classes” and edit “Price” — text, with the $ sign.", 4200);
  },

  "04-replace-a-photo.webm": async (page, { product, photo }, files) => {
    await intro(page);
    await openCollection(page, "media", "All photos of the site are under “Photos”. Open it.");
    await openDoc(page, "media", photo, `Click the photo to replace — here the photo of “${product.name}”.`);
    const remove = (await firstVisible(page, [".file-details__remove", ".file-field button[aria-label*='emove']"]))!;
    await point(page, remove);
    await say(page, "Click the ✕ next to the file to take the old picture out.");
    await unring(page);
    await remove.click();
    const input = page.locator(".file-field input[type=file]").first();
    await input.waitFor({ state: "attached", timeout: 30_000 });
    const drop = await firstVisible(page, [".file-field .dropzone", ".file-field"]);
    if (drop) await point(page, drop);
    await say(page, "Choose the new picture from your computer, or drag it here.");
    await unring(page);
    await input.setInputFiles(files.photo);
    await page.waitForTimeout(1500);
    await say(page, "Describe what is in the picture — Google and screen readers read this text.", 3200);
    await type(page, page.locator("#field-alt"), DEMO.photoAlt);
    await save(page, "media", "Click “Save”. The photo changes everywhere it is used.");
    await seeOnSite(page, product.path, (p) => p.locator("main img"), "The product page now shows the new (demo) picture.");
  },

  "05-upload-a-video.webm": async (page, _data, files) => {
    await intro(page);
    await openCollection(page, "videos", "Videos are under “Videos”. Open it.");
    const note = await firstVisible(page, [".collection-list__sub-header", ".custom-view-description", "text=/Video hosting is not connected/"]);
    if (note) await point(page, note);
    else missing("the note about the video hosting is not on the list of videos");
    await say(page, "This note says video hosting (Mux) is not connected yet: an uploaded file is kept as a placeholder.", 4400);
    await unring(page);
    await createNew(page, "videos", "Click “Create New”.");
    const input = page.locator(".file-field input[type=file]").first();
    await input.waitFor({ state: "attached", timeout: 30_000 });
    const drop = await firstVisible(page, [".file-field .dropzone", ".file-field"]);
    if (drop) await point(page, drop);
    await say(page, "Choose the video file from your computer, or drag it here.");
    await unring(page);
    await input.setInputFiles(files.video);
    await page.waitForTimeout(1500);
    await say(page, "Give the video a title. This one is a short demo clip.", 2600);
    await type(page, page.locator("#field-title"), DEMO.videoTitle);
    await save(page, "videos", "Click “Save” and wait for the upload to finish.");
    const stub = page.locator("#field-placeholderNote").first();
    if (await stub.isVisible()) await point(page, stub);
    await say(page, "Saved. The admin reminds you again that this file is a placeholder until hosting is connected.", 4000);
    await unring(page);
    await say(page, "To show a video on a page, add a “Video” block to that page and pick it there.", 3800);
  },

  "06-edit-page-text.webm": async (page, { page: doc, textBlock }) => {
    await intro(page);
    await openCollection(page, "pages", "Pages are under “Pages”. Open it.");
    await openDoc(page, "pages", doc, "Find the page — here “About Us” — and click it.", "About");
    const editor = page.locator(`#blocks-row-${textBlock} [contenteditable="true"]`).first();
    await point(page, editor);
    await say(page, "A page is made of blocks. This one is a “Text” block: click into it to edit.", 3600);
    await unring(page);
    await editor.click();
    await page.keyboard.press("Control+End");
    await say(page, "Type as in any text editor. Here we add a demo sentence at the end.", 2400);
    await page.keyboard.type(DEMO.pageText, { delay: 30 });
    await page.waitForTimeout(600);
    await say(page, "Select text to make it bold, a heading or a link with the toolbar that appears.", 3000);
    await save(page, "pages", "Click “Save”.");
    await seeOnSite(page, doc.path, (p) => p.getByText(DEMO.pageText.trim()), "The page on the site shows the new text.");
  },

  "07-view-enquiries.webm": async (page, { enquiry }) => {
    await intro(page);
    await openCollection(page, "enquiries", "Messages from the site forms arrive under “Enquiries”. Open it.");
    await say(page, "Newest first. “New” in the status column means nobody has handled it yet.", 3400);
    await openDoc(page, "enquiries", enquiry, "Click an enquiry to read it. This one is a demo message.");
    const answers = await firstVisible(page, ["#field-answers", "#field-email"]);
    if (answers) await point(page, answers);
    await say(page, "Here is what the visitor filled in: their email and the answers to the form’s questions.", 3800);
    await unring(page);
    await say(page, "Reply to them by email as usual, then set the status so you know it is handled.", 3600);
    await choose(page, "#field-status", "Answered");
    await say(page, "“In progress” while you are on it, “Answered” when it is done.", 3000);
    await save(page, "enquiries", "Click “Save”.");
    await open(page, listURL("enquiries"));
    const row = await firstVisible(page, [`tr:has(a[href$="/${enquiry.id}"])`, "tbody tr"]);
    if (row) await point(page, row);
    await say(page, "Back in the list, the enquiry is now marked “Answered”.", 4200);
  },
};

// ---- Recording ---------------------------------------------------------------

async function newContext(browser: Browser, token: string, video?: string): Promise<BrowserContext> {
  const context = await browser.newContext({
    baseURL: base,
    viewport: SIZE,
    locale: "en-US",
    ...(video ? { recordVideo: { dir: video, size: SIZE } } : {}),
  });
  await context.addCookies([{ name: "payload-token", value: token, url: base }]);
  context.setDefaultTimeout(45_000);
  return context;
}

/** A demo picture and a short demo clip, made here: nothing is downloaded and nothing of the studio's is used. */
async function makeFixtures(browser: Browser): Promise<Fixtures> {
  const card = (label: string) =>
    `<body style="margin:0;height:100vh;display:grid;place-items:center;background:#c9a27e;font:700 64px 'Segoe UI',Arial,sans-serif;color:#2b211a">
       <div style="padding:40px 60px;border:6px dashed #2b211a;border-radius:24px;animation:a 1s ease-in-out infinite alternate">${label}</div>
       <style>@keyframes a{to{transform:scale(1.06)}}</style></body>`;
  const photo = path.join(workDir, "demo-photo.png");
  const still = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const stillPage = await still.newPage();
  await stillPage.setContent(card("Demo photo").replace("animation:a", "x:a"));
  await stillPage.screenshot({ path: photo });
  await still.close();

  const clipDir = path.join(workDir, "clip");
  const moving = await browser.newContext({ viewport: { width: 640, height: 360 }, recordVideo: { dir: clipDir, size: { width: 640, height: 360 } } });
  const movingPage = await moving.newPage();
  await movingPage.setContent(card("Demo video"));
  await movingPage.waitForTimeout(3000);
  await moving.close();
  const video = path.join(workDir, "demo-video.webm");
  await movingPage.video()!.saveAs(video);
  return { photo, video };
}

const escapeHTML = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** What a video opens with: its title, in the colours of the captions. */
const titleCard = (heading: string) =>
  `<body style="margin:0;height:100vh;display:grid;place-items:center;background:#181614;font-family:'Segoe UI',system-ui,Arial,sans-serif;text-align:center">
     <div>
       <div style="color:#f2b84b;font-size:22px;font-weight:600;letter-spacing:.12em;text-transform:uppercase">Site admin · how-to video</div>
       <div style="margin:22px auto 0;max-width:1000px;color:#fff;font-size:58px;font-weight:700;line-height:1.2">${escapeHTML(heading)}</div>
     </div>
   </body>`;

/** Opens every screen the videos use once, so the dev server has them compiled before the recording starts. */
async function warmUp(browser: Browser, token: string, data: Data) {
  const context = await newContext(browser, token);
  const page = await context.newPage();
  const urls = [
    "/admin",
    ...["classes", "products", "media", "videos", "pages", "enquiries"].map(listURL),
    `${listURL("classes")}/create`,
    `${listURL("videos")}/create`,
    `${listURL("classes")}/${data.cls.id}`,
    `${listURL("products")}/${data.product.id}`,
    `${listURL("media")}/${data.photo.id}`,
    `${listURL("pages")}/${data.page.id}`,
    `${listURL("enquiries")}/${data.enquiry.id}`,
    data.studio.path,
    data.product.path,
    data.page.path,
  ];
  for (const url of urls) {
    const started = Date.now();
    await page.goto(url, { waitUntil: "load", timeout: 600_000 });
    await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => warn(`${url} keeps loading`));
    log(`warmed ${url} in ${Math.round((Date.now() - started) / 1000)} s`);
  }
  await context.close();
}

async function record(browser: Browser, token: string, video: HowtoVideo, data: Data, files: Fixtures): Promise<string> {
  const dir = path.join(workDir, video.file.replace(/\.webm$/, ""));
  const context = await newContext(browser, token, dir);
  title = `How to ${video.title[0].toLowerCase()}${video.title.slice(1)}`;
  // Until the first step sets its own caption, the caption of every screen is the title of the video.
  await context.addInitScript(
    `try { if (!sessionStorage.getItem('howto-caption')) sessionStorage.setItem('howto-caption', ${JSON.stringify(title)}); } catch (e) {}`,
  );
  await context.addInitScript(OVERLAY);
  const page = await context.newPage();
  startedAt = Date.now();
  await page.setContent(titleCard(title));
  let failure: unknown;
  try {
    await scenarios[video.file](page, data, files);
    await page.waitForTimeout(1200);
  } catch (e) {
    failure = e;
    const shot = path.join(tmpdir(), `howto-failed-${video.file.replace(/\.webm$/, "")}.png`);
    await page.screenshot({ path: shot }).catch(() => undefined);
    warn(`${video.file} failed at ${page.url()} — screenshot: ${shot}`);
  }
  await context.close();
  if (failure) throw failure;
  const out = path.join(workDir, video.file);
  await page.video()!.saveAs(out);
  log(`recorded ${video.file} (${Math.round((Date.now() - startedAt) / 1000)} s)`);
  return out;
}

async function main() {
  const wanted = VIDEOS.filter((v) => !only || only.some((o) => v.file.startsWith(o)));
  if (!wanted.length) throw new Error(`--only ${only?.join(",")} matches no video; the videos are ${VIDEOS.map((v) => v.file).join(", ")}`);
  for (const v of VIDEOS) if (!scenarios[v.file]) throw new Error(`no scenario for ${v.file}`);

  workDir = mkdtempSync(path.join(tmpdir(), "handeye-howto-"));
  let token: string | undefined;
  let browser: Browser | undefined;
  process.on("SIGINT", () => void stopSite(token).then(() => process.exit(130)));
  try {
    if (!external) await startSite();
    token = await signIn();
    if (serveOnly) {
      log(`the temporary site runs at ${base}; Ctrl+C stops it and cleans up`);
      await new Promise(() => undefined);
    }
    const data = await collect(token);
    browser = await chromium.launch({ channel: "chrome" });
    const files = await makeFixtures(browser);
    log("warming up the admin (the dev server compiles each screen on first visit)…");
    await warmUp(browser, token, data);

    const recorded: [HowtoVideo, string][] = [];
    for (const video of wanted) recorded.push([video, await record(browser, token, video, data, files)]);

    // Only a complete set of recordings replaces what is in handover/.
    mkdirSync(path.join(handover, "videos"), { recursive: true });
    for (const [video, file] of recorded) copyFileSync(file, path.join(handover, "videos", video.file));
    writeFileSync(path.join(handover, "README.md"), readme());
  } finally {
    await browser?.close().catch(() => undefined);
    await stopSite(token);
  }

  for (const [file, seconds] of Object.entries(durations(handover))) {
    const size = existsSync(path.join(handover, "videos", file)) ? statSync(path.join(handover, "videos", file)).size : 0;
    log(`${file}: ${seconds === null ? "?" : seconds.toFixed(1)} s, ${(size / 1024 / 1024).toFixed(1)} MB`);
  }
  const problems = checkHandover(handover);
  if (problems.length) throw new Error(`handover/ is not complete:\n- ${problems.join("\n- ")}`);
  log(`done: ${VIDEOS.length} videos and README.md in ${handover}`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(`[howto] FAILED: ${e instanceof Error ? e.stack || e.message : e}`);
    process.exit(1);
  },
);

/**
 * Class dates, orders and the door code over the site's REST API (R01, R10,
 * R12, R33i): what a visitor may read, what only an editor sees, and the seat
 * count of a date after a sale and a hold. Expected figures are written by
 * hand from the old site's drop-downs (content/inventory.json) and the seed's
 * rules: 17 seats for Hand Building, 10 elsewhere.
 */
import { execFile } from "node:child_process";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { assertThrowAwayTarget, editorToken } from "./editor";

const base = () => inject("baseURL");
const root = path.resolve(import.meta.dirname, "../..");

const HAND_BUILDING = "/product-page/hand-building-beginner-to-intermediate";
const WHEEL = "/product-page/6-week-wheel-throwing-pottery-classes-in-vancouver";
const NANAIMO = "/product-page/demystifying-slip-casting-and-marbling-clay";
const DROP_IN = "/product-page/fri-sat-sun-date-night-wheel-seats-sold-separately-bigger-groups-welcome-also";
const APRON = "/product-page/apron";
const NANAIMO_STUDIO = "/nanaimo-pottery-classes";
const CHINATOWN_STUDIO = "/classes/vancouver-chinatown";

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

const list = async (p: string, asEditor = false): Promise<Doc[]> => (await api(p, {}, asEditor)).body.docs || [];
const where = (field: string, value: string | number) => `where[${field}][equals]=${encodeURIComponent(String(value))}`;

async function productId(p: string): Promise<number> {
  const [doc] = await list(`/products?${where("path", p)}&depth=0`);
  expect(doc, p).toBeDefined();
  return doc.id;
}
async function studioId(p: string): Promise<number> {
  const [doc] = await list(`/studios?${where("path", p)}&depth=0`);
  expect(doc, p).toBeDefined();
  return doc.id;
}
const sessionsOf = async (product: number, asEditor = false) =>
  list(`/sessions?${where("product", product)}&limit=0&depth=0`, asEditor);

/** Any edit of tests/site/cms-update.ts: an update, `create` or `remove`, through the Local API. */
async function cms(input: Record<string, unknown>) {
  assertThrowAwayTarget(base());
  const uri = inject("databaseURI");
  if (!uri) throw new Error("with TEST_BASE_URL also set DATABASE_URI to the database of that server");
  await new Promise<void>((resolve, reject) => {
    execFile(
      process.execPath,
      ["--import", "tsx", "tests/site/cms-update.ts"],
      { cwd: root, encoding: "utf8", env: { ...process.env, DATABASE_URI: uri, NODE_OPTIONS: "--no-deprecation", CMS_UPDATE: JSON.stringify(input) } },
      (error, stdout, stderr) => (error ? reject(new Error(`cms-update failed:\n${(stdout + stderr).slice(-2000)}`)) : resolve()),
    );
  });
}

// The first request compiles the API route of the dev server: it takes minutes on a slow machine, so it is not part of a test.
beforeAll(async () => {
  await api("/studios?limit=1&depth=0");
  await api("/sessions?limit=1&depth=0", {}, true);
});

describe("the seed's class dates", () => {
  it("every choice of the Hand Building drop-down became a date with 17 confirmed seats in Chinatown", async () => {
    const product = await productId(HAND_BUILDING);
    const docs = await sessionsOf(product, true);
    expect(docs).toHaveLength(17); // 17 lines in the old drop-down
    expect(docs.map((d) => d.label)).toContain("Thurs 4pm-6:30pm Nov 5-Dec 10 (Mapi)");
    expect(new Set(docs.map((d) => d.seats))).toEqual(new Set([17]));
    expect(new Set(docs.map((d) => d.seatsUnconfirmed))).toEqual(new Set([false]));
    expect(new Set(docs.map((d) => d.studio))).toEqual(new Set([await studioId(CHINATOWN_STUDIO)]));
    const nov = docs.find((d) => d.label === "Thurs 4pm-6:30pm Nov 5-Dec 10 (Mapi)")!;
    expect(nov.startsAt).toBe("2026-11-06T00:00:00.000Z"); // 4pm PST on Nov 5
    expect(nov.weekday).toBe("thursday");
    expect(nov.time).toBe("4pm-6:30pm");
  });

  it("other classes get 10 seats, flagged as not confirmed; Nanaimo classes belong to the Nanaimo studio", async () => {
    const wheel = await sessionsOf(await productId(WHEEL), true);
    expect(wheel).toHaveLength(66);
    expect(new Set(wheel.map((d) => d.seats))).toEqual(new Set([10]));
    expect(new Set(wheel.map((d) => d.seatsUnconfirmed))).toEqual(new Set([true]));
    const nanaimo = await sessionsOf(await productId(NANAIMO), true);
    expect(nanaimo).toHaveLength(26);
    expect(new Set(nanaimo.map((d) => d.studio))).toEqual(new Set([await studioId(NANAIMO_STUDIO)]));
  });

  it("a finished date is closed, a coming one open", async () => {
    const dropIn = await sessionsOf(await productId(DROP_IN), true);
    expect(dropIn.find((d) => d.label === "Thurs wheel Aug 20, 7PM-945PM @739 Gore")?.status).toBe("closed");
    const hand = await sessionsOf(await productId(HAND_BUILDING), true);
    // July 8 is before the floor of the labels' year, so it is July 2027.
    expect(hand.find((d) => d.label === "Thurs 7pm–9:30pm Jul 8–Aug 12 (Mapi)")?.status).toBe("open");
  });

  it("the Date drop-down stays on the product until the page lists the sessions; the other options stay", async () => {
    const [hand] = await list(`/products?${where("path", HAND_BUILDING)}&depth=0`);
    expect((hand.options || []).map((o: Doc) => o.title)).toEqual(["Date"]);
    const [pot] = await list(`/products?${where("path", "/product-page/hanging-plant-pot")}&depth=0`);
    expect(pot.options.map((o: Doc) => o.title)).toEqual(["Glaze Colour"]);
  });

  it("clay and tools are goods, classes are services", async () => {
    const [apron] = await list(`/products?${where("path", APRON)}&depth=0`);
    expect(apron.taxGroup).toBe("goods");
    const [hand] = await list(`/products?${where("path", HAND_BUILDING)}&depth=0`);
    expect(hand.taxGroup).toBe("service");
  });

  it("the four email templates are there, enabled", async () => {
    const docs = await list("/email-templates?limit=0&depth=0", true);
    expect(docs.map((d) => d.key).sort()).toEqual(["class-reminder", "next-course", "order-confirmation", "pieces-ready"]);
    expect(docs.every((d) => d.enabled && d.subject && d.body.includes("{{"))).toBe(true);
  });

  it("the old cart and checkout addresses go to the new cart", async () => {
    for (const from of ["/cart-page", "/checkout"]) {
      const res = await fetch(`${base()}${from}`, { redirect: "manual" });
      expect(res.status, from).toBe(301);
      expect(new URL(res.headers.get("location")!, base()).pathname, from).toBe("/cart");
    }
  });
});

describe("what a visitor may read", () => {
  const CODE = "test-only";
  let studio = 0;
  afterAll(async () => {
    if (studio) await api(`/studios/${studio}`, { method: "PATCH", body: JSON.stringify({ doorCode: null }) }, true);
  });

  it("the door code is for signed-in editors only", async () => {
    studio = await studioId(CHINATOWN_STUDIO);
    const set = await api(`/studios/${studio}`, { method: "PATCH", body: JSON.stringify({ doorCode: CODE }) }, true);
    expect(set.status).toBe(200);
    const asVisitor = await list("/studios?limit=0&depth=0");
    expect(asVisitor.length).toBeGreaterThan(0);
    expect(asVisitor.some((d) => "doorCode" in d)).toBe(false);
    expect(JSON.stringify(asVisitor)).not.toContain(CODE);
    const one = await api(`/studios/${studio}?depth=0`);
    expect(one.body).not.toHaveProperty("doorCode");
    const asEditor = await api(`/studios/${studio}?depth=0`, {}, true);
    expect(asEditor.body.doorCode).toBe(CODE);
  });

  it("hidden dates are not given to a visitor", async () => {
    const product = await productId(HAND_BUILDING);
    const created = await api(
      "/sessions",
      { method: "POST", body: JSON.stringify({ label: "Hidden test date", product, studio: await studioId(CHINATOWN_STUDIO), seats: 5, status: "hidden" }) },
      true,
    );
    expect(created.status).toBe(201);
    const id = created.body.doc.id;
    try {
      expect(await list(`/sessions?${where("label", "Hidden test date")}&depth=0`)).toHaveLength(0);
      expect((await api(`/sessions/${id}`)).status).toBe(404);
      expect(await list(`/sessions?${where("label", "Hidden test date")}&depth=0`, true)).toHaveLength(1);
      const visible = await list("/sessions?limit=0&depth=0");
      expect(visible.length).toBeGreaterThan(100);
      expect(visible.every((d) => d.status !== "hidden")).toBe(true);
    } finally {
      await api(`/sessions/${id}`, { method: "DELETE" }, true);
    }
  });

  it("orders and holds are closed to visitors", async () => {
    for (const p of ["/orders", "/holds", "/registrations", "/subscriptions"]) {
      const res = await api(p);
      expect([401, 403].includes(res.status) || (res.body.docs || []).length === 0, p).toBe(true);
      expect(res.body.docs?.length ?? 0, p).toBe(0);
    }
    expect((await api("/orders", { method: "POST", body: JSON.stringify({ status: "paid" }) }, true)).status).not.toBe(201);
  });
});

describe("seats of a date", () => {
  const EMAIL = "seat-test@example.com";
  afterAll(async () => {
    await cms({ collection: "registrations", where: { email: EMAIL }, remove: true });
    for (const ref of ["seat-test-live", "seat-test-expired"]) await cms({ collection: "holds", where: { ref }, remove: true });
  });

  // Every call of the CMS helper starts a Payload process: slow on Windows, hence the long timeout.
  it("left = seats minus confirmed registrations minus live holds", { timeout: 600_000 }, async () => {
    const product = await productId(HAND_BUILDING);
    const session = (await sessionsOf(product)).find((d) => d.label === "Thurs 4pm-6:30pm Nov 5-Dec 10 (Mapi)")!;
    expect(session.sold).toBe(0);
    expect(session.left).toBe(17);
    const hour = 3_600_000;
    // An editor adds students by hand through the API; holds are written by the server only, so the helper does it.
    for (const status of ["confirmed", "refunded"]) {
      const res = await api("/registrations", { method: "POST", body: JSON.stringify({ session: session.id, name: "Seat Test", email: EMAIL, status }) }, true);
      expect(res.status, status).toBe(201);
    }
    await cms({ collection: "holds", create: { session: session.id, quantity: 2, ref: "seat-test-live", expiresAt: new Date(Date.now() + hour).toISOString() } });
    await cms({ collection: "holds", create: { session: session.id, quantity: 5, ref: "seat-test-expired", expiresAt: new Date(Date.now() - hour).toISOString() } });
    const after = (await api(`/sessions/${session.id}?depth=0`)).body;
    expect(after.sold).toBe(1);
    expect(after.left).toBe(14); // 17 − 1 confirmed − 2 held; the refunded seat and the expired hold do not count
  });
});

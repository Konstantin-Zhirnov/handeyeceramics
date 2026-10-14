/**
 * The CSV exports over the running site (R26i, R09.1): closed to visitors,
 * open to a signed-in editor, who gets the students of a class date and the
 * order lines of a period as text/csv with quotes escaped. The data is made
 * through the editor's REST API; an order, which the API lets nobody create,
 * through the Local API in a separate process (cms-update.ts).
 */
import { execFile } from "node:child_process";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { assertThrowAwayTarget, editorToken } from "./editor";

const base = () => inject("baseURL");
const root = path.resolve(import.meta.dirname, "../..");

const HAND_BUILDING = "/product-page/hand-building-beginner-to-intermediate";
const APRON = "/product-page/apron";
const CHINATOWN_STUDIO = "/classes/vancouver-chinatown";
const STUDENT_EMAIL = "export-student@example.com";
const PAYMENT_ID = "pi_export_test";
const PAID_AT = "2026-10-20T19:05:00.000Z"; // 12:05 in Vancouver, on 2026-10-20

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
async function docOf(collection: string, p: string, asEditor = false): Promise<Doc> {
  const [doc] = (await api(`/${collection}?${where("path", p)}&depth=0`, {}, asEditor)).body.docs || [];
  expect(doc, p).toBeDefined();
  return doc;
}

/** Writes the CMS as the server does, through the Local API in a separate process. */
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

async function csv(p: string, asEditor = false) {
  const res = await fetch(`${base()}${p}`, { headers: asEditor ? await auth() : {} });
  const text = (await res.text()).replace(/^﻿/, "");
  return { status: res.status, type: res.headers.get("content-type") || "", disposition: res.headers.get("content-disposition") || "", lines: text.split("\r\n").filter(Boolean) };
}

// The first requests compile the routes of the dev server: minutes on a slow machine, so not part of a test.
beforeAll(async () => {
  await api("/studios?limit=1&depth=0");
  await fetch(`${base()}/exports/orders.csv`);
  await fetch(`${base()}/exports/registrations.csv`);
}, 600_000);

describe("without signing in", () => {
  it("both exports answer 401", async () => {
    expect((await csv("/exports/orders.csv")).status).toBe(401);
    expect((await csv("/exports/registrations.csv?session=1")).status).toBe(401);
  });
});

describe("as an editor", () => {
  let session = 0;

  afterAll(async () => {
    await cms({ collection: "orders", where: { stripePaymentIntentId: PAYMENT_ID }, remove: true });
    await cms({ collection: "registrations", where: { email: STUDENT_EMAIL }, remove: true });
    if (session) await api(`/sessions/${session}`, { method: "DELETE" }, true);
  }, 600_000);

  it("the students of a date, quotes and commas escaped; a date that does not exist is 404", { timeout: 600_000 }, async () => {
    const product = (await docOf("products", HAND_BUILDING)).id;
    const studio = (await docOf("studios", CHINATOWN_STUDIO)).id;
    const created = await api(
      "/sessions",
      { method: "POST", body: JSON.stringify({ label: "Export test date", product, studio, seats: 3, status: "hidden" }) },
      true,
    );
    expect(created.status).toBe(201);
    session = created.body.doc.id;
    // Added by hand, without a status: such a student is "imported".
    const reg = await api(
      "/registrations",
      { method: "POST", body: JSON.stringify({ session, product, studio, name: 'O\'Brien, "Pat"', email: STUDENT_EMAIL, phone: "604-000-0000" }) },
      true,
    );
    expect(reg.status).toBe(201);

    const res = await csv(`/exports/registrations.csv?session=${session}`, true);
    expect(res.status).toBe(200);
    expect(res.type).toMatch(/^text\/csv/);
    expect(res.disposition).toMatch(/^attachment; filename="registrations-\d+\.csv"$/);
    expect(res.lines).toEqual(["name,email,phone,status,order_number,paid_at", `"O'Brien, ""Pat""",${STUDENT_EMAIL},604-000-0000,imported,,`]);

    expect((await csv("/exports/registrations.csv", true)).status).toBe(404);
    expect((await csv("/exports/registrations.csv?session=99999999", true)).status).toBe(404);
  });

  it("the order lines of a period: one row per line, GST and PST apart", { timeout: 600_000 }, async () => {
    const studio = await docOf("studios", CHINATOWN_STUDIO);
    const apron = (await docOf("products", APRON)).id;
    await cms({
      collection: "orders",
      create: {
        status: "paid",
        paidAt: PAID_AT,
        customer: { name: "Ada Export", email: "export-order@example.com" },
        pickupStudio: studio.id,
        lines: [
          { kind: "session", session, label: "Hand building — export date", quantity: 1, unitAmount: 10000, taxGroup: "service", taxAmount: 500 },
          { kind: "product", product: apron, label: "Apron", option: "Colour: blue", quantity: 2, unitAmount: 1234, taxGroup: "goods", taxAmount: 296, lineTotal: 2764 },
        ],
        subtotal: 12468,
        tax: 796,
        total: 13264,
        currency: "cad",
        stripePaymentIntentId: PAYMENT_ID,
      },
    });
    const [order] = (await api(`/orders?${where("stripePaymentIntentId", PAYMENT_ID)}&depth=0`, {}, true)).body.docs || [];
    expect(order?.number).toMatch(/^HE-\d{6}$/);

    const inPeriod = await csv("/exports/orders.csv?from=2026-10-20&to=2026-10-20", true);
    expect(inPeriod.status).toBe(200);
    expect(inPeriod.type).toMatch(/^text\/csv/);
    expect(inPeriod.disposition).toMatch(/^attachment; filename="orders-2026-10-20-2026-10-20\.csv"$/);
    expect(inPeriod.lines[0]).toBe("order_number,paid_at,status,customer_email,kind,label,option,qty,unit_price,gst,pst,line_total,pickup_studio,stripe_payment_id,tax_check");
    const studioCell = /[",]/.test(studio.name) ? `"${studio.name.replace(/"/g, '""')}"` : studio.name;
    expect(inPeriod.lines.filter((l) => l.startsWith(order.number))).toEqual([
      `${order.number},${PAID_AT},paid,export-order@example.com,class,Hand building — export date,,1,100.00,5.00,0.00,105.00,${studioCell},${PAYMENT_ID},`,
      `${order.number},${PAID_AT},paid,export-order@example.com,merch,Apron,Colour: blue,2,12.34,1.23,1.73,27.64,${studioCell},${PAYMENT_ID},`,
    ]);

    const after = await csv("/exports/orders.csv?from=2026-10-21", true);
    expect(after.status).toBe(200);
    expect(after.lines.some((l) => l.startsWith(order.number))).toBe(false);

    expect((await csv("/exports/orders.csv?from=yesterday", true)).status).toBe(400);
  });
});

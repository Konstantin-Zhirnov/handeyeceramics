/**
 * A throw-away CMS for the unit tests of booking and payments: a SQLite file in
 * the temp folder, the fake gateway, no external services. The environment is
 * set before the Payload config is imported, so the library code — which loads
 * the config lazily — shares this very database with the test.
 * Not a test itself.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Payload } from "payload";

export type TempCMS = { payload: Payload; stop: () => Promise<void> };

export async function tempCMS(): Promise<TempCMS> {
  const dir = mkdtempSync(path.join(tmpdir(), "handeye-unit-"));
  Object.assign(process.env, {
    DATABASE_URI: `file:${path.join(dir, "test.db").replace(/\\/g, "/")}`,
    PAYMENT_GATEWAY: "fake",
    STRIPE_SECRET_KEY: "",
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || "whsec_unit_test_secret",
    BLOB_READ_WRITE_TOKEN: "",
    MUX_TOKEN_ID: "",
    MUX_TOKEN_SECRET: "",
    SMTP_HOST: "",
    SITE_ENV: "",
    NODE_ENV: "test",
  });
  const [{ getPayload }, { default: config }] = await Promise.all([import("payload"), import("../../payload.config")]);
  const payload = await getPayload({ config });
  return {
    payload,
    stop: async () => {
      await payload.destroy();
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* the database file may still be locked for a moment on Windows */
      }
    },
  };
}

export type ClassDate = { studioId: number; productId: number; sessionId: number };

/** A studio in BC, a class product and one date of it with the given seats. */
export async function seedClassDate(payload: Payload, seats: number, suffix = ""): Promise<ClassDate> {
  const studio = await payload.create({
    collection: "studios",
    data: { name: `Test studio${suffix}`, path: `/test-studio${suffix}`, status: "open", region: "Vancouver, BC", address: "1 Test St\nVancouver, BC V6A 1A1", published: true },
    overrideAccess: true,
    depth: 0,
  });
  const product = await payload.create({
    collection: "products",
    data: { name: `Test class${suffix}`, path: `/test-class${suffix}`, price: 100, visible: true, taxGroup: "service" },
    overrideAccess: true,
    depth: 0,
  });
  const session = await payload.create({
    collection: "sessions",
    data: { label: `Test date${suffix}`, product: product.id, studio: studio.id, seats, status: "open" },
    overrideAccess: true,
    depth: 0,
    context: { skipAvailability: true },
  });
  return { studioId: studio.id, productId: product.id, sessionId: session.id };
}

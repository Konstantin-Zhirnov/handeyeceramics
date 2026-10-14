/**
 * The gate of GET /cron/daily (R19i): no CRON_SECRET in the environment —
 * 503, the job is off; a missing or wrong bearer — 401. Neither case reaches
 * the CMS, so the handler is called directly without a database.
 */
import { afterEach, expect, it, vi } from "vitest";
import { GET } from "../../app/(site)/cron/daily/route";

const call = (authorization?: string) =>
  GET(new Request("http://localhost:3210/cron/daily", { headers: authorization ? { authorization } : {} }));

afterEach(() => vi.unstubAllEnvs());

it("answers 503 when the secret is not configured", async () => {
  vi.stubEnv("CRON_SECRET", "");
  const res = await call("Bearer anything");
  expect(res.status).toBe(503);
  expect(await res.json()).toMatchObject({ ok: false });
});

it("answers 401 without the header, with another scheme, or with a wrong secret", async () => {
  vi.stubEnv("CRON_SECRET", "unit-test-cron-secret");
  for (const header of [undefined, "unit-test-cron-secret", "Basic unit-test-cron-secret", "Bearer wrong", "Bearer unit-test-cron-secret-and-more"]) {
    const res = await call(header);
    expect(res.status, String(header)).toBe(401);
    expect(await res.json()).toMatchObject({ ok: false });
  }
});

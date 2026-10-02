/**
 * The address the site is served from. In production a missing
 * NEXT_PUBLIC_SERVER_URL must stop the server with a message that names the
 * variable, not fall back to somebody else's address.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { serverURL } from "../../lib/server-url";

describe("serverURL", () => {
  it("is the configured address, without a trailing slash", () => {
    expect(serverURL({ NEXT_PUBLIC_SERVER_URL: "https://example.test/", NODE_ENV: "production" })).toBe("https://example.test");
  });

  it("falls back to this machine in development, on the port the server listens on", () => {
    expect(serverURL({ NODE_ENV: "development" })).toBe("http://localhost:3210");
    expect(serverURL({ NODE_ENV: "development", PORT: "4000" })).toBe("http://localhost:4000");
  });

  it("refuses to start in production without the variable", () => {
    expect(() => serverURL({ NODE_ENV: "production" })).toThrow(/NEXT_PUBLIC_SERVER_URL/);
    expect(() => serverURL({ SITE_ENV: "production", NODE_ENV: "development" })).toThrow(/NEXT_PUBLIC_SERVER_URL/);
  });

  it("lets the production build itself run without it", () => {
    expect(serverURL({ NODE_ENV: "production", NEXT_PHASE: "phase-production-build" })).toBe("http://localhost:3210");
  });

  it("is marked required in .env.example", () => {
    const lines = readFileSync(path.resolve(import.meta.dirname, "../../.env.example"), "utf8").split("\n");
    const at = lines.findIndex((l) => l.startsWith("NEXT_PUBLIC_SERVER_URL="));
    expect(at).toBeGreaterThan(0);
    // The comment right above the variable, up to the previous variable.
    let from = at;
    while (from > 0 && lines[from - 1].startsWith("#")) from--;
    expect(lines.slice(from, at).join(" ")).toMatch(/required in production/i);
  });
});

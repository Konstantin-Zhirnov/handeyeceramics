/**
 * The teacher contacts page's password: what a student may type, and the
 * cookie that stops opening the page the moment the owner changes the password.
 */
import { describe, expect, it } from "vitest";
import { passwordMatches, teachersToken, tokenOpens } from "../../lib/teachers";

const SECRET = "unit-test-secret";

describe("passwordMatches", () => {
  it("forgives spaces and letter case, nothing else", () => {
    expect(passwordMatches("  Clay2026 ", "clay2026")).toBe(true);
    expect(passwordMatches("clay2025", "clay2026")).toBe(false);
    expect(passwordMatches("clay", "clay2026")).toBe(false);
  });

  it("opens nothing while the owner has not set a password", () => {
    expect(passwordMatches("", "")).toBe(false);
    expect(passwordMatches("anything", null)).toBe(false);
  });
});

describe("tokenOpens", () => {
  it("lets the cookie of the current password in", () => {
    expect(tokenOpens(teachersToken("Clay2026", SECRET), "clay2026", SECRET)).toBe(true);
  });

  it("shuts every old cookie out once the password changes", () => {
    expect(tokenOpens(teachersToken("clay2026", SECRET), "glaze2027", SECRET)).toBe(false);
  });

  it("is bound to the site's secret and refuses an empty or forged cookie", () => {
    expect(tokenOpens(teachersToken("clay2026", "another-site"), "clay2026", SECRET)).toBe(false);
    expect(tokenOpens("", "clay2026", SECRET)).toBe(false);
    expect(tokenOpens(undefined, "clay2026", SECRET)).toBe(false);
    expect(tokenOpens(teachersToken("", SECRET), "", SECRET)).toBe(false);
  });
});

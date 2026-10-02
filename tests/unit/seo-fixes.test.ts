/**
 * Story 8: every finding of the crawl has its line in the report of fixes.
 * (That the fixes are really on the pages — one H1, a description, unique
 * titles — is checked against the running site in tests/site/inventory.test.ts.)
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");
const issues: { path: string; issues: unknown[] }[] = JSON.parse(readFileSync(path.join(root, "content/crawl-issues.json"), "utf8"));
const rows = readFileSync(path.join(root, "content/seo-fixes.md"), "utf8")
  .split("\n")
  .map((l) => l.match(/^\| `([^`]+)` \| (.*?) \| (.*?) \|\s*$/))
  .filter((m): m is RegExpMatchArray => !!m)
  .map(([, p, finding, done]) => ({ path: p, finding: finding.trim(), done: done.trim() }));

it("the report of SEO fixes has a line for every finding of the crawl", () => {
  expect(issues.reduce((n, p) => n + p.issues.length, 0)).toBe(74); // the count the crawl reported
  for (const page of issues) {
    expect(rows.filter((r) => r.path === page.path).length, page.path).toBe(page.issues.length);
  }
  expect(rows).toHaveLength(74);
});

it("and no line is left without a fix", () => {
  for (const r of rows) {
    expect(r.finding, r.path).not.toBe("");
    expect(r.done, r.path).not.toBe("");
    expect(r.done, r.path).not.toMatch(/TBD|TODO|не исправлен/i);
  }
});

/**
 * Lighthouse (mobile preset, Performance only) on the templates of the site,
 * several runs each; prints a Markdown table with every run and the median.
 * Local runs are noisy — the median of three is what goes to content/lighthouse.md.
 *
 *   node scripts/lighthouse.mjs http://localhost:3220 [runs=3] [name=/path …]
 *
 * The server must be a production build (`npm run build`, then `next start`)
 * on a database seeded with images.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const [base, ...rest] = process.argv.slice(2);
if (!base) {
  console.error("usage: node scripts/lighthouse.mjs <base URL> [runs] [name=/path …]");
  process.exit(1);
}
const runs = /^\d+$/.test(rest[0] || "") ? Number(rest.shift()) : 3;
const targets = (rest.length
  ? rest
  : [
      "home=/",
      "studio=/nanaimo-pottery-classes",
      "page=/about-us",
      "shop=/shop",
      "product=/product-page/gift-card",
    ]
).map((t) => t.split("="));

// LH_CPU=<n> replaces the preset's 4x CPU slowdown — for a second, clearly labelled
// measurement on a slow machine. The figure that counts is the one without it.
const cpu = process.env.LH_CPU ? [`--throttling.cpuSlowdownMultiplier=${Number(process.env.LH_CPU)}`] : [];
const benchmarks = [];
const warnings = new Set();

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const dir = mkdtempSync(path.join(tmpdir(), "lighthouse-"));
const rows = [];

for (const [name, p] of targets) {
  const seen = [];
  for (let i = 0; i < runs; i++) {
    const out = path.join(dir, `${name}-${i}.json`);
    const res = spawnSync(
      "npx",
      ["--yes", "lighthouse", `"${base}${p}"`, "--only-categories=performance", "--output=json", `--output-path="${out}"`, "--quiet", '--chrome-flags="--headless=new --no-sandbox"', ...cpu],
      { shell: true, encoding: "utf8" },
    );
    if (res.status !== 0) {
      console.error(`lighthouse failed on ${p}:\n${(res.stdout + res.stderr).slice(-1500)}`);
      process.exit(1);
    }
    const report = JSON.parse(readFileSync(out, "utf8"));
    const audit = (id) => report.audits[id].numericValue;
    if (report.environment?.benchmarkIndex) benchmarks.push(report.environment.benchmarkIndex);
    for (const w of report.runWarnings || []) warnings.add(w);
    seen.push({
      score: Math.round(report.categories.performance.score * 100),
      fcp: audit("first-contentful-paint"),
      lcp: audit("largest-contentful-paint"),
      tbt: audit("total-blocking-time"),
      cls: audit("cumulative-layout-shift"),
    });
  }
  const m = (key) => median(seen.map((s) => s[key]));
  rows.push(
    `| ${name} | \`${p}\` | ${seen.map((s) => s.score).join(", ")} | **${m("score")}** | ${(m("fcp") / 1000).toFixed(1)} s | ${(m("lcp") / 1000).toFixed(1)} s | ${Math.round(m("tbt"))} ms | ${m("cls").toFixed(3)} |`,
  );
  console.error(`${name} ${p}: ${seen.map((s) => s.score).join(", ")}`);
}
rmSync(dir, { recursive: true, force: true });

console.log("| Template | Path | Runs | Median | FCP | LCP | TBT | CLS |");
console.log("|---|---|---|---|---|---|---|---|");
console.log(rows.join("\n"));
// How fast the machine itself is, as Lighthouse measures it; and what Lighthouse had to say about the run.
if (benchmarks.length) console.log(`\nCPU slowdown: ${process.env.LH_CPU || "4 (preset)"}x · host benchmarkIndex, median: ${Math.round(median(benchmarks))}`);
for (const w of warnings) console.log(`Lighthouse warning: ${w}`);

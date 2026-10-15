/**
 * npm run stripe:setup — prepares the Stripe account of STRIPE_SECRET_KEY for the
 * site: a Product and a monthly CAD Price for every subscription plan (period says
 * "month", price set), written back to `plans.stripePriceId`; idempotent, so the
 * same command runs on the client's account after the move (R14).
 *
 *   --webhook <url>       create the webhook endpoint for <url> with the site's events
 *                         (an existing endpoint for the url is reused; its secret is
 *                         never shown again by Stripe)
 *   --secret-file <path>  write the new endpoint's signing secret (whsec_…) into <path>
 *   --write-env           put it as STRIPE_WEBHOOK_SECRET into .env.development.local
 *   --dry-run             report what would change; nothing is created or written
 *
 * The secret itself is never printed: only its first characters, plus where it went.
 * The database is the one of DATABASE_URI (.env = staging; pass DATABASE_URI in the
 * process environment for the local SQLite file).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import Stripe from "stripe";
import { getPayload } from "payload";
import config from "../../payload.config";
import { ensureWebhookEndpoint, subscriptionPlans, syncPlan, type SyncResult } from "./plans";
import { formatPrice } from "../../lib/cms/text";

type Args = { webhook?: string; dryRun: boolean; secretFile?: string; writeEnv: boolean };

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false, writeEnv: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--write-env") args.writeEnv = true;
    else if (a === "--webhook") args.webhook = argv[++i];
    else if (a === "--secret-file") args.secretFile = argv[++i];
    else if (a.startsWith("--webhook=")) args.webhook = a.slice("--webhook=".length);
    else if (a.startsWith("--secret-file=")) args.secretFile = a.slice("--secret-file=".length);
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (args.webhook && !/^https?:\/\//.test(args.webhook)) throw new Error("--webhook needs a full URL, e.g. https://example.com/stripe/webhook");
  return args;
}

const ENV_FILE = ".env.development.local";

/** Sets STRIPE_WEBHOOK_SECRET in the local env file: replaces the line if present, appends otherwise. */
function writeEnvSecret(secret: string) {
  const line = `STRIPE_WEBHOOK_SECRET=${secret}`;
  const current = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
  const lines = current.split(/\r?\n/);
  const at = lines.findIndex((l) => /^STRIPE_WEBHOOK_SECRET=/.test(l));
  if (at >= 0) lines[at] = line;
  else {
    if (lines.length && lines[lines.length - 1] === "") lines.pop();
    lines.push(line);
  }
  writeFileSync(ENV_FILE, lines.join("\n") + "\n");
}

const mask = (secret: string) => `${secret.slice(0, 6)}… (${secret.length} characters)`;

function printPlans(rows: SyncResult[], dryRun: boolean) {
  if (!rows.length) {
    console.log("No subscription plans: a plan is one whose period contains “month” and that has a price.");
    return;
  }
  const state = (r: SyncResult) => {
    const made = [r.created.product && "product", r.created.price && "price"].filter(Boolean).join(" + ");
    return made ? (dryRun ? `would create ${made}` : `created ${made}`) : "reused";
  };
  console.table(rows.map((r) => ({ plan: r.name, amount: `${formatPrice(r.unitAmount / 100)}/month`, product: r.productId, price: r.priceId, state: state(r) })));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set in the environment");
  const mode = key.startsWith("sk_test_") || key.startsWith("rk_test_") ? "test" : "live";
  console.log(`stripe:setup — Stripe account in ${mode} mode${args.dryRun ? " (dry run)" : ""}`);

  const client = new Stripe(key);
  const payload = await getPayload({ config });

  const all = await payload.find({ collection: "plans", limit: 500, sort: "order", depth: 0 });
  const plans = subscriptionPlans(all.docs);
  const rows: SyncResult[] = [];
  let written = 0;
  for (const plan of plans) {
    const row = await syncPlan(client, plan, { dryRun: args.dryRun });
    rows.push(row);
    if (!args.dryRun && plan.stripePriceId !== row.priceId) {
      await payload.update({ collection: "plans", id: plan.id, data: { stripePriceId: row.priceId }, depth: 0 });
      written++;
    }
  }
  printPlans(rows, args.dryRun);
  console.log(`${rows.length} subscription plans of ${all.docs.length}; stripePriceId written for ${written}${args.dryRun ? " (dry run: none written)" : ""}`);

  if (args.webhook) {
    const ep = await ensureWebhookEndpoint(client, args.webhook, { dryRun: args.dryRun });
    if (ep.created && args.dryRun) console.log(`webhook: would create an endpoint for ${ep.url}`);
    else if (ep.created) console.log(`webhook: created endpoint ${ep.id} for ${ep.url}`);
    else console.log(`webhook: endpoint ${ep.id} for ${ep.url} already exists${ep.eventsUpdated ? "; missing events added" : ""} — Stripe shows its secret only once; roll it in the Dashboard if it was lost`);
    if (ep.secret) {
      console.log(`webhook: signing secret ${mask(ep.secret)} — set it as STRIPE_WEBHOOK_SECRET where the site runs (Vercel env, .env.development.local)`);
      if (args.secretFile) {
        writeFileSync(args.secretFile, ep.secret + "\n");
        console.log(`webhook: secret written to ${args.secretFile}`);
      }
      if (args.writeEnv) {
        writeEnvSecret(ep.secret);
        console.log(`webhook: STRIPE_WEBHOOK_SECRET written to ${ENV_FILE}`);
      }
      if (!args.secretFile && !args.writeEnv) console.log("webhook: the full secret was not stored anywhere — rerun is impossible; pass --secret-file <path> or --write-env next time");
    }
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

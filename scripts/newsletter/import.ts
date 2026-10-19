/**
 * npm run newsletter:import -- <wix-contacts.csv> [<part2.csv> …] [options] —
 * moves the Wix email subscribers onto the Mailchimp list of
 * MAILCHIMP_API_KEY / MAILCHIMP_AUDIENCE_ID, each tagged with the city of
 * their studio.
 *
 *   --tags "Nanaimo=Nanaimo,Lantzville=Nanaimo,Vancouver=Vancouver,Burnaby=Vancouver"
 *              city of the contact → tag; a city not listed gets no tag (the dry run counts them)
 *   --dry-run  read and count only; nothing is sent
 *
 * Only contacts Wix shows as "Subscribed" are moved, as subscribed. An address
 * already on the list is left as it is (an unsubscribe there stays). The
 * export holds the studio's customers: keep it outside the working copy and
 * delete it after the import. The environment is the one `next dev` sees:
 * .env, then .env.development.local.
 */
import { readFileSync } from "node:fs";
import { mailchimp, mailchimpConfig } from "../../lib/newsletter/mailchimp";
import { parseCityTags, parseCsv, wixSubscribers } from "./wix";

const BATCH = 500;

function parseArgs(argv: string[]) {
  const files: string[] = [];
  let tags: string | undefined;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") dryRun = true;
    else if (a === "--tags") tags = argv[++i];
    else if (a.startsWith("--tags=")) tags = a.slice("--tags=".length);
    else if (a.startsWith("--")) throw new Error(`Unknown argument: ${a}`);
    else files.push(a);
  }
  if (!files.length) throw new Error("Give the path of the Wix Contacts export (CSV).");
  return { files, tags, dryRun };
}

const chunks = <T>(list: T[], n: number) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const read = wixSubscribers(
    args.files.map((f) => parseCsv(readFileSync(f, "utf8"))),
    parseCityTags(args.tags),
  );
  const byTag = new Map<string, number>();
  for (const s of read.subscribers) if (s.tag) byTag.set(s.tag, (byTag.get(s.tag) || 0) + 1);
  console.log(`Rows: ${read.rows}. Subscribed and to move: ${read.subscribers.length}. Not subscribed: ${read.notSubscribed}. Bad email: ${read.noEmail}. Repeated: ${read.duplicates}.`);
  console.log("Wix statuses:", Object.fromEntries(read.statuses));
  console.log("Tags:", Object.fromEntries(byTag));
  const untagged = [...read.untaggedCities].sort((a, b) => b[1] - a[1]).slice(0, 25);
  if (untagged.length) console.log("Cities without a tag (top 25):", Object.fromEntries(untagged));

  const cfg = mailchimpConfig();
  if (args.dryRun) return console.log("Dry run: nothing sent.");
  if (!cfg) throw new Error("MAILCHIMP_API_KEY and MAILCHIMP_AUDIENCE_ID are needed (in .env.development.local).");

  let added = 0;
  const failed: string[] = [];
  for (const part of chunks(read.subscribers, BATCH)) {
    const res = await mailchimp<{ new_members: unknown[]; errors: { email_address: string; error: string }[] }>(cfg, "POST", `/lists/${cfg.audienceId}`, {
      update_existing: false,
      members: part.map((s) => ({
        email_address: s.email,
        status: "subscribed",
        merge_fields: { ...(s.firstName ? { FNAME: s.firstName } : {}), ...(s.lastName ? { LNAME: s.lastName } : {}) },
      })),
    });
    added += res.new_members.length;
    for (const e of res.errors) if (!/already a list member/i.test(e.error)) failed.push(`${e.email_address}: ${e.error}`);
  }
  console.log(`Added to Mailchimp: ${added}. Refused: ${failed.length}.`);
  if (failed.length) console.log(failed.slice(0, 20).join("\n"));

  const { segments } = await mailchimp<{ segments: { id: number; name: string }[] }>(cfg, "GET", `/lists/${cfg.audienceId}/segments?type=static&count=1000&fields=segments.id,segments.name`);
  for (const [tag, count] of byTag) {
    let id = segments.find((s) => s.name === tag)?.id;
    if (!id) id = (await mailchimp<{ id: number }>(cfg, "POST", `/lists/${cfg.audienceId}/segments`, { name: tag, static_segment: [] })).id;
    const emails = read.subscribers.filter((s) => s.tag === tag).map((s) => s.email);
    for (const part of chunks(emails, BATCH)) await mailchimp(cfg, "POST", `/lists/${cfg.audienceId}/segments/${id}`, { members_to_add: part });
    console.log(`Tag "${tag}": ${count}.`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

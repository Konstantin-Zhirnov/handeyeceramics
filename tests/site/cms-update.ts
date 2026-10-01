/**
 * What the owner does in the admin, done from a test: updates documents through
 * Payload's Local API, in the database of the running site (DATABASE_URI).
 * Input — the CMS_UPDATE variable: {"collection", "where": {field: value}, "data"}.
 * Run by tests/site/studios.test.ts; not a test itself.
 */
import { getPayload } from "payload";
import config from "../../payload.config";

const { collection, where, data } = JSON.parse(process.env.CMS_UPDATE || "{}");
const payload = await getPayload({ config });
const res = await payload.update({
  collection,
  where: Object.fromEntries(Object.entries(where).map(([field, value]) => [field, { equals: value }])),
  data,
  depth: 0,
} as never);
const count = (res as unknown as { docs: unknown[] }).docs.length;
if (!count) {
  console.error(`cms-update: nothing in ${collection} matches ${JSON.stringify(where)}`);
  process.exit(1);
}
console.log(`cms-update: ${count} in ${collection}`);
process.exit(0);

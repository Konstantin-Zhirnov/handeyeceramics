/**
 * What the owner does in the admin, done from a test: updates documents through
 * Payload's Local API, in the database of the running site (DATABASE_URI).
 * Input — the CMS_UPDATE variable: {"collection", "where": {field: value}, "data"};
 * {"collection", "create": data} adds a document, {"collection", "where", "remove": true} deletes.
 * Run by tests/site/studios.test.ts; not a test itself.
 */
import { getPayload } from "payload";
import config from "../../payload.config";

const { collection, where, data, create, remove } = JSON.parse(process.env.CMS_UPDATE || "{}");
const payload = await getPayload({ config });
const match = () =>
  Object.fromEntries(Object.entries(where as Record<string, string>).map(([field, value]) => [field, { equals: value }]));
if (create) {
  await payload.create({ collection, data: create, depth: 0 } as never);
  console.log(`cms-update: created in ${collection}`);
  process.exit(0);
}
if (remove) {
  await payload.delete({ collection, where: match(), depth: 0 } as never);
  console.log(`cms-update: removed from ${collection}`);
  process.exit(0);
}
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

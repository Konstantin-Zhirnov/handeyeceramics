/**
 * What the owner does in the admin, done from a test: updates documents through
 * Payload's Local API, in the database of the running site (DATABASE_URI).
 * Input — the CMS_UPDATE variable: {"collection", "where": {field: value}, "data"};
 * {"collection", "create": data} adds a document, {"collection", "where", "remove": true} deletes.
 * Run by tests/site/studios.test.ts; not a test itself.
 */
import { tmpdir } from "node:os";
import path from "node:path";
import { getPayload } from "payload";

// Refuses any database but a throw-away one: a SQLite file in the temp folder, or one you vouch for with TEST_TEMP_DB=1.
const uri = process.env.DATABASE_URI || "";
const file = uri.startsWith("file:") ? path.resolve(uri.slice(5)).toLowerCase() : "";
const inTemp = file !== "" && file.startsWith(path.resolve(tmpdir()).toLowerCase() + path.sep);
const server = new URL(process.env.TEST_BASE_URL || "http://localhost").hostname;
if (!["localhost", "127.0.0.1"].includes(server) || (!inTemp && process.env.TEST_TEMP_DB !== "1")) {
  console.error("cms-update: refusing to edit a database that is not a throw-away test database (set TEST_TEMP_DB=1 on localhost)");
  process.exit(2);
}
const { default: config } = await import("../../payload.config");

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

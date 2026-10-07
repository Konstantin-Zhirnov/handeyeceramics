/**
 * Collapse duplicated pictures in the media collection to one document each.
 *
 * Storage renames an upload whose name is taken (`wheel-spin-7.jpg`), and the
 * seed used to miss the earlier document and upload the picture again. This
 * script groups media by source name (scripts/seed/media-key.ts), keeps one
 * document per picture — a referenced one over an unreferenced one, the newest
 * among equals — re-points every reference in collections and globals to it
 * and deletes the rest, files included.
 *
 * Dry run (report only):
 *   npx cross-env PAYLOAD_SECRET=one-off node --env-file=.env --import tsx scripts/dedupe-media.mts
 * Apply (writes a JSON backup of every document to backups/ first):
 *   ... scripts/dedupe-media.mts --apply
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getPayload } from "payload";
import type { Block, Field } from "payload";
import config from "../payload.config";
import { pickMedia, sourceName } from "./seed/media-key";

type MediaDoc = { id: number; filename?: string | null; createdAt: string };
type Doc = Record<string, unknown> & { id: number | string };
type Visit = (id: number) => number; // returns the id to store

const apply = process.argv.includes("--apply");
const payload = await getPayload({ config });

// ---- walking documents by their field config ------------------------------

function isMediaRelation(relationTo: unknown): boolean {
  return relationTo === "media" || (Array.isArray(relationTo) && relationTo.includes("media"));
}

/** Applies `visit` to every media id stored under `fields` in `data`; mutates `data`. */
function walkFields(fields: Field[], data: Record<string, unknown> | undefined, visit: Visit): void {
  if (!data) return;
  for (const f of fields) {
    switch (f.type) {
      case "row":
      case "collapsible":
        walkFields(f.fields, data, visit);
        break;
      case "tabs":
        for (const tab of f.tabs) {
          if ("name" in tab && tab.name) walkFields(tab.fields, data[tab.name] as Record<string, unknown>, visit);
          else walkFields(tab.fields, data, visit);
        }
        break;
      case "group":
        if ("name" in f && f.name) walkFields(f.fields, data[f.name] as Record<string, unknown>, visit);
        else walkFields(f.fields, data, visit);
        break;
      case "array":
        for (const item of (data[f.name] as Record<string, unknown>[] | undefined) ?? []) walkFields(f.fields, item, visit);
        break;
      case "blocks": {
        const blocks = f.blocks as Block[];
        for (const item of (data[f.name] as Record<string, unknown>[] | undefined) ?? []) {
          const block = blocks.find((b) => b.slug === item.blockType);
          if (block) walkFields(block.fields, item, visit);
        }
        break;
      }
      case "upload":
      case "relationship":
        if (isMediaRelation(f.relationTo)) data[f.name] = visitRelation(data[f.name], f.relationTo, visit);
        break;
      case "richText":
        walkRichText(data[f.name], visit);
        break;
      default:
        break;
    }
  }
}

function visitRelation(value: unknown, relationTo: unknown, visit: Visit): unknown {
  if (Array.isArray(value)) return value.map((v) => visitRelation(v, relationTo, visit));
  if (typeof value === "number") return visit(value);
  if (value && typeof value === "object") {
    const v = value as { relationTo?: string; value?: unknown; id?: number };
    if (v.relationTo && "value" in v) {
      if (v.relationTo !== "media") return value;
      return { ...v, value: typeof v.value === "number" ? visit(v.value) : v.value };
    }
    if (typeof v.id === "number" && relationTo === "media") return visit(v.id);
  }
  return value;
}

/** Lexical upload nodes: `{ type: "upload", relationTo: "media", value: id | { id } }`. */
function walkRichText(node: unknown, visit: Visit): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const n of node) walkRichText(n, visit);
    return;
  }
  const n = node as Record<string, unknown>;
  if (n.type === "upload" && n.relationTo === "media") {
    if (typeof n.value === "number") n.value = visit(n.value);
    else if (n.value && typeof n.value === "object" && typeof (n.value as { id?: unknown }).id === "number")
      n.value = visit((n.value as { id: number }).id);
  }
  for (const v of Object.values(n)) if (v && typeof v === "object") walkRichText(v, visit);
}

// ---- load everything --------------------------------------------------------

const collections = Object.values(payload.collections)
  .map((c) => c.config)
  .filter((c) => c.slug !== "media");
const globals = payload.globals.config;

const snapshot: { collections: Record<string, Doc[]>; globals: Record<string, Doc> } = { collections: {}, globals: {} };
for (const c of collections) {
  const res = await payload.find({ collection: c.slug, limit: 0, pagination: false, depth: 0, overrideAccess: true });
  snapshot.collections[c.slug] = res.docs as Doc[];
}
for (const g of globals) snapshot.globals[g.slug] = (await payload.findGlobal({ slug: g.slug, depth: 0, overrideAccess: true })) as Doc;
const mediaAll = (await payload.find({ collection: "media", limit: 0, pagination: false, depth: 0 })).docs as MediaDoc[];
snapshot.collections.media = mediaAll as unknown as Doc[];

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

// Pass 1: which media ids does the content reference?
const referenced = new Set<number>();
const collect: Visit = (id) => (referenced.add(id), id);
for (const c of collections) for (const d of snapshot.collections[c.slug]) walkFields(c.fields, clone(d), collect);
for (const g of globals) walkFields(g.fields, clone(snapshot.globals[g.slug]), collect);

// Groups by source name; keeper per group.
const groups = new Map<string, MediaDoc[]>();
for (const m of mediaAll) {
  if (!m.filename) continue;
  const key = sourceName(m.filename);
  groups.set(key, [...(groups.get(key) ?? []), m]);
}
const toKeeper = new Map<number, number>();
const losers: MediaDoc[] = [];
for (const [, docs] of groups) {
  if (docs.length < 2) continue;
  const keeper = pickMedia(docs, referenced)!;
  for (const d of docs) {
    if (d.id === keeper.id) continue;
    toKeeper.set(d.id, keeper.id);
    losers.push(d);
  }
}

// Pass 2: re-point references.
const remap: Visit = (id) => toKeeper.get(id) ?? id;
type Change = { collection?: string; global?: string; id?: number | string; data: Record<string, unknown> };
const changes: Change[] = [];
function changedKeys(before: Doc, after: Doc): Record<string, unknown> | null {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(after)) if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) out[k] = after[k];
  return Object.keys(out).length ? out : null;
}
for (const c of collections) {
  for (const d of snapshot.collections[c.slug]) {
    const after = clone(d);
    walkFields(c.fields, after, remap);
    const data = changedKeys(d, after);
    if (data) changes.push({ collection: c.slug, id: d.id, data });
  }
}
for (const g of globals) {
  const before = snapshot.globals[g.slug];
  const after = clone(before);
  walkFields(g.fields, after, remap);
  const data = changedKeys(before, after);
  if (data) changes.push({ global: g.slug, data });
}

// ---- report -----------------------------------------------------------------

const unreferencedLosers = losers.filter((l) => !referenced.has(l.id)).length;
const duplicated = [...groups.values()].filter((g) => g.length > 1).length;
console.log(`media: ${mediaAll.length} documents, ${groups.size} distinct pictures, ${duplicated} duplicated`);
console.log(`referenced by content: ${referenced.size} documents`);
console.log(`to delete: ${losers.length} (${losers.length - unreferencedLosers} referenced and re-pointed, ${unreferencedLosers} unreferenced)`);
console.log(`documents to update: ${changes.length}`);
for (const ch of changes) {
  const where = ch.collection ? `${ch.collection} #${ch.id}` : `global ${ch.global}`;
  console.log(`  ${where}: ${Object.keys(ch.data).join(", ")}`);
}
const missing = [...referenced].filter((id) => !mediaAll.some((m) => m.id === id));
if (missing.length) console.log(`! content references media that does not exist: ${missing.join(", ")}`);

if (!apply) {
  console.log("\nDry run. Re-run with --apply to write.");
  process.exit(0);
}

// ---- apply ------------------------------------------------------------------

mkdirSync("backups", { recursive: true });
const backup = path.join("backups", `media-dedupe-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
writeFileSync(backup, JSON.stringify({ snapshot, toKeeper: [...toKeeper], changes }, null, 1));
console.log(`\nbackup: ${backup}`);

let updated = 0;
for (const ch of changes) {
  if (ch.collection) await payload.update({ collection: ch.collection, id: ch.id!, data: ch.data, depth: 0, overrideAccess: true });
  else await payload.updateGlobal({ slug: ch.global!, data: ch.data, depth: 0, overrideAccess: true });
  updated++;
}
console.log(`updated ${updated} documents`);

let deleted = 0;
for (const l of losers) {
  try {
    await payload.delete({ collection: "media", id: l.id, depth: 0, overrideAccess: true });
    deleted++;
  } catch (e) {
    console.warn(`  ! could not delete media #${l.id} ${l.filename}: ${(e as Error).message}`);
  }
}
console.log(`deleted ${deleted} of ${losers.length} media documents`);
const left = await payload.count({ collection: "media" });
console.log(`media left: ${left.totalDocs}`);
process.exit(0);

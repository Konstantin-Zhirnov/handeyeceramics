/**
 * One conditional UPDATE as a lock: the order or the invoice itself is what
 * the success page and the webhook race for, in separate module graphs and on
 * Vercel separate processes, so nothing in memory can order them. The caller
 * whose UPDATE changed a row goes on.
 */
import type { Payload } from "payload";

type Db = Payload["db"] & { tableNameMap?: Map<string, string>; execute?: (args: { drizzle: unknown; raw: string }) => unknown };

/** Runs one statement and tells how many rows it changed (Postgres `rowCount`, SQLite `rowsAffected`). */
export async function affected(p: Payload, raw: string): Promise<number> {
  const db = p.db as Db;
  if (!db.execute) throw new Error("the database adapter cannot run a statement");
  // The adapter's execute() is a plain function: it runs on the drizzle instance it is handed.
  const result = (await db.execute({ drizzle: db.drizzle, raw })) as { rowCount?: number | null; rowsAffected?: number } | undefined;
  return result?.rowCount ?? result?.rowsAffected ?? 0;
}

/** The quoted table name of a collection. */
export const table = (p: Payload, slug: string) => `"${(p.db as Db).tableNameMap?.get(slug) || slug}"`;

/** A string literal for SQL. */
export const literal = (v: string) => `'${v.replace(/'/g, "''")}'`;

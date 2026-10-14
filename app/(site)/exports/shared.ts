import { NextResponse } from "next/server";
import type { Payload, TypedUser } from "payload";
import { getCMS } from "@/lib/cms/resolve";
import { toCSV, type Cell } from "./csv";

/**
 * What the two CSV routes share: who may download (a signed-in editor, by
 * the admin cookie or a `JWT` header, as Payload's own API reads them), and
 * the shape of the file they get.
 */
export async function editorOf(request: Request): Promise<{ payload: Payload; user: TypedUser | null }> {
  const payload = await getCMS();
  const { user } = await payload.auth({ headers: request.headers });
  return { payload, user: user ?? null };
}

export const unauthorized = () =>
  NextResponse.json({ ok: false, message: "Sign in to the admin to download this file" }, { status: 401 });

export const notFound = (message: string) => NextResponse.json({ ok: false, message }, { status: 404 });

export const badRequest = (message: string) => NextResponse.json({ ok: false, message }, { status: 400 });

/** The rows as a file the browser saves. */
export function csvFile(rows: Cell[][], filename: string): Response {
  return new Response(toCSV(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

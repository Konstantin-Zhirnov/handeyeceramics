import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
// A relative import: the unit test of this gate loads the module under vitest, which knows no "@/" alias.
import { runDailyMail } from "../../../../lib/mail";

/**
 * The daily mail run, called once a day by the platform's cron (vercel.json):
 * class reminders two days before the first class and next-course invitations
 * a day after the last one. Guarded by `Authorization: Bearer $CRON_SECRET`:
 * 503 when the secret is not configured (the job is off), 401 when the header
 * is missing or wrong. Answers the counts as JSON.
 */
export const dynamic = "force-dynamic";

function bearerMatches(header: string | null, secret: string): boolean {
  const given = header?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, message: "CRON_SECRET is not configured" }, { status: 503 });
  if (!bearerMatches(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  const counts = await runDailyMail();
  return NextResponse.json({ ok: true, ...counts });
}

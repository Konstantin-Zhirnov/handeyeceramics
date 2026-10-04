import { NextResponse } from "next/server";
import { normalizePath } from "@/collections/fields/path";
import { answersOf, FORMS, isEnquiryType, validate } from "@/components/forms/definitions";
import { getCMS } from "@/lib/cms/resolve";

/**
 * Receives the enquiry forms — the only way an enquiry gets in: the collection
 * itself is closed to anonymous creates. The body is JSON:
 * `{ type, values: { <field>: <answer> }, page?, studio?, company_url? }`.
 * Answers 201 `{ ok: true }`, or `{ ok: false, message, errors? }` with
 * 400 (what the visitor must fix, by field), 429 (too many) or 500.
 */
export const dynamic = "force-dynamic";

/** The hidden field of the form; a person never fills it. */
const TRAP = "company_url";

/**
 * At most LIMIT saved enquiries per sender within WINDOW.
 *
 * The counts live in the memory of this server process only: every process (or
 * serverless instance) counts on its own and starts from zero when it restarts.
 * It is a simple brake on one sender, not protection against a distributed flood.
 */
const LIMIT = 5;
const WINDOW = 10 * 60_000;
const recent = new Map<string, number[]>();

/**
 * The client address as the hosting platform reports it — never the first
 * entries of `x-forwarded-for`, which the client writes itself. In order: the
 * platform's own header, `x-real-ip` set by the proxy, then the last hop of
 * `x-forwarded-for` (the one the nearest proxy appended). Undefined when there
 * is none, or when it is only this machine's own loopback address (no proxy in
 * front, as in local development, where the server fills in the socket address).
 */
const LOOPBACK = /^(::1|(::ffff:)?127\.\d+\.\d+\.\d+|localhost)$/i;

function addressOf(headers: Headers): string | undefined {
  const last = (value: string | null) => value?.split(",").map((s) => s.trim()).filter(Boolean).at(-1);
  const address =
    (process.env.VERCEL ? last(headers.get("x-vercel-forwarded-for")) : undefined) ||
    last(headers.get("x-real-ip")) ||
    last(headers.get("x-forwarded-for"));
  return address && !LOOPBACK.test(address) ? address : undefined;
}

/** Counts this enquiry against the sender; false when the sender is over the limit. */
function allow(key: string, now = Date.now()) {
  if (recent.size > 5000) {
    for (const [k, times] of recent) if (times.every((t) => now - t >= WINDOW)) recent.delete(k);
  }
  const times = (recent.get(key) || []).filter((t) => now - t < WINDOW);
  if (times.length >= LIMIT) {
    recent.set(key, times);
    return false;
  }
  recent.set(key, [...times, now]);
  return true;
}

/** The page the form was sent from: a path of this site, normalised; anything else is dropped. */
function pageOf(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.startsWith("/") || value.length > 300) return undefined;
  if (/[\u0000-\u001f\u007f\s\\]/.test(value)) return undefined;
  const path = normalizePath(value);
  return path.startsWith("/") ? path : undefined;
}

const fail = (status: number, message: string, errors?: Record<string, string>) =>
  NextResponse.json({ ok: false, message, ...(errors ? { errors } : {}) }, { status });

async function fallbackMessage() {
  let phone = "";
  try {
    const settings = await (await getCMS()).findGlobal({ slug: "settings", depth: 0, overrideAccess: false });
    phone = settings.phone || phone;
  } catch {
    /* the CMS is what failed: no contact to offer */
  }
  return phone ? `We couldn't send your message. Please call us at ${phone}.` : "We couldn't send your message. Please try again later.";
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
    if (!body || typeof body !== "object") throw new Error("not an object");
  } catch {
    return fail(400, "The form could not be read. Please try again.");
  }
  if (!isEnquiryType(body.type)) return fail(400, "Unknown form.");
  const type = body.type;

  // A bot gets the same answer as a person, and nothing is saved.
  if (typeof body[TRAP] === "string" && body[TRAP].trim()) return NextResponse.json({ ok: true }, { status: 201 });

  const { errors, values } = validate(type, body.values);
  if (Object.keys(errors).length) return fail(400, "Please check the highlighted fields.", errors);

  const column = (name: "name" | "email" | "phone" | "message") => {
    const field = FORMS[type].find((f) => f.column === name);
    return (field && values[field.name]) || undefined;
  };
  const email = column("email")!;

  // A request without an address is counted by its sender email instead, so
  // that visitors without one do not all land in the same bucket.
  const address = addressOf(request.headers);
  if (!allow(address ? `address:${address}` : `email:${email.toLowerCase()}`)) {
    return fail(429, "You've sent several messages in a row. Please try again in a few minutes.");
  }

  try {
    const payload = await getCMS();
    const studioId = Number(body.studio);
    const studio =
      Number.isInteger(studioId) && studioId > 0
        ? await payload.findByID({ collection: "studios", id: studioId, depth: 0, disableErrors: true, overrideAccess: false })
        : null;
    // Local API with access overridden: this route is the gate, so it sets
    // every field itself and the status is always "new".
    await payload.create({
      collection: "enquiries",
      overrideAccess: true,
      data: {
        type,
        email,
        name: column("name"),
        phone: column("phone"),
        message: column("message"),
        answers: answersOf(type, values),
        studio: studio?.id,
        page: pageOf(body.page),
        status: "new",
      },
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("enquiry was not saved", err);
    return fail(500, await fallbackMessage());
  }
}

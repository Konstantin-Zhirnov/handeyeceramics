import { NextResponse } from "next/server";
import { normalizePath } from "@/collections/fields/path";
import { answersOf, FORMS, isEnquiryType, validate } from "@/components/forms/definitions";
import { getCMS } from "@/lib/cms/resolve";
import { addressOf, rateLimiter, SENDER_LIMIT } from "@/lib/rate-limit";

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

/** At most 5 saved enquiries per sender within 10 minutes (see lib/rate-limit). */
const limiter = rateLimiter(SENDER_LIMIT);

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
  if (!limiter.allow(address ? `address:${address}` : `email:${email.toLowerCase()}`)) {
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

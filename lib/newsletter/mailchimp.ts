/**
 * The mailing list on Mailchimp (Marketing API 3.0). The site adds a buyer who
 * ticked "email me new class dates" at checkout, tagged with the city of the
 * studio, and the import script moves the Wix subscribers the same way. The
 * account is chosen by the environment only: `MAILCHIMP_API_KEY` (its
 * "-us21" suffix names the data centre) and `MAILCHIMP_AUDIENCE_ID`. Without
 * them nobody is added and nothing is sent.
 */
import { createHash } from "node:crypto";

export type MailchimpConfig = { apiKey: string; audienceId: string; base: string };

export function mailchimpConfig(env: Record<string, string | undefined> = process.env): MailchimpConfig | null {
  const apiKey = (env.MAILCHIMP_API_KEY || "").trim();
  const audienceId = (env.MAILCHIMP_AUDIENCE_ID || "").trim();
  const dc = apiKey.match(/-([a-z]+\d+)$/)?.[1];
  if (!apiKey || !audienceId || !dc) return null;
  return { apiKey, audienceId, base: `https://${dc}.api.mailchimp.com/3.0` };
}

/** Mailchimp's id of a member: the MD5 of the lower-cased address. */
export const subscriberHash = (email: string) => createHash("md5").update(email.trim().toLowerCase()).digest("hex");

export type Subscriber = { email: string; firstName?: string; lastName?: string; tags?: string[]; ip?: string; at?: Date };

type Fetch = typeof fetch;

/** One call to the API; an error answer becomes an exception that names Mailchimp's own reason. */
export async function mailchimp<T = unknown>(cfg: MailchimpConfig, method: string, path: string, body?: unknown, f: Fetch = fetch): Promise<T> {
  const res = await f(`${cfg.base}${path}`, {
    method,
    headers: { Authorization: `Basic ${Buffer.from(`site:${cfg.apiKey}`).toString("base64")}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text.slice(0, 300);
    try {
      const j = JSON.parse(text) as { title?: string; detail?: string };
      detail = [j.title, j.detail].filter(Boolean).join(": ") || detail;
    } catch {
      /* not JSON: the raw text is the reason */
    }
    throw new Error(`Mailchimp ${method} ${path} answered ${res.status}: ${detail}`);
  }
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Splits "Ada Lovelace King" into the first name and the rest, for the FNAME and LNAME fields. */
export function splitName(name: string | null | undefined): { firstName?: string; lastName?: string } {
  const [first, ...rest] = (name || "").trim().split(/\s+/).filter(Boolean);
  return { ...(first ? { firstName: first } : {}), ...(rest.length ? { lastName: rest.join(" ") } : {}) };
}

/**
 * Adds a person who asked for the emails, then their tags. Somebody already on
 * the list keeps their status — an address that unsubscribed is not put back.
 */
export async function subscribe(cfg: MailchimpConfig, s: Subscriber, f: Fetch = fetch): Promise<void> {
  const hash = subscriberHash(s.email);
  const merge = { ...(s.firstName ? { FNAME: s.firstName } : {}), ...(s.lastName ? { LNAME: s.lastName } : {}) };
  await mailchimp(
    cfg,
    "PUT",
    `/lists/${cfg.audienceId}/members/${hash}`,
    {
      email_address: s.email.trim(),
      status_if_new: "subscribed",
      ...(Object.keys(merge).length ? { merge_fields: merge } : {}),
      ...(s.ip ? { ip_signup: s.ip } : {}),
      ...(s.at ? { timestamp_signup: s.at.toISOString() } : {}),
    },
    f,
  );
  const tags = [...new Set((s.tags || []).filter(Boolean))];
  if (tags.length) await mailchimp(cfg, "POST", `/lists/${cfg.audienceId}/members/${hash}/tags`, { tags: tags.map((name) => ({ name, status: "active" })) }, f);
}

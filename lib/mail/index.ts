/**
 * Emails to students: the order confirmation, the reminder two days before
 * the first class, "pieces ready" and the next-course invitation, from the
 * templates the owner edits in the email-templates collection. Placeholders
 * {{name}}, {{order_number}}, {{items}}, {{class}}, {{dates}}, {{studio_name}},
 * {{studio_address}}, {{door_code}}, {{site_url}}, {{teachers_url}},
 * {{teachers_password}}, and in the gift card email {{gift_codes}}, are
 * replaced; an unknown placeholder stays as it is. Letters go through `payload.sendEmail` — SMTP, or
 * the server log when SMTP is not configured — like the enquiry letters.
 *
 * The door code is read from `studios.doorCode` on the server with
 * `overrideAccess`; the value never appears in code, seed or tests.
 */
import type { Payload } from "payload";
import type { EmailTemplate, Order, Registration, Session, Studio } from "../../payload-types";
import { formatPrice } from "../cms/text";
import { getCMS } from "../cms/payload";
import { relId } from "../cms/relations";
import { SEATED_STATUSES } from "../booking/availability";
import { TEACHERS_PATH } from "../teachers";
import { EMAIL_TEMPLATE_KEYS, type TemplateKey } from "./keys";

export { EMAIL_TEMPLATE_KEYS, type TemplateKey };

/** What stands in for a door code the studio has not entered yet. */
export const NO_DOOR_CODE = "[door code — ask the studio]";
const SEND_TIMEOUT = 10_000;
const DAY = 86_400_000;

type Vars = Record<string, string>;

export function renderTemplate(body: string, vars: Vars): string {
  return body.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (whole, key: string) => (key in vars ? vars[key] : whole));
}

const lines = (text: string | null | undefined) =>
  String(text ?? "")
    .split(/\r\n|\r|\n/)
    .map((l) => l.trim())
    .filter(Boolean);

async function template(payload: Payload, key: TemplateKey): Promise<EmailTemplate | null> {
  const { docs } = await payload.find({ collection: "email-templates", where: { key: { equals: key } }, limit: 1, depth: 0, overrideAccess: true });
  return (docs[0] as EmailTemplate | undefined) ?? null;
}

/**
 * Renders the template and hands the letter to the mail adapter, waiting at
 * most SEND_TIMEOUT for it. False — and a line in the log — when the template
 * is missing or switched off.
 */
async function deliver(payload: Payload, key: TemplateKey, to: string, vars: Vars): Promise<boolean> {
  const t = await template(payload, key);
  if (!t || !t.enabled) {
    payload.logger.warn({ msg: `Email "${key}" not sent: the template is ${t ? "disabled" : "missing"}`, to });
    return false;
  }
  const subject = renderTemplate(t.subject, vars);
  const text = renderTemplate(t.body, vars);
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    payload.sendEmail({ to, subject, text }),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`sending the "${key}" email timed out`)), SEND_TIMEOUT);
    }),
  ]).finally(() => clearTimeout(timer));
  return true;
}

export async function sendTemplate(key: TemplateKey, to: string, vars: Vars, payload?: Payload): Promise<void> {
  await deliver(payload || (await getCMS()), key, to, vars);
}

/**
 * Lets a send run on after the caller returns. Inside a web request the
 * platform keeps the function alive until it is done (`after`); outside one
 * (a script, a test) the promise simply runs on. The caller attaches its own
 * `.catch`, so a failed send is logged and never thrown.
 */
export async function inBackground(work: Promise<unknown>): Promise<void> {
  try {
    const { after } = await import("next/server");
    after(work);
  } catch {
    /* not in a request */
  }
}

// ---- The studio and the class of a letter ------------------------------------

type Place = { studio_name: string; studio_address: string; door_code: string };

async function placeVars(payload: Payload, studioId: number | undefined): Promise<Place> {
  const studio = studioId
    ? ((await payload.findByID({ collection: "studios", id: studioId, depth: 0, overrideAccess: true }).catch(() => null)) as Studio | null)
    : null;
  return {
    studio_name: studio?.name ?? "[TBD]",
    studio_address: studio ? lines(studio.address).join(", ") : "[TBD]",
    door_code: studio?.doorCode?.trim() || NO_DOOR_CODE,
  };
}

const readSession = (payload: Payload, id: number) =>
  payload.findByID({ collection: "sessions", id, depth: 0, overrideAccess: true, context: { skipAvailability: true } }).catch(() => null) as Promise<Session | null>;

async function productName(payload: Payload, id: number | undefined): Promise<string | undefined> {
  if (!id) return undefined;
  const p = await payload.findByID({ collection: "products", id, depth: 0, overrideAccess: true }).catch(() => null);
  return p?.name ?? undefined;
}

const siteUrl = (payload: Payload) => (payload.config.serverURL || "").replace(/\/+$/, "");

/** What stands in for the teachers' page password the owner has not set yet. */
export const NO_TEACHERS_PASSWORD = "[ask the studio]";

/** The teacher contacts page and its shared password (global `teachers`, read on the server). */
async function teacherVars(payload: Payload): Promise<Vars> {
  const page = await payload.findGlobal({ slug: "teachers", depth: 0, overrideAccess: true }).catch(() => null);
  return { teachers_url: `${siteUrl(payload)}${TEACHERS_PATH}`, teachers_password: page?.password?.trim() || NO_TEACHERS_PASSWORD };
}

// ---- Order confirmation --------------------------------------------------------

function itemLine(line: NonNullable<Order["lines"]>[number]): string {
  const option = line.option ? ` (${line.option})` : "";
  return `${line.label}${option} × ${line.quantity} — ${formatPrice((line.unitAmount * line.quantity) / 100)}`;
}

async function orderVars(payload: Payload, order: Order): Promise<Vars> {
  const sessionIds = [...new Set((order.lines || []).flatMap((l) => (l.kind === "session" ? [relId(l.session)] : [])).filter((id): id is number => !!id))];
  const sessions = (await Promise.all(sessionIds.map((id) => readSession(payload, id)))).filter((s): s is Session => !!s);
  const classes = [...new Set((await Promise.all(sessions.map((s) => productName(payload, relId(s.product))))).filter((n): n is string => !!n))];
  const studioId = sessions.map((s) => relId(s.studio)).find((id) => !!id) ?? relId(order.pickupStudio);
  return {
    name: order.customer?.name?.trim() || order.attendee?.trim() || "there",
    order_number: order.number || "",
    items: (order.lines || []).map(itemLine).join("\n"),
    class: classes.join(", "),
    dates: [...new Set(sessions.map((s) => s.label))].join("; "),
    ...(await placeVars(payload, studioId)),
    site_url: siteUrl(payload),
    ...(await teacherVars(payload)),
  };
}

/**
 * The codes of the gift cards an order bought, to the buyer, one letter for
 * all of them: "HE-XXXX-XXXX-XXXX — CA$100.00" per line in {{gift_codes}}.
 * Sent and awaited: the caller (issueGiftCards) runs after the payment.
 */
export async function sendGiftCards(order: Order, cards: { code: string; amount: number }[], payload?: Payload): Promise<boolean> {
  const p = payload || (await getCMS());
  const to = order.customer?.email;
  if (!to || !cards.length) return false;
  return deliver(p, "gift-card", to, {
    name: order.customer?.name?.trim() || "there",
    order_number: order.number || "",
    gift_codes: cards.map((c) => `${c.code} — ${formatPrice(c.amount / 100)}`).join("\n"),
    gift_total: formatPrice(cards.reduce((sum, c) => sum + c.amount, 0) / 100),
    site_url: siteUrl(p),
  });
}

/**
 * One letter to the buyer of a paid order, sent in the background: the request
 * that finished the order does not wait for the mail adapter.
 */
export async function sendOrderConfirmation(orderId: number, payload?: Payload): Promise<void> {
  const p = payload || (await getCMS());
  const order = (await p.findByID({ collection: "orders", id: orderId, depth: 0, overrideAccess: true })) as Order;
  const to = order.customer?.email?.trim();
  if (!to) {
    p.logger.warn({ msg: "Order confirmation not sent: the order has no email", orderId });
    return;
  }
  const vars = await orderVars(p, order);
  const sending = deliver(p, "order-confirmation", to, vars).catch((err) => {
    p.logger.error({ msg: "Order confirmation not sent", orderId, err });
  });
  await inBackground(sending);
}

// ---- Letters to a registered student --------------------------------------------

/**
 * "Your pieces are ready" to every student with a seat on a date (paid or added by hand), each once:
 * every student's registration is marked (`piecesReadySentAt`) as the letter
 * goes out, and the date is marked when every student with an email has one.
 * A student whose send failed stays unmarked; the owner unticks and ticks the
 * box again, and only that student gets the letter. A date already marked, or
 * a second call, sends nothing.
 */
export async function sendPiecesReady(sessionId: number, payload?: Payload): Promise<void> {
  const p = payload || (await getCMS());
  const session = await readSession(p, sessionId);
  if (!session || session.piecesReadySentAt) return;
  const { docs } = await p.find({
    collection: "registrations",
    where: { and: [{ session: { equals: sessionId } }, { status: { in: [...SEATED_STATUSES] } }, { piecesReadySentAt: { exists: false } }] },
    pagination: false,
    depth: 0,
    overrideAccess: true,
    context: { skipAvailability: true },
  });
  const vars = new StudentVars(p);
  const now = new Date().toISOString();
  let sent = 0;
  let failed = 0;
  for (const reg of docs as Registration[]) {
    const to = reg.email?.trim();
    if (!to) continue;
    if (!(await deliverTo(p, "pieces-ready", to, await vars.for(reg), reg.id))) {
      failed++;
      continue;
    }
    await p.update({ collection: "registrations", id: reg.id, data: { piecesReadySentAt: now }, depth: 0, overrideAccess: true, context: { skipAvailability: true } });
    sent++;
  }
  if (failed > 0) {
    p.logger.warn({ msg: "Pieces-ready emails: some were not sent; untick and tick the box again to retry those", sessionId, sent, failed });
    return;
  }
  await p.update({
    collection: "sessions",
    id: sessionId,
    data: { piecesReadySentAt: now },
    depth: 0,
    overrideAccess: true,
    context: { skipAvailability: true, piecesReadyMail: true },
  });
  p.logger.info({ msg: "Pieces-ready emails sent", sessionId, sent });
}

/** The placeholders of a letter to one student of a date; sessions and their studios are read once per run. */
class StudentVars {
  private sessions = new Map<number, Promise<Vars>>();
  constructor(private payload: Payload) {}

  private sessionVars(sessionId: number): Promise<Vars> {
    let vars = this.sessions.get(sessionId);
    if (!vars) {
      vars = (async () => {
        const session = await readSession(this.payload, sessionId);
        return {
          class: (await productName(this.payload, relId(session?.product))) ?? "[TBD]",
          dates: session?.label ?? "",
          ...(await placeVars(this.payload, relId(session?.studio))),
          site_url: siteUrl(this.payload),
          ...(await teacherVars(this.payload)),
        };
      })();
      this.sessions.set(sessionId, vars);
    }
    return vars;
  }

  async for(reg: Registration): Promise<Vars> {
    const orderId = relId(reg.order);
    const order = orderId ? ((await this.payload.findByID({ collection: "orders", id: orderId, depth: 0, overrideAccess: true }).catch(() => null)) as Order | null) : null;
    return { name: reg.name?.trim() || "there", order_number: order?.number || "", ...(await this.sessionVars(relId(reg.session)!)) };
  }
}

/** Registrations with a seat (paid or added by hand) whose date has `field` within [from, to) and `mark` not set yet. */
async function dueRegistrations(payload: Payload, field: "startsAt" | "endsAt", mark: "reminderSentAt" | "followupSentAt", from: Date, to: Date): Promise<Registration[]> {
  const { docs } = await payload.find({
    collection: "registrations",
    where: {
      and: [
        { status: { in: [...SEATED_STATUSES] } },
        { [mark]: { exists: false } },
        { [`session.${field}`]: { greater_than_equal: from.toISOString() } },
        { [`session.${field}`]: { less_than: to.toISOString() } },
      ],
    },
    pagination: false,
    depth: 0,
    overrideAccess: true,
    context: { skipAvailability: true },
  });
  return docs as Registration[];
}

/** Sends `key` to every due registration and marks each one sent; returns how many went out. */
async function mailDue(payload: Payload, key: TemplateKey, regs: Registration[], mark: "reminderSentAt" | "followupSentAt", now: Date): Promise<number> {
  const vars = new StudentVars(payload);
  let count = 0;
  for (const reg of regs) {
    const to = reg.email?.trim();
    if (!to) {
      payload.logger.warn({ msg: `Email "${key}" not sent: the registration has no email`, registration: reg.id });
      continue;
    }
    if (!(await deliverTo(payload, key, to, await vars.for(reg), reg.id))) continue;
    await payload.update({ collection: "registrations", id: reg.id, data: { [mark]: now.toISOString() }, depth: 0, overrideAccess: true, context: { skipAvailability: true } });
    count++;
  }
  return count;
}

/** One student's letter: a failed send (timeout, SMTP) is logged and counts as not sent; the run goes on to the next student. */
async function deliverTo(payload: Payload, key: TemplateKey, to: string, vars: Vars, registration: number): Promise<boolean> {
  try {
    return await deliver(payload, key, to, vars);
  } catch (err) {
    payload.logger.error({ msg: `Email "${key}" not sent`, registration, err });
    return false;
  }
}

/**
 * The daily run (GET /cron/daily): the reminder to students whose first class
 * is two days away — the date starts within [now+2d, now+3d) — and the
 * next-course invitation to those whose last class ended a day ago — the date
 * ended within [now−2d, now−1d). Each registration gets each letter once
 * (`reminderSentAt`, `followupSentAt`), so a second run the same day sends nothing.
 */
export async function runDailyMail(now: Date = new Date(), payload?: Payload): Promise<{ reminders: number; followups: number }> {
  const p = payload || (await getCMS());
  const t = now.getTime();
  const reminders = await mailDue(p, "class-reminder", await dueRegistrations(p, "startsAt", "reminderSentAt", new Date(t + 2 * DAY), new Date(t + 3 * DAY)), "reminderSentAt", now);
  const followups = await mailDue(p, "next-course", await dueRegistrations(p, "endsAt", "followupSentAt", new Date(t - 2 * DAY), new Date(t - DAY)), "followupSentAt", now);
  p.logger.info({ msg: "Daily mail", reminders, followups, now: now.toISOString() });
  return { reminders, followups };
}

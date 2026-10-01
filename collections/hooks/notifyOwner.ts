import type { CollectionAfterChangeHook, Payload } from "payload";

type EnquiryDoc = {
  id: number | string;
  type?: string | null;
  email?: string | null;
  name?: string | null;
  phone?: string | null;
  message?: string | null;
  page?: string | null;
  answers?: { question: string; answer: string }[] | null;
};

const SEND_TIMEOUT = 10_000;

const lines = (text: unknown) => String(text ?? "").split(/\r\n|\r|\n/);
/** One quoted line; a value that runs over several lines continues indented. */
const quoted = (label: string, value: unknown) => {
  const [first = "", ...rest] = lines(value);
  return [`> ${label}: ${first}`, ...rest.map((l) => `>     ${l}`)];
};

/**
 * The enquiry as a plain-text letter. Our own lines (what it is, the admin
 * link) come first; everything the visitor typed follows, every line of it
 * quoted with ">", so nothing typed into the form can pass for a line of ours.
 */
export function enquiryLetter(doc: EnquiryDoc, adminURL: string): { subject: string; text: string } {
  const type = doc.type || "contact";
  const email = lines(doc.email)[0].slice(0, 120);
  const answers = doc.answers || [];
  const text = [
    `New ${type} enquiry`,
    `In the admin: ${adminURL}/admin/collections/enquiries/${doc.id}`,
    "",
    "Everything below was typed by the visitor (quoted lines):",
    ...quoted("Email", doc.email),
    ...(doc.name ? quoted("Name", doc.name) : []),
    ...(doc.phone ? quoted("Phone", doc.phone) : []),
    ...answers.flatMap((a) => [`> ${lines(a.question).join(" ")}`, ...lines(a.answer).map((l) => `>     ${l}`)]),
    // an enquiry without an answers list has only the message
    ...(!answers.length && doc.message ? quoted("Message", doc.message) : []),
    ...(doc.page ? quoted("Sent from", doc.page) : []),
  ].join("\n");
  return { subject: `New ${type} enquiry — ${email}`, text };
}

async function send(payload: Payload, doc: EnquiryDoc) {
  const settings = await payload.findGlobal({ slug: "settings", depth: 0 });
  const to = settings?.email;
  if (!to) {
    payload.logger.warn({ msg: "New enquiry: no email in the site settings, the owner was not notified", id: doc.id });
    return;
  }
  const letter = enquiryLetter(doc, (payload.config.serverURL || "").replace(/\/+$/, ""));
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    payload.sendEmail({ to, replyTo: lines(doc.email)[0], ...letter }),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("sending the email timed out")), SEND_TIMEOUT);
    }),
  ]).finally(() => clearTimeout(timer));
}

/**
 * Tells the owner about a new enquiry: a letter to the address in the site
 * settings, through whatever email the CMS has (SMTP, or the server log when
 * SMTP is not configured). The letter is sent in the background: the visitor's
 * answer does not wait for it, and a letter that fails is only logged — the
 * enquiry is already saved.
 */
export const notifyOwner: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (operation !== "create") return doc;
  const { payload } = req;
  const sending = send(payload, doc as EnquiryDoc).catch((err) => {
    payload.logger.error({ msg: "New enquiry: the email to the owner was not sent", id: doc.id, err });
  });
  try {
    // Inside a web request: let the platform keep the function alive until the
    // letter is out, after the response has gone.
    const { after } = await import("next/server");
    after(sending);
  } catch {
    /* outside a request (a script): the send simply runs on */
  }
  return doc;
};

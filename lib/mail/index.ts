/**
 * Emails to customers: order confirmations, class reminders, "pieces ready"
 * and next-course invitations, from the templates of the email-templates
 * collection. Placeholders {{name}}, {{order_number}}, {{items}}, {{class}},
 * {{dates}}, {{studio_name}}, {{studio_address}}, {{door_code}}, {{site_url}}
 * are replaced; an unknown placeholder stays as it is.
 *
 * Stub: the sending functions only log what they would send. The mail task
 * replaces them with the real implementation behind the same signatures.
 */
import type { Payload } from "payload";

export type TemplateKey = "order-confirmation" | "class-reminder" | "pieces-ready" | "next-course";

export function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (whole, key: string) => (key in vars ? vars[key] : whole));
}

async function cms(): Promise<Payload> {
  const [{ getPayload }, { default: config }] = await Promise.all([import("payload"), import("../../payload.config")]);
  return getPayload({ config });
}

export async function sendTemplate(key: TemplateKey, to: string, vars: Record<string, string>): Promise<void> {
  const payload = await cms();
  payload.logger.info({ msg: "mail stub: sendTemplate", key, to, vars: Object.keys(vars) });
}

export async function sendOrderConfirmation(orderId: number): Promise<void> {
  const payload = await cms();
  payload.logger.info({ msg: "mail stub: sendOrderConfirmation", orderId });
}

export async function sendPiecesReady(sessionId: number): Promise<void> {
  const payload = await cms();
  payload.logger.info({ msg: "mail stub: sendPiecesReady", sessionId });
}

export async function runDailyMail(now: Date = new Date()): Promise<{ reminders: number; followups: number }> {
  const payload = await cms();
  payload.logger.info({ msg: "mail stub: runDailyMail", now: now.toISOString() });
  return { reminders: 0, followups: 0 };
}

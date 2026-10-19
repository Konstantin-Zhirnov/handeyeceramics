/**
 * New subscribers from the site: a buyer who ticked "email me new class dates"
 * in the cart is added to the Mailchimp list once the order is paid, tagged
 * with the city of every studio the order touches (the classes' studios and
 * the pickup studio) — the same tags the import of the Wix subscribers gives.
 */
import type { Payload } from "payload";
import type { Order, Session, Studio } from "../../payload-types";
import { addressParts } from "../cms/address";
import { getCMS } from "../cms/payload";
import { relId } from "../cms/relations";
import { type MailchimpConfig, mailchimpConfig, splitName, subscribe } from "./mailchimp";

export { mailchimpConfig, subscribe, subscriberHash, splitName } from "./mailchimp";

/** The tag of a studio on the list: the city of its address ("Vancouver", "Nanaimo"). */
export const studioTag = (studio: Pick<Studio, "address"> | null | undefined) => addressParts(studio?.address).locality || undefined;

async function orderTags(p: Payload, order: Order): Promise<string[]> {
  const sessionIds = (order.lines || []).flatMap((l) => (l.kind === "session" && relId(l.session) ? [relId(l.session)!] : []));
  const sessions = await Promise.all(
    [...new Set(sessionIds)].map(
      (id) => p.findByID({ collection: "sessions", id, depth: 0, overrideAccess: true, context: { skipAvailability: true } }).catch(() => null) as Promise<Session | null>,
    ),
  );
  const studioIds = [...new Set([...sessions.map((s) => relId(s?.studio)), relId(order.pickupStudio)].filter((id): id is number => !!id))];
  const studios = await Promise.all(studioIds.map((id) => p.findByID({ collection: "studios", id, depth: 0, overrideAccess: true }).catch(() => null) as Promise<Studio | null>));
  return [...new Set(studios.map(studioTag).filter((t): t is string => !!t))];
}

export async function addBuyerToList(orderId: number, payload?: Payload, opts: { config?: MailchimpConfig | null; fetch?: typeof fetch } = {}): Promise<void> {
  const cfg = opts.config === undefined ? mailchimpConfig() : opts.config;
  if (!cfg) return;
  const p = payload || (await getCMS());
  const order = (await p.findByID({ collection: "orders", id: orderId, depth: 0, overrideAccess: true })) as Order;
  const email = order.customer?.email?.trim();
  if (!order.newsletter || !email) return;
  await subscribe(cfg, { email, ...splitName(order.customer?.name), tags: await orderTags(p, order), at: order.paidAt ? new Date(order.paidAt) : undefined }, opts.fetch);
  p.logger.info({ msg: "Buyer added to the mailing list", order: order.number || orderId });
}

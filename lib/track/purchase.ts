/**
 * One purchase as the ad platforms see it, built from a paid order. The
 * browser pixel on the thank-you page and the Conversions API call from the
 * server send the same event id, so Meta counts the purchase once whichever
 * arrives first. The value is the order total with tax, in dollars — what the
 * old site sent, so the history of the campaigns keeps its meaning.
 */
import { createHash } from "node:crypto";
import { relId } from "../cms/relations";
import type { Order } from "../../payload-types";

export const TRACK_CURRENCY = "CAD";

/** Graph API version of the Conversions API calls. */
export const META_GRAPH_VERSION = "v23.0";

export type PurchaseContent = { id: string; quantity: number; item_price: number };

export type PurchaseData = {
  eventId: string;
  orderId: string;
  value: number;
  currency: string;
  contents: PurchaseContent[];
  contentIds: string[];
  numItems: number;
};

/** The event id both copies of the purchase carry. */
export const purchaseEventId = (orderNumber: string) => `purchase-${orderNumber}`;

/** A line's item as the platforms know it: the date of a class or the product. */
function itemId(line: NonNullable<Order["lines"]>[number]): string {
  if (line.kind === "session") return `session-${relId(line.session) ?? "unknown"}`;
  return `product-${relId(line.product) ?? "unknown"}`;
}

export function purchaseData(order: Order): PurchaseData {
  const number = order.number || String(order.id);
  const contents = (order.lines || []).map((l) => ({ id: itemId(l), quantity: l.quantity, item_price: (l.unitAmount || 0) / 100 }));
  return {
    eventId: purchaseEventId(number),
    orderId: number,
    value: (order.total || 0) / 100,
    currency: TRACK_CURRENCY,
    contents,
    contentIds: [...new Set(contents.map((c) => c.id))],
    numItems: contents.reduce((n, c) => n + c.quantity, 0),
  };
}

// ---- Meta Conversions API --------------------------------------------------------

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

/** Normalised as Meta asks before hashing: trimmed and lower-case. */
const hashed = (v: string | null | undefined) => {
  const s = (v || "").trim().toLowerCase();
  return s ? [sha256(s)] : undefined;
};

/** Digits only, with the country code: a ten-digit North American number gets its leading 1. */
export function normalPhone(v: string | null | undefined): string {
  const digits = (v || "").replace(/\D/g, "");
  return digits.length === 10 ? `1${digits}` : digits;
}

export type ClientContext = { fbp?: string | null; fbc?: string | null; clientIp?: string | null; userAgent?: string | null };

/** The Conversions API body of a paid order: one Purchase event with hashed customer details. */
export function metaPurchaseBody(order: Order, opts: { sourceUrl: string; testEventCode?: string; now?: Date }) {
  const data = purchaseData(order);
  const at = order.paidAt ? new Date(order.paidAt) : opts.now || new Date();
  const [first, ...rest] = (order.customer?.name || "").trim().split(/\s+/);
  const client: ClientContext = order.tracking || {};
  const phone = normalPhone(order.customer?.phone);
  const user_data = Object.fromEntries(
    Object.entries({
      em: hashed(order.customer?.email),
      ph: phone ? [sha256(phone)] : undefined,
      fn: hashed(first),
      ln: hashed(rest.join(" ")),
      country: hashed("ca"),
      client_ip_address: client.clientIp || undefined,
      client_user_agent: client.userAgent || undefined,
      fbp: client.fbp || undefined,
      fbc: client.fbc || undefined,
    }).filter(([, v]) => v !== undefined),
  );
  return {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(at.getTime() / 1000),
        event_id: data.eventId,
        action_source: "website",
        event_source_url: opts.sourceUrl,
        user_data,
        custom_data: {
          currency: data.currency,
          value: data.value,
          order_id: data.orderId,
          content_type: "product",
          content_ids: data.contentIds,
          contents: data.contents,
          num_items: data.numItems,
        },
      },
    ],
    ...(opts.testEventCode ? { test_event_code: opts.testEventCode } : {}),
  };
}

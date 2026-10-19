/**
 * Conversion tracking of a paid order: the server copy of the purchase goes to
 * the Meta Conversions API with the same event id as the browser pixel's, so
 * Meta keeps one of the two. Without a pixel id and a token nothing is sent.
 * Google gets the purchase from the thank-you page only (the Google tag).
 */
import type { Payload } from "payload";
import type { Order } from "../../payload-types";
import { getCMS } from "../cms/payload";
import { serverURL } from "../server-url";
import { trackingConfig, type TrackingConfig } from "../track/config";
import { META_GRAPH_VERSION, metaPurchaseBody } from "../track/purchase";

export async function trackPurchase(
  orderId: number,
  payload?: Payload,
  opts: { config?: TrackingConfig; fetch?: typeof fetch } = {},
): Promise<void> {
  const { metaPixelId, metaCapiToken, metaTestEventCode } = opts.config || trackingConfig();
  if (!metaPixelId || !metaCapiToken) return;
  const p = payload || (await getCMS());
  const order = (await p.findByID({ collection: "orders", id: orderId, depth: 0, overrideAccess: true })) as Order;
  const body = metaPurchaseBody(order, { sourceUrl: `${serverURL()}/checkout/success`, testEventCode: metaTestEventCode });
  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${metaPixelId}/events?access_token=${encodeURIComponent(metaCapiToken)}`;
  const res = await (opts.fetch || fetch)(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    // The thank-you page waits for this call: a slow Meta must not hold the buyer.
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    // The answer names the problem (an expired token, a bad field); the token itself is never logged.
    const text = (await res.text().catch(() => "")).slice(0, 500);
    throw new Error(`Meta Conversions API answered ${res.status}: ${text}`);
  }
  p.logger.info({ msg: "trackPurchase: sent to Meta", order: order.number || orderId });
}

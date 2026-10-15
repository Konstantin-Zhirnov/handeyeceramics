/**
 * Conversion tracking of a paid order. Stub: it logs the order; stage 4 sends
 * the purchase to Meta CAPI and Google behind the same signature.
 */
import { getCMS } from "../cms/payload";

export async function trackPurchase(orderId: number): Promise<void> {
  const payload = await getCMS();
  payload.logger.info({ msg: "track stub: trackPurchase", orderId });
}

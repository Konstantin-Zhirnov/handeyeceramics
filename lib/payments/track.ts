/**
 * Conversion tracking of a paid order. Stub: it logs the order; stage 4 sends
 * the purchase to Meta CAPI and Google behind the same signature.
 */
export async function trackPurchase(orderId: number): Promise<void> {
  const [{ getPayload }, { default: config }] = await Promise.all([import("payload"), import("../../payload.config")]);
  const payload = await getPayload({ config });
  payload.logger.info({ msg: "track stub: trackPurchase", orderId });
}

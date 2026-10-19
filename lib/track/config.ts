/**
 * Ad tracking is switched on by the environment, one service at a time: a
 * pixel id loads the Meta pixel, a Conversions API token adds the server copy
 * of each purchase, a Google Ads id loads the Google tag and a conversion
 * label adds the purchase conversion. Nothing set — no tag on the page and no
 * request anywhere, which is how the test site and the tests run.
 */
export type TrackingConfig = {
  metaPixelId?: string;
  metaCapiToken?: string;
  metaTestEventCode?: string;
  googleAdsId?: string;
  googlePurchaseLabel?: string;
};

const clean = (v: string | undefined) => (v || "").trim() || undefined;

export function trackingConfig(env: Record<string, string | undefined> = process.env): TrackingConfig {
  const metaPixelId = clean(env.META_PIXEL_ID);
  const googleAdsId = clean(env.GOOGLE_ADS_ID);
  return {
    metaPixelId: metaPixelId && /^\d+$/.test(metaPixelId) ? metaPixelId : undefined,
    metaCapiToken: metaPixelId ? clean(env.META_CAPI_TOKEN) : undefined,
    metaTestEventCode: metaPixelId ? clean(env.META_TEST_EVENT_CODE) : undefined,
    googleAdsId: googleAdsId && /^AW-\d+$/.test(googleAdsId) ? googleAdsId : undefined,
    googlePurchaseLabel: googleAdsId ? clean(env.GOOGLE_ADS_PURCHASE_LABEL) : undefined,
  };
}

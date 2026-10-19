/**
 * Ad events from the browser: the Meta pixel (`fbq`) and the Google tag
 * (`gtag`), both loaded by <Tracking> only when the environment names them.
 * Every call is a no-op on a page without them, so components call freely.
 */
type Fbq = (...args: unknown[]) => void;
type Gtag = (...args: unknown[]) => void;
type TrackWindow = Window & { fbq?: Fbq; gtag?: Gtag; __trackGoogleAds?: string };

const win = () => (typeof window === "undefined" ? undefined : (window as TrackWindow));

/** Runs `fn` once the tags have loaded — they start after hydration, so a mount effect may come first. */
export function whenReady(fn: () => void, tries = 50): void {
  const w = win();
  if (!w) return;
  if (w.fbq || w.gtag) return fn();
  if (tries > 0) setTimeout(() => whenReady(fn, tries - 1), 200);
}

/** A standard Meta event (`AddToCart`, `ViewContent`, `InitiateCheckout`, `Purchase`); `eventId` pairs it with the server copy. */
export function metaEvent(name: string, data: Record<string, unknown>, eventId?: string): void {
  win()?.fbq?.("track", name, data, eventId ? { eventID: eventId } : undefined);
}

/** A Google tag event, sent to the Google Ads account the page loaded. */
export function googleEvent(name: string, data: Record<string, unknown>): void {
  win()?.gtag?.("event", name, data);
}

/** The Google Ads id the page loaded, for `send_to` of a conversion. */
export const googleAdsId = () => win()?.__trackGoogleAds;

/** A page view after a client-side navigation; the first one is sent by the tags themselves. */
export function pageView(): void {
  win()?.fbq?.("track", "PageView");
  googleEvent("page_view", { page_location: window.location.href, page_title: document.title });
}

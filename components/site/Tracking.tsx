import Script from "next/script";
import { trackingConfig } from "@/lib/track/config";
import { RouteViews } from "./TrackEvents";

/**
 * The ad tags of the public site: the Meta pixel and the Google tag, each only
 * when the environment gives its id (see lib/track/config). They load after
 * hydration and send the first page view themselves; <RouteViews> sends the
 * next ones on client-side navigation. No consent banner: the owner chose to
 * run without one, as the old site does, and the privacy policy lists the
 * cookies.
 */
export function Tracking() {
  const { metaPixelId, googleAdsId } = trackingConfig();
  if (!metaPixelId && !googleAdsId) return null;
  return (
    <>
      {metaPixelId && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${JSON.stringify(metaPixelId)});fbq('track','PageView');`}
        </Script>
      )}
      {googleAdsId && (
        <>
          <Script id="google-tag-src" src={`https://www.googletagmanager.com/gtag/js?id=${googleAdsId}`} strategy="afterInteractive" />
          <Script id="google-tag" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;window.__trackGoogleAds=${JSON.stringify(googleAdsId)};gtag('js',new Date());gtag('config',${JSON.stringify(googleAdsId)},{allow_enhanced_conversions:true});`}
          </Script>
        </>
      )}
      <RouteViews />
    </>
  );
}

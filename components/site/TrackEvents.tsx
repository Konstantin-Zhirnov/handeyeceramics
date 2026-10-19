"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { googleEvent, metaEvent, pageView, whenReady } from "@/lib/track/client";

/** A page view on every client-side navigation; the first page's view is the tags' own. */
export function RouteViews() {
  const pathname = usePathname();
  const last = useRef(pathname);
  useEffect(() => {
    if (last.current === pathname) return;
    last.current = pathname;
    pageView();
  }, [pathname]);
  return null;
}

type MetaCall = { name: string; data: Record<string, unknown>; eventId?: string };
type GoogleCall = { name: string; data: Record<string, unknown>; userData?: Record<string, string> };

/**
 * Sends one event when the page opens: `ViewContent` on a product, the
 * purchase on the thank-you page. `once` names an event that must not repeat
 * when the page is reloaded (the purchase): it is remembered in this browser.
 */
export function TrackOnMount({ meta, google, once }: { meta?: MetaCall; google?: GoogleCall; once?: string }) {
  // A remount of the same element (React's development check, a fast refresh) does not send it again.
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    const key = once ? `track:${once}` : "";
    try {
      if (key && localStorage.getItem(key)) return;
    } catch {
      /* no storage: the event id still lets Meta drop a repeat */
    }
    whenReady(() => {
      if (meta) metaEvent(meta.name, meta.data, meta.eventId);
      if (google) {
        if (google.userData) (window as Window & { gtag?: (...a: unknown[]) => void }).gtag?.("set", "user_data", google.userData);
        googleEvent(google.name, google.data);
      }
      try {
        if (key) localStorage.setItem(key, "1");
      } catch {
        /* see above */
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

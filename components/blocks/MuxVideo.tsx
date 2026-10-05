"use client";

import dynamic from "next/dynamic";

/**
 * The player is a third of a megabyte of script. Imported directly into the
 * blocks it was sent to every page that has blocks at all; here it is fetched
 * only by a page that shows a Mux video, and only in the browser.
 */
const MuxPlayer = dynamic(() => import("@mux/mux-player-react"), {
  ssr: false,
  loading: () => <div aria-hidden className="aspect-video w-full rounded-card bg-clay-100" />,
});

export function MuxVideo({ playbackId }: { playbackId: string }) {
  return <MuxPlayer playbackId={playbackId} streamType="on-demand" style={{ width: "100%", borderRadius: 20 }} />;
}

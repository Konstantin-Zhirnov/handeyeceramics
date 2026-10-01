const ORIGIN = (process.env.NEXT_PUBLIC_SERVER_URL || "").replace(/\/$/, "");

/**
 * With a server URL set the CMS prints absolute links to its own files;
 * next/image takes our own files as paths. Other URLs pass through unchanged.
 */
export const mediaSrc = (url: string) => (ORIGIN && url.startsWith(`${ORIGIN}/`) ? url.slice(ORIGIN.length) : url);

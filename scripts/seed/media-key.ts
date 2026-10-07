/**
 * Which inventory picture a media document came from.
 *
 * Payload keeps upload file names unique: when `<stem>.<ext>` is already taken
 * in storage it saves the file as `<stem>-<n>.<ext>`. On staging the files live
 * in Vercel Blob and outlive database resets, so every seed used to get fresh
 * suffixes (`wheel-spin-6.jpg`, `wheel-spin-7.jpg`) and the lookup by exact file
 * name found nothing. The seed and the dedupe script therefore compare pictures
 * by their source name: the stored name with that suffix removed.
 */

/** `wheel-spin-7.jpg` → `wheel-spin.jpg`; a name without a numeric suffix (or without an extension) is returned as is. */
export function sourceName(filename: string): string {
  const name = filename.toLowerCase();
  const m = /^(.*\S)-\d+(\.[a-z0-9]+)$/.exec(name);
  return m ? `${m[1]}${m[2]}` : name;
}

export type MediaLike = { id: number; filename?: string | null; createdAt: string };

/**
 * The document to keep among those that share a source name: a referenced one
 * over an unreferenced one, and the newest among equals.
 */
export function pickMedia<T extends MediaLike>(docs: T[], referenced: Set<number> = new Set()): T | undefined {
  const score = (d: T) => (referenced.has(d.id) ? 1 : 0);
  return [...docs].sort((a, b) => score(b) - score(a) || b.createdAt.localeCompare(a.createdAt))[0];
}

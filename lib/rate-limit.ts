/**
 * A brake on one sender: at most `limit` counted requests within `windowMs`,
 * keyed by whatever the route takes for the sender (its address, its email).
 * The counts live in the memory of this server process only — every process
 * or serverless instance counts on its own and starts from zero when it
 * restarts. Used by the enquiry forms and by the checkout.
 */
export type RateLimiter = {
  /** Counts a request against `key`; false when the sender is over the limit (and nothing is counted). */
  allow(key: string, now?: number): boolean;
};

export function rateLimiter({ limit, windowMs }: { limit: number; windowMs: number }): RateLimiter {
  const recent = new Map<string, number[]>();
  return {
    allow(key, now = Date.now()) {
      if (recent.size > 5000) {
        for (const [k, times] of recent) if (times.every((t) => now - t >= windowMs)) recent.delete(k);
      }
      const times = (recent.get(key) || []).filter((t) => now - t < windowMs);
      if (times.length >= limit) {
        recent.set(key, times);
        return false;
      }
      recent.set(key, [...times, now]);
      return true;
    },
  };
}

/** The limit the site puts on one sender: 5 within 10 minutes. */
export const SENDER_LIMIT = { limit: 5, windowMs: 10 * 60_000 };

const LOOPBACK = /^(::1|(::ffff:)?127\.\d+\.\d+\.\d+|localhost)$/i;

/**
 * The client address as the hosting platform reports it — never the first
 * entries of `x-forwarded-for`, which the client writes itself. In order: the
 * platform's own header, `x-real-ip` set by the proxy, then the last hop of
 * `x-forwarded-for` (the one the nearest proxy appended). Undefined when there
 * is none, or when it is only this machine's own loopback address (no proxy in
 * front, as in local development, where the server fills in the socket address).
 */
export function addressOf(headers: Headers): string | undefined {
  const last = (value: string | null) => value?.split(",").map((s) => s.trim()).filter(Boolean).at(-1);
  const address =
    (process.env.VERCEL ? last(headers.get("x-vercel-forwarded-for")) : undefined) ||
    last(headers.get("x-real-ip")) ||
    last(headers.get("x-forwarded-for"));
  return address && !LOOPBACK.test(address) ? address : undefined;
}

/**
 * The browser's copy of the cart (R03.1), kept apart from React so the rules
 * can be tested as a sequence: nothing is written before the copy has been
 * read, and a write happens only when the lines really changed from what was
 * last read or written. A provider that mounts, unmounts and mounts again
 * (React StrictMode in development) therefore never clears the cart.
 */
import type { CartLineInput } from "@/lib/payments/types";

/** Bump the version when the shape of a line changes. */
export const CART_KEY = "handeye.cart.v1";

/** A line as kept in the browser: what to buy, and the price seen when it was added, so a change can be pointed out. */
export type CartLine = CartLineInput & { seenAmount?: number };

/** The part of Storage the cart uses; `localStorage` in the browser, a Map in tests. */
export type StorageLike = { getItem(key: string): string | null; setItem(key: string, value: string): void };

/** The lines in a stored string; anything that is not a line is dropped. */
export function parseCart(raw: string | null): CartLine[] {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (l): l is CartLine =>
        !!l && (l.kind === "session" || l.kind === "product") && Number.isInteger(l.id) && Number.isInteger(l.quantity) && l.quantity > 0,
    );
  } catch {
    return [];
  }
}

export type CartSync = {
  /** Reads the stored lines; from now on writes are allowed. */
  load(): CartLine[];
  /** Writes the lines when they differ from the last read or written copy; false when nothing was written. */
  persist(lines: CartLine[]): boolean;
};

/**
 * `storage` is looked up on every call: `localStorage` may throw in a private
 * window or be absent on the server, and then the cart lives in memory only.
 */
export function createCartSync(storage: () => StorageLike | undefined): CartSync {
  let known: string | null = null; // the serialised copy last read or written; null until loaded
  return {
    load() {
      let raw: string | null = null;
      try {
        raw = storage()?.getItem(CART_KEY) ?? null;
      } catch {
        /* no storage: start empty */
      }
      const lines = parseCart(raw);
      known = JSON.stringify(lines);
      return lines;
    },
    persist(lines) {
      if (known === null) return false; // not read yet: writing now would wipe the stored cart
      const json = JSON.stringify(lines);
      if (json === known) return false;
      try {
        storage()?.setItem(CART_KEY, json);
      } catch {
        /* private mode or storage full: the cart lives for this page only */
      }
      known = json;
      return true;
    },
  };
}

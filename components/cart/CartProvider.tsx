"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CartLineInput } from "@/lib/payments/types";

/** The browser's copy of the cart (R03.1). Bump the version when the shape of a line changes. */
export const CART_KEY = "handeye.cart.v1";

/** A line as kept in the browser: what to buy, and the price seen when it was added, so a change can be pointed out. */
export type CartLine = CartLineInput & { seenAmount?: number };

export type Cart = {
  lines: CartLine[];
  /** Units across all lines — the figure in the header. */
  count: number;
  /** True once the browser's copy has been read; before that `lines` is empty on purpose. */
  ready: boolean;
  add: (line: CartLine) => void;
  setQuantity: (line: CartLineInput, quantity: number) => void;
  remove: (line: CartLineInput) => void;
  /** Remembers the price the server last quoted for a line, so the next show compares against it. */
  seen: (line: CartLineInput, amount: number) => void;
  clear: () => void;
};

const CartContext = createContext<Cart | null>(null);

const same = (a: CartLineInput, b: CartLineInput) => a.kind === b.kind && a.id === b.id && (a.option || "") === (b.option || "");

function read(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(CART_KEY);
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

function write(lines: CartLine[]) {
  try {
    window.localStorage.setItem(CART_KEY, JSON.stringify(lines));
  } catch {
    /* private mode or storage full: the cart lives for this page only */
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const hydrated = useRef(false);

  // The server renders an empty cart; the browser's copy comes in after mount, so SSR and the first paint agree.
  useEffect(() => {
    setLines(read());
    hydrated.current = true;
    setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === CART_KEY) setLines(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (hydrated.current) write(lines);
  }, [lines]);

  const add = useCallback((line: CartLine) => {
    setLines((prev) => {
      const at = prev.findIndex((l) => same(l, line));
      if (at < 0) return [...prev, line];
      const next = [...prev];
      next[at] = { ...prev[at], quantity: prev[at].quantity + line.quantity, seenAmount: line.seenAmount ?? prev[at].seenAmount };
      return next;
    });
  }, []);

  const setQuantity = useCallback((line: CartLineInput, quantity: number) => {
    setLines((prev) => (quantity < 1 ? prev.filter((l) => !same(l, line)) : prev.map((l) => (same(l, line) ? { ...l, quantity } : l))));
  }, []);

  const remove = useCallback((line: CartLineInput) => setLines((prev) => prev.filter((l) => !same(l, line))), []);

  const seen = useCallback((line: CartLineInput, amount: number) => {
    setLines((prev) => (prev.some((l) => same(l, line) && l.seenAmount !== amount) ? prev.map((l) => (same(l, line) ? { ...l, seenAmount: amount } : l)) : prev));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<Cart>(
    () => ({ lines, count: lines.reduce((n, l) => n + l.quantity, 0), ready, add, setQuantity, remove, seen, clear }),
    [lines, ready, add, setQuantity, remove, seen, clear],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): Cart {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart: wrap the page in <SiteShell> (or <CartProvider>)");
  return value;
}

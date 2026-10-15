"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CartLineInput } from "@/lib/payments/types";
import { CART_KEY, type CartLine, createCartSync } from "./storage";

export { CART_KEY, type CartLine };

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

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const sync = useRef(createCartSync(() => window.localStorage));

  // The server renders an empty cart; the browser's copy comes in after mount, so SSR and the first paint agree.
  useEffect(() => {
    setLines(sync.current.load());
    setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === CART_KEY) setLines(sync.current.load());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Written back only once the copy has been read (`ready` is state, so the render that still holds []
  // never reaches here) and only when the lines changed — see storage.ts for why this matters in StrictMode.
  useEffect(() => {
    if (ready) sync.current.persist(lines);
  }, [lines, ready]);

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

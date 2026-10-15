"use client";

import { useEffect, useRef } from "react";
import { useCart } from "./CartProvider";

/**
 * The success page's one job in the browser (R24i): the order is paid, so the
 * cart it came from is emptied — once per order, however often the page is shown.
 */
export function ClearCart({ order }: { order: string }) {
  const { ready, clear } = useCart();
  const cleared = useRef("");
  useEffect(() => {
    if (!ready || cleared.current === order) return;
    cleared.current = order;
    clear();
  }, [ready, clear, order]);
  return <span data-order={order} hidden />;
}

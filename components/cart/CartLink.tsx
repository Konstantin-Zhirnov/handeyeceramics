"use client";

import Link from "next/link";
import { useCart } from "./CartProvider";

export const CART_PATH = "/cart";

function BagIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path d="M5.5 8.5h13l-.9 11a1.5 1.5 0 0 1-1.5 1.4H7.9a1.5 1.5 0 0 1-1.5-1.4l-.9-11Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M9 10.5V7a3 3 0 0 1 6 0v3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** The header's way to the cart, with the number of units in it (R03). Lives inside SiteShell's providers. */
export function CartLink({ light = false }: { light?: boolean }) {
  const { count } = useCart();
  const line = light ? "border-clay-50/40 text-clay-50 hover:bg-clay-50/15 focus-visible:outline-clay-50" : "border-ink/20 text-ink hover:bg-clay-100";
  return (
    <Link
      href={CART_PATH}
      prefetch={false}
      data-cart-link
      aria-label={count ? `Cart, ${count} ${count === 1 ? "item" : "items"}` : "Cart"}
      className={`relative flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${line}`}
    >
      <BagIcon className="h-5 w-5" />
      {count > 0 && (
        <span
          data-cart-count
          className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-terracotta px-1 text-micro font-bold text-clay-50"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

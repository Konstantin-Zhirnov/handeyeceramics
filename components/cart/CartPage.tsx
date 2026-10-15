"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ValidatedCart } from "@/lib/cart/validate";
import { formatPrice } from "@/lib/cms/text";
import { type CartPricedLine, MAX_QUANTITY } from "@/lib/cart/pricing";
import type { CartLineInput } from "@/lib/payments/types";
import { useSiteData } from "@/components/site/SiteData";
import { type CartLine, useCart } from "./CartProvider";

/** Where the check of the cart is asked for (this module) and where paying starts (the checkout routes). */
export const VALIDATE_PATH = "/cart/validate";
export const CHECKOUT_PATH = "/checkout";

const dollars = (c: number) => formatPrice(c / 100);
const key = (l: CartLineInput) => `${l.kind}:${l.id}:${l.option || ""}`;
const stepper = "flex h-10 w-10 items-center justify-center rounded-full border border-ink/20 text-ink hover:bg-clay-100 disabled:opacity-40";

/** The cart page: the lines priced by the server, the pickup studio, the way to pay (R03, R03.3, R16i, R04.3). */
export function CartPage({ shopPath = "/shop" }: { shopPath?: string }) {
  const cart = useCart();
  const { studios, phone, phoneHref } = useSiteData();
  const openStudios = useMemo(() => studios.filter((s) => s.status === "open"), [studios]);
  const [pickup, setPickup] = useState<number | undefined>();
  const [result, setResult] = useState<ValidatedCart | null>(null);
  const [checking, setChecking] = useState(false);
  const [failed, setFailed] = useState("");
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");
  const request = useRef(0);

  // The check carries the price each line last showed, so the server can flag the lines whose price moved.
  const body = JSON.stringify({ lines: cart.lines, pickupStudio: pickup });
  /** What the checkout gets: the lines without the browser's own bookkeeping. */
  const checkoutBody = () => JSON.stringify({ lines: cart.lines.map(({ seenAmount: _seen, ...l }) => l), pickupStudio: pickup });

  // Every change of the lines or the studio is priced again by the server: the prices are the admin's, not the browser's.
  useEffect(() => {
    if (!cart.ready) return;
    if (!cart.lines.length) {
      setResult(null);
      return;
    }
    const id = ++request.current;
    setChecking(true);
    setFailed("");
    fetch(VALIDATE_PATH, { method: "POST", headers: { "Content-Type": "application/json" }, body })
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return (await res.json()) as ValidatedCart;
      })
      .then((data) => {
        if (id !== request.current) return;
        setResult(data);
        if (data.studio && pickup === undefined) setPickup(data.studio.id);
      })
      .catch(() => {
        if (id === request.current) setFailed("We could not check your cart just now. Please try again in a moment.");
      })
      .finally(() => {
        if (id === request.current) setChecking(false);
      });
  }, [body, cart.ready, cart.lines.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const pay = async () => {
    setPayError("");
    setPaying(true);
    // Paying is the moment the visitor accepts the prices shown: from now on these are the ones to compare against.
    for (const l of result?.lines || []) if (!l.error) cart.seen(l, l.unitAmount);
    try {
      const res = await fetch(CHECKOUT_PATH, { method: "POST", headers: { "Content-Type": "application/json" }, body: checkoutBody() });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; message?: string; errors?: unknown };
      if (res.ok && data.url) {
        window.location.assign(data.url);
        return;
      }
      if (res.status === 409) {
        // Something sold out while the cart sat: price it again, the lines carry their errors.
        request.current++;
        setResult(null);
        setFailed("");
        setPayError(data.message || "Some items in your cart are no longer available — see the lines marked below.");
        const again = await fetch(VALIDATE_PATH, { method: "POST", headers: { "Content-Type": "application/json" }, body });
        if (again.ok) setResult((await again.json()) as ValidatedCart);
      } else {
        setPayError(data.message || `Online payment is not available right now${phone ? ` — call the studio at ${phone}` : ""}.`);
      }
    } catch {
      setPayError(`Online payment is not available right now${phone ? ` — call the studio at ${phone}` : ""}.`);
    } finally {
      setPaying(false);
    }
  };

  if (!cart.ready) return <p className="text-ink-soft">Loading your cart…</p>;

  if (!cart.lines.length) {
    return (
      <div data-cart-empty className="rounded-card border border-dashed border-clay-200 px-6 py-12 text-center">
        <p className="text-lg text-ink">Your cart is empty.</p>
        <Link href={shopPath} className="mt-5 inline-flex h-12 items-center justify-center rounded-full bg-terracotta px-7 text-copy font-semibold text-clay-50 hover:bg-ink">
          Browse the shop
        </Link>
      </div>
    );
  }

  const priced = new Map((result?.lines || []).map((l) => [key(l), l]));
  const blocked = !result || result.errors.length > 0 || result.lines.some((l) => l.error) || checking;

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
      <ul data-cart-lines className="flex flex-col divide-y divide-clay-200">
        {cart.lines.map((line) => (
          <CartRow key={key(line)} line={line} priced={priced.get(key(line))} onQuantity={(q) => cart.setQuantity(line, q)} onRemove={() => cart.remove(line)} />
        ))}
      </ul>

      <aside className="flex flex-col gap-6 rounded-panel border border-clay-200 bg-clay-100 px-6 py-6 lg:sticky lg:top-[120px] lg:self-start">
        {openStudios.length > 0 && (
          <div className="flex flex-col gap-2">
            <label htmlFor="pickup-studio" className="eyebrow text-clay-600">
              Pickup studio
            </label>
            <select
              id="pickup-studio"
              data-pickup
              value={pickup ?? ""}
              onChange={(e) => setPickup(Number(e.target.value) || undefined)}
              className="w-full min-w-0 rounded-inset border border-clay-200 bg-clay-50 px-4 py-3 text-ink"
            >
              {openStudios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <p className="text-caption text-ink-soft">Classes take place at their studio; pieces and clay are picked up here. No shipping.</p>
          </div>
        )}

        <dl data-cart-totals className="flex flex-col gap-2 text-copy text-ink">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd data-subtotal>{result ? dollars(result.subtotal) : "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Tax</dt>
            <dd data-tax>{result ? dollars(result.tax) : "—"}</dd>
          </div>
          <div className="flex justify-between border-t border-clay-200 pt-2 text-lg font-semibold">
            <dt>Total</dt>
            <dd data-total>{result ? dollars(result.total) : "—"}</dd>
          </div>
        </dl>

        {failed && (
          <p role="alert" className="text-copy text-terracotta">
            {failed}
          </p>
        )}
        {result?.errors.map((e) => (
          <p key={e} role="alert" data-cart-error className="text-copy text-terracotta">
            {e}
          </p>
        ))}
        {payError && (
          <p role="alert" data-pay-error className="text-copy text-terracotta">
            {payError}
          </p>
        )}

        <form
          method="post"
          action={CHECKOUT_PATH}
          onSubmit={(e) => {
            e.preventDefault();
            void pay();
          }}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="lines" value={checkoutBody()} />
          <input type="hidden" name="pickupStudio" value={pickup ?? ""} />
          <button
            type="submit"
            data-pay
            disabled={blocked || paying}
            className="flex h-12 items-center justify-center rounded-full bg-terracotta px-7 text-copy font-semibold text-clay-50 transition-colors hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {paying ? "Taking you to payment…" : checking ? "Checking prices…" : "Pay"}
          </button>
          {phoneHref && (
            <a href={phoneHref} className="flex h-12 items-center justify-center rounded-full bg-sky-brand px-7 text-copy font-semibold text-sky-ink">
              Call {phone}
            </a>
          )}
        </form>
      </aside>
    </div>
  );
}

function CartRow({ line, priced, onQuantity, onRemove }: { line: CartLine; priced?: CartPricedLine; onQuantity: (q: number) => void; onRemove: () => void }) {
  const changed = !!priced?.priceChanged;
  const name = priced?.label || (line.kind === "session" ? "class date" : "product");
  return (
    <li data-cart-line data-kind={line.kind} data-id={line.id} className="flex flex-col gap-3 py-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <p data-line-label className="font-semibold text-ink [overflow-wrap:anywhere]">
          {priced?.label || (line.kind === "session" ? "Class date" : "Product")}
        </p>
        {line.option && (
          <p data-line-option className="text-copy text-ink-soft [overflow-wrap:anywhere]">
            {line.option}
          </p>
        )}
        {priced && !priced.error && (
          <p className="text-copy text-ink-soft">
            <span data-line-unit>{dollars(priced.unitAmount)}</span> each
            {priced.taxLines.length > 0 && <> · tax {priced.taxLines.map((t) => `${t.code} ${t.percentage}%`).join(" + ")}</>}
            {changed && (
              <span data-price-updated className="ml-2 rounded-full bg-sky-soft px-2 py-0.5 text-micro font-bold uppercase tracking-[0.1em] text-sky-ink">
                price updated
              </span>
            )}
          </p>
        )}
        {priced?.error && (
          <p role="alert" data-line-error className="text-copy text-terracotta">
            {priced.error}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button type="button" aria-label={`Fewer: ${name}`} onClick={() => onQuantity(Math.max(1, line.quantity - 1))} disabled={line.quantity <= 1} className={stepper}>
          −
        </button>
        <span data-line-quantity className="min-w-[2ch] text-center font-semibold text-ink">
          {line.quantity}
        </span>
        <button type="button" aria-label={`More: ${name}`} onClick={() => onQuantity(Math.min(MAX_QUANTITY, line.quantity + 1))} disabled={line.quantity >= MAX_QUANTITY} className={stepper}>
          +
        </button>
        <span data-line-total className="min-w-[6ch] text-right font-semibold text-ink">
          {priced && !priced.error ? dollars(priced.unitAmount * line.quantity) : ""}
        </span>
        <button type="button" data-remove aria-label={`Remove: ${name}`} onClick={onRemove} className="ml-1 text-caption text-ink-soft underline hover:text-ink">
          Remove
        </button>
      </div>
    </li>
  );
}

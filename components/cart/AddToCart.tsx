"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { MAX_QUANTITY } from "@/lib/cart/pricing";
import { formatPrice } from "@/lib/cms/text";
import { googleEvent, metaEvent } from "@/lib/track/client";
import { CART_PATH } from "./CartLink";
import { useCart } from "./CartProvider";

/** A date of a class as the product page lists it: what to show, and whether a seat can be bought. */
export type SessionChoice = { id: number; label: string; price: number | null; sellable: boolean; left: number };
export type OptionChoice = { title: string; choices: string[] };
/** A gift card's offer, in dollars: the fixed amounts, and the range of another amount when the admin allows one. */
export type GiftOfferView = { choices: number[]; otherMin?: number; otherMax?: number };

type Props = {
  /** The product; a line of kind "product" unless a date is chosen. */
  productId: number;
  /** The product's current price in dollars (shown on the page; remembered on the line). */
  price: number | null;
  options: OptionChoice[];
  /** The dates of a class: when there are any, one must be picked and the line is a seat on it. */
  sessions: SessionChoice[];
  /** A gift card: the buyer loads it with one of these amounts; the line carries the amount instead of a price. */
  gift?: GiftOfferView;
};

const OTHER = "other";

const field = "w-full min-w-0 rounded-inset border border-clay-200 bg-clay-50 px-4 py-3 text-ink";
const stepper = "flex h-11 w-11 items-center justify-center rounded-full border border-ink/20 text-lg text-ink hover:bg-clay-100 disabled:opacity-40";

/** The buying controls of a product page (R03, R03.2, R02): the variants, the dates, the quantity, Add to cart. */
export function AddToCart({ productId, price, options, sessions, gift }: Props) {
  const cart = useCart();
  const base = useId();
  const [session, setSession] = useState("");
  const [picked, setPicked] = useState<string[]>(options.map(() => ""));
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(false);
  const [giftChoice, setGiftChoice] = useState(gift?.choices.length ? String(gift.choices[0]) : gift ? OTHER : "");
  const [giftOther, setGiftOther] = useState("");

  const chosen = sessions.find((s) => String(s.id) === session);

  /** The amount loaded on a gift card, in dollars; null when none is chosen or the other amount is out of range. */
  const giftDollars = (): number | null => {
    if (!gift) return null;
    if (giftChoice !== OTHER) return Number(giftChoice) || null;
    const n = Number(giftOther.replace(/[^\d.]/g, ""));
    if (!Number.isFinite(n) || n <= 0) return null;
    if (typeof gift.otherMin === "number" && n < gift.otherMin) return null;
    if (typeof gift.otherMax === "number" && n > gift.otherMax) return null;
    return Math.round(n * 100) / 100;
  };

  const submit = () => {
    setError("");
    setAdded(false);
    if (sessions.length && !chosen) return setError("Choose a date");
    if (options.some((_, i) => !picked[i])) return setError(`Choose ${options.map((o) => o.title).join(" and ")}`);
    if (chosen && quantity > chosen.left) return setError(`Only ${chosen.left} seat${chosen.left === 1 ? "" : "s"} left on this date`);
    const loaded = giftDollars();
    if (gift && loaded === null) {
      const range = typeof gift.otherMin === "number" ? ` between ${formatPrice(gift.otherMin)} and ${typeof gift.otherMax === "number" ? formatPrice(gift.otherMax) : "any amount"}` : "";
      return setError(`Choose an amount${range}`);
    }
    const dollars = gift ? loaded : chosen ? chosen.price ?? price : price;
    const option = gift ? `Amount: ${formatPrice(loaded!)}` : options.length ? options.map((o, i) => `${o.title}: ${picked[i]}`).join("; ") : undefined;
    cart.add({
      kind: chosen ? "session" : "product",
      id: chosen ? chosen.id : productId,
      quantity,
      ...(option ? { option } : {}),
      ...(gift ? { amount: Math.round(loaded! * 100) } : {}),
      ...(typeof dollars === "number" ? { seenAmount: Math.round(dollars * 100) } : {}),
    });
    setAdded(true);
    const item = { content_ids: [`product-${productId}`], content_type: "product", ...(typeof dollars === "number" ? { value: dollars * quantity, currency: "CAD" } : {}) };
    metaEvent("AddToCart", { ...item, num_items: quantity });
    googleEvent("add_to_cart", item);
  };

  return (
    <div data-add-to-cart className="flex flex-col gap-5">
      {gift && (
        <fieldset data-gift-amounts className="flex min-w-0 flex-col gap-2">
          <legend className="eyebrow text-clay-600">Amount *</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup">
            {gift.choices.map((c) => (
              <label key={c} className={`flex h-11 cursor-pointer items-center rounded-full border px-5 text-copy font-semibold ${giftChoice === String(c) ? "border-ink bg-ink text-clay-50" : "border-ink/20 text-ink hover:bg-clay-100"}`}>
                <input type="radio" name={`${base}-amount`} value={c} checked={giftChoice === String(c)} onChange={() => setGiftChoice(String(c))} className="sr-only" />
                {formatPrice(c)}
              </label>
            ))}
            {typeof gift.otherMin === "number" && (
              <label className={`flex h-11 cursor-pointer items-center rounded-full border px-5 text-copy font-semibold ${giftChoice === OTHER ? "border-ink bg-ink text-clay-50" : "border-ink/20 text-ink hover:bg-clay-100"}`}>
                <input type="radio" name={`${base}-amount`} value={OTHER} checked={giftChoice === OTHER} onChange={() => setGiftChoice(OTHER)} className="sr-only" />
                Other amount
              </label>
            )}
          </div>
          {giftChoice === OTHER && typeof gift.otherMin === "number" && (
            <label className="mt-1 flex min-w-0 flex-col gap-1 text-caption text-ink-soft">
              <span>
                Any amount from {formatPrice(gift.otherMin)}
                {typeof gift.otherMax === "number" ? ` to ${formatPrice(gift.otherMax)}` : ""}
              </span>
              <input
                data-gift-other
                inputMode="decimal"
                value={giftOther}
                onChange={(e) => setGiftOther(e.target.value)}
                placeholder="CA$"
                className={field}
              />
            </label>
          )}
        </fieldset>
      )}
      {sessions.length > 0 && (
        <div data-product-sessions className="flex min-w-0 flex-col gap-2">
          <label htmlFor={`${base}-date`} className="eyebrow text-clay-600">
            <span data-option-title>Date</span> *
          </label>
          <select id={`${base}-date`} value={session} onChange={(e) => setSession(e.target.value)} className={field}>
            <option value="">Select</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id} disabled={!s.sellable} data-sold-out={s.sellable ? undefined : ""}>
                {s.label}
                {typeof s.price === "number" ? ` — ${formatPrice(s.price)}` : ""}
                {s.sellable ? "" : s.left < 1 ? " — Sold out" : " — Closed"}
              </option>
            ))}
          </select>
        </div>
      )}
      {options.map((o, i) => (
        <div key={o.title} data-product-option className="flex min-w-0 flex-col gap-2">
          <label htmlFor={`${base}-option-${i}`} className="eyebrow text-clay-600">
            <span data-option-title>{o.title}</span> *
          </label>
          <select
            id={`${base}-option-${i}`}
            value={picked[i]}
            onChange={(e) => setPicked((p) => p.map((v, j) => (j === i ? e.target.value : v)))}
            className={field}
          >
            <option value="">Select</option>
            {o.choices.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      ))}

      <div className="flex min-w-0 flex-col gap-2">
        <span id={`${base}-qty-label`} className="eyebrow text-clay-600">
          Quantity
        </span>
        <div className="flex items-center gap-3" role="group" aria-labelledby={`${base}-qty-label`}>
          <button type="button" aria-label="Fewer" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1} className={stepper}>
            −
          </button>
          <span data-quantity className="min-w-[2ch] text-center text-lg font-semibold text-ink" aria-live="polite">
            {quantity}
          </span>
          <button type="button" aria-label="More" onClick={() => setQuantity((q) => Math.min(MAX_QUANTITY, q + 1))} disabled={quantity >= MAX_QUANTITY} className={stepper}>
            +
          </button>
        </div>
      </div>

      <div className="flex flex-col items-start gap-3">
        <button
          type="button"
          onClick={submit}
          data-add
          className="flex h-12 items-center justify-center rounded-full bg-terracotta px-7 text-copy font-semibold text-clay-50 transition-colors hover:bg-ink"
        >
          Add to cart
        </button>
        {error && (
          <p role="alert" data-add-error className="text-copy text-terracotta">
            {error}
          </p>
        )}
        {added && !error && (
          <p role="status" data-added className="text-copy text-ink-soft">
            Added to your cart.{" "}
            <Link href={CART_PATH} className="font-semibold text-ink underline">
              View cart
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

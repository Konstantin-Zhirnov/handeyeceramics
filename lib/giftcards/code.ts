/**
 * The pure part of gift cards: the shape of a code, the amounts a gift card
 * product offers, and how much of a balance an order takes. No CMS here —
 * lib/giftcards/index.ts reads and writes the cards.
 */
import { randomBytes } from "node:crypto";

/** Letters and digits that are not confused with each other when read out or typed: no 0/O, 1/I/L. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
/** "HE-XXXX-XXXX-XXXX": the prefix of the order numbers, three groups of four. */
export const GIFT_CODE = /^HE-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/;

/** A fresh code; `random` is replaced in tests. */
export function generateGiftCode(random: (n: number) => Buffer = randomBytes): string {
  const bytes = random(12);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]);
  return `HE-${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8, 12).join("")}`;
}

/** What a buyer typed, as a code: upper case, spaces and stray dashes dropped, the groups re-dashed. Null when it is not a code. */
export function normalizeGiftCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = raw.startsWith("HE") ? raw.slice(2) : raw;
  if (body.length !== 12) return null;
  const code = `HE-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}`;
  return GIFT_CODE.test(code) ? code : null;
}

/** The amounts a gift card product offers, in cents, from the admin's "one per line" text; empty when none parse. */
export function giftAmountChoices(text: string | null | undefined): number[] {
  const out: number[] = [];
  for (const line of String(text ?? "").split(/\r?\n/)) {
    const n = Number(line.replace(/[^\d.]/g, ""));
    if (Number.isFinite(n) && n > 0) {
      const cents = Math.round(n * 100);
      if (!out.includes(cents)) out.push(cents);
    }
  }
  return out;
}

export type GiftOffer = {
  /** Fixed amounts, in cents. */
  choices: number[];
  /** Any amount between these, in cents, when the admin allows another amount; undefined — only the choices. */
  otherMin?: number;
  otherMax?: number;
};

/** Whether a buyer may load this amount on the card. */
export function giftAmountAllowed(cents: number, offer: GiftOffer): boolean {
  if (!Number.isInteger(cents) || cents <= 0) return false;
  if (offer.choices.includes(cents)) return true;
  if (typeof offer.otherMin !== "number") return false;
  return cents >= offer.otherMin && cents <= (offer.otherMax ?? Number.MAX_SAFE_INTEGER);
}

/** How much of an order's total a card with this balance pays: all of it, or all of the balance. */
export function giftApplied(total: number, balance: number): number {
  if (!Number.isFinite(total) || !Number.isFinite(balance)) return 0;
  return Math.max(0, Math.min(Math.trunc(total), Math.trunc(balance)));
}

/** Dollars of the admin → cents, and back, for the balance fields. */
export const giftCents = (dollars: number | null | undefined) => Math.round((dollars || 0) * 100);
export const giftDollars = (cents: number) => Math.round(cents) / 100;

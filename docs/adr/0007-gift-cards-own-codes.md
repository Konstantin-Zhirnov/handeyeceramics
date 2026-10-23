# 7. Gift cards are the site's own codes, redeemed before the gateway

Date: 2026-10-22

## Status

Accepted

## Context

The old site sells gift cards through the Wix gift card widget (CA$100, 200, 370 or another amount) and takes them as payment at the Wix checkout; separate "if paying with gift card" products exist because Wix gift cards could not be applied to its Bookings services. The move to this site replaced the widget's page with plain text, which left a product the studio sells with nothing to buy.

Stripe has no gift cards of its own. A Stripe coupon applied in Checkout takes the discount off the taxable amount, so the tax collected would be lower than the tax owed on the full price — in Canada a gift card is a method of payment, not a price reduction. Stripe Checkout in payment mode also refuses a session whose total is zero, so an order a card covers in full cannot go to Stripe at all.

## Decision

- A gift card is a **product** flagged `giftCard`, with the amounts it offers (`giftAmounts`) and, optionally, a range for another amount. The cart line carries the amount the buyer chose (`amount`, cents); the line is tax exempt. The product has no price of its own.
- Paying such an order issues one document in the new **`giftcards` collection** per unit — a code `HE-XXXX-XXXX-XXXX` from an alphabet without 0/O and 1/I/L, the amount and the balance in dollars — and emails the codes to the buyer with the `gift-card` template. The editor may add a card by hand (a Wix balance carried over) and may void one; a code is never edited; nothing is deleted.
- A code typed in the cart pays `min(balance, total)` of the order. The balance is taken when the order is created, by one conditional `UPDATE … WHERE balance >= amount` — the lock the orders already use — and given back when the order expires or is abandoned. The order records `discount` and `giftCard {code, amount}`.
- What the card leaves is charged by the gateway **as one line, tax included** ("Order HE-000123 — balance after gift card"); the order keeps the lines and the tax. Stripe's receipt therefore shows one amount; the confirmation email shows the breakdown.
- An order a card **covers in full** never reaches the gateway: the cart asks for the buyer's name, email and phone, the order gets `gateway: "giftcard"` and a session id of its own (`gc_…`), and `finalizeOrder` treats that as a paid session, so the success page, the registrations and the emails are the same code path.

## Consequences

- A gift card can be bought and spent on this site from day one; Wix balances are carried over by hand in the admin.
- A gift card cannot buy a gift card (a card would buy itself), and one code per order; neither is a limit the old site's customers relied on.
- An order partly paid by a card has no per-line Stripe products (ADR 0001) — one line stands for the balance. Refunds of such orders are handled as the gateway reports them; the gift card's balance is not restored automatically on a refund.
- If the gift card email fails (the mail adapter rejects the address), the cards still exist in the admin with the buyer's email; the owner re-sends the code by hand.

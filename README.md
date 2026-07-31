# Hand Eye Ceramics — homepage redesign prototype

A Next.js prototype of a redesigned home page for
[handeyeceramics.com](https://www.handeyeceramics.com/).

Layout language is taken from the `platacard.mx_en.png` reference — full-bleed
colour hero with rounded bottom, hairline feature strip, oversized centred
statistic, numbered steps, segmented-control content switcher, dark feature
block, wide footer — redressed for a pottery studio in the site's existing
brand blue `#abd9f5` plus a warm clay palette.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:3210

## The three problems from the audit, and where they're fixed

| Problem on the live site | Fix | Where |
| --- | --- | --- |
| Page scrolls sideways on a phone | `overflow-x: clip` + `max-width: 100%` on `html`/`body`, no fixed-width blocks; the two wide elements (gallery marquee, class tabs) scroll **inside their own container** | `app/globals.css`, `components/Gallery.tsx`, `components/ClassesSection.tsx` |
| Body text too small on phones | Root font-size 17px on phones → 18px from 768px up; body copy renders 15.6–17.3px instead of the live site's 12–13px | `app/globals.css` |
| Phone number isn't tappable | Nine `tel:+17788983414` links, all ≥47px tall, incl. header, hero, every location card, footer, and a sticky bottom call bar on phones | `lib/site.ts`, `components/Header.tsx`, `components/Hero.tsx`, `components/LocationsSection.tsx`, `components/Footer.tsx` |

Verified in a headless iPhone 13 viewport: `scrollWidth === clientWidth === 390`
(no horizontal overflow), root font-size 17px, 9 `tel:` links.

## Motion

Framer Motion, kept slow and weighted to suit the subject:

- staggered hero entrance (badge → headline → copy → buttons → cut-out photo → rating card)
- one-shot `whileInView` reveals per section, with cascading children
- scroll-linked parallax on the studio panorama and rotation on the wheel photo
- `layoutId` pill that slides between the class tabs, with a crossfade of the panel
- CSS marquee for the gallery, paused on hover
- everything collapses under `prefers-reduced-motion: reduce`

## Content & assets

Copy, class details, locations, pricing and the review are from the live site;
the phone number is the studio's public listing. All photography is downloaded
from handeyeceramics.com into `public/images/`.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · Framer Motion 12 ·
Fraunces + Karla via `next/font`.

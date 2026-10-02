# Lighthouse, mobile

Measured 2026-10-01 on a production build (`npm run build`, then `next start`), local machine,
SQLite database seeded with all images (`npm run seed`). Lighthouse from `npx lighthouse`,
default mobile preset (simulated slow 4G, 4x CPU slowdown), headless Chrome, Performance only.
Three runs per template; the median is the figure.

```bash
npm run build
# PAYLOAD_SECRET and NEXT_PUBLIC_SERVER_URL are required by a production server
PAYLOAD_SECRET=<any local value> NEXT_PUBLIC_SERVER_URL=http://localhost:3408 npx next start -p 3408
node scripts/lighthouse.mjs http://localhost:3408 3 home=/ studio=/nanaimo-pottery-classes \
  studio-prototype=/classes/vancouver-chinatown page=/about-us shop=/shop \
  product=/product-page/6-week-wheel-throwing-pottery-classes-in-vancouver
```

(In Git Bash on Windows prefix the last command with `MSYS_NO_PATHCONV=1`, or the paths get rewritten.
`LH_CPU=1` in front of it replaces the preset's 4x CPU slowdown — see the second table.)

## The figure that counts: default preset

**The target — Performance 80 or more on the studio, content page, shop and product templates — is not met.**

| Template | Path | Before | Runs after | After | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|---|
| home | `/` | 36 | 43, 45, 47 | **45** | 2.3 s | 5.2 s | 2008 ms | 0.000 |
| studio | `/nanaimo-pottery-classes` | 41 | 44, 47, 46 | **46** | 2.2 s | 5.3 s | 1804 ms | 0.000 |
| studio-prototype | `/classes/vancouver-chinatown` | 39 | 44, 45, 45 | **45** | 2.4 s | 5.5 s | 1976 ms | 0.000 |
| page | `/about-us` | 48 | 54, 57, 52 | **54** | 1.8 s | 4.9 s | 1416 ms | 0.000 |
| shop | `/shop` | 33 | 46, 59, 58 | **58** | 1.8 s | 4.6 s | 1085 ms | 0.000 |
| product | `/product-page/6-week-wheel-throwing-pottery-classes-in-vancouver` | 36 | 43, 50, 51 | **50** | 2.9 s | 4.7 s | 1596 ms | 0.000 |

"Before" is the median of three runs taken the same day, before any optimisation (LCP 5.9–9.4 s, TBT 1.9–5.1 s).
The shop row was measured on a rebuild that differs from the others in one line (no link prefetch in the
product grid); before that line the shop scored 32, 33, 53.

Host `benchmarkIndex` (how fast the machine itself is, as Lighthouse measures it): median 399–448.
Lighthouse printed this warning on every run: "The tested device appears to have a slower CPU than
Lighthouse expects. This can negatively affect your performance score." It links to its guide on
calibrating the CPU slowdown: https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md#cpu-throttling

## For comparison only: the same build without the extra CPU slowdown

Same machine, same build, same command with `LH_CPU=1` (network still simulated slow 4G). This is **not** the
measurement the target was set for; it is the other bound, for a machine Lighthouse itself calls too slow for
the 4x preset. The real figure of a normal measuring machine lies between the two tables.

| Template | Path | Runs | Median | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|
| home | `/` | 52, 68, 75 | **68** | 1.3 s | 4.3 s | 500 ms | 0.000 |
| studio | `/nanaimo-pottery-classes` | 69, 81, 77 | **77** | 1.2 s | 4.2 s | 273 ms | 0.000 |
| studio-prototype | `/classes/vancouver-chinatown` | 77, 76, 77 | **77** | 1.2 s | 4.5 s | 251 ms | 0.000 |
| page | `/about-us` | 85, 86, 86 | **86** | 1.1 s | 3.9 s | 153 ms | 0.000 |
| shop | `/shop` | 85, 84, 84 | **84** | 1.2 s | 4.0 s | 159 ms | 0.000 |
| product | `/product-page/6-week-wheel-throwing-pottery-classes-in-vancouver` | 74, 64, 74 | **74** | 1.5 s | 3.9 s | 454 ms | 0.000 |

Even here the studio and product templates stay under 80, so the target is not met in either reading.

## What was changed

- The video player (Mux) was imported straight into the content blocks, so a 319 KB script (compressed) went
  to every page with blocks and was 100% unused there. It is now fetched only by a page that shows a Mux video.
- The animation library is off the shared path: the header follows the scroll with a plain listener, the
  scroll reveals are a CSS transition with the same distance, duration and curve, the studio drop-down in the
  header is a CSS transition. The class tabs keep their animation; its engine loads after the page.
  The home page's stage keeps the library — its scroll animation is built on it.
- The header and footer no longer pull the home page's stage component into every page.
- Home page on a phone: the frames of the animation (2.6 MB) are not requested until the first scroll or
  touch; until then the poster is the picture, and the phone gets the 960px poster (25 KB instead of 86 KB).
- Shop: the first row of products loads at once and the first picture with high priority; the grid no
  longer prefetches every product page (that alone took the shop from 33 to 58).
- The first picture of the studio and product templates already had `priority` and `sizes`.

## What holds the figure (from the Lighthouse reports)

- **Total Blocking Time, 1.1–2.0 s at 4x.** After the changes it is the framework itself: one long task of
  0.9–1.0 s in the React/Next chunk (hydration) and 1.5–2 s of "Style & Layout" for the document. On this
  machine a page with almost nothing on it — the framework's own error page — scored 50 and 60 in two single
  runs (TBT 1.7–1.8 s), so 80 was out of reach here whatever the page contained.
- **Largest Contentful Paint, 3.9–4.5 s even without the CPU slowdown,** while First Contentful Paint is
  1.1–1.5 s. The largest element was a paragraph of text on the content page, the text card of the hero on the
  studio page and the first product picture in the shop. Why it lands that late was not established.
- The server is not the bottleneck: a warm production server answers in 0.2–0.6 s on this machine.
- Layout does not shift: CLS is 0 everywhere.

## What can still be done

1. Measure on the test address from a normal machine (or PageSpeed Insights) before quoting a figure to anyone.
2. Find what delays LCP after the first paint: candidates are the entrance animation of the hero and of the
   first blocks, and the three font files (131 KB, all preloaded) swapping in. Not verified.
3. Fewer client components: the footer and the home and studio sections are client components only because
   they read the site data from a context and wrap themselves in the reveal. Passing the data as props makes
   them server components and leaves the header, the tabs and the forms to hydrate.
4. Home page: the stage still loads the animation library with the first screen; it could wait for the
   first scroll, like the frames.

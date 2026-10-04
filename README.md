# Hand Eye Ceramics — new site and admin

The new site of [handeyeceramics.com](https://www.handeyeceramics.com/), moved from Wix. One
Next.js app serves both the public site and its admin:

- the **site** — every page is rendered from the CMS database: home, studios with their
  timetables, classes, the shop, product pages, plans, the contact and commission forms;
- the **admin** at `/admin` ([Payload CMS](https://payloadcms.com/)) — classes, prices, texts,
  photos, videos, products, redirects and the enquiries sent through the forms;
- the **APIs** of the CMS — REST at `/api`, GraphQL at `/api/graphql`.

The old site's pages, products and pictures were crawled into `content/` and are loaded into the
CMS by the seed; the old addresses keep working through 301 redirects managed in the admin.

## Run it

```bash
npm install
cp .env.example .env     # every empty optional value turns that service off
npm run seed             # fills the database from content/inventory.json
npm run dev              # site and admin on http://localhost:3210
```

Open http://localhost:3210/admin and create the first editor. Without changes to `.env` the
database is a local SQLite file (`handeye.db`), uploads go to `media/`, and e-mails about new
enquiries are written to the server log. `.env.example` lists the settings for Postgres, Vercel
Blob, Mux video and SMTP.

`npm run seed` is idempotent: run it again after the crawl changes. `SEED_IMAGES=0` seeds
without pictures.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | site and admin on http://localhost:3210 |
| `npm run seed` | fills the CMS from `content/inventory.json` |
| `npm test` | unit tests and the site tests (the site tests start their own server on a throw-away database; ~25 min) |
| `npx vitest run --project unit` | unit tests only, seconds |
| `npm run test:mobile` | opens every address of the old site at 390px in a browser |
| `npm run howto` | records the admin how-to videos into `handover/` on a throw-away database |
| `npm run build` / `npm run start` | production build and server (needs `NEXT_PUBLIC_SERVER_URL` and `PAYLOAD_SECRET`) |
| `npm run generate:types` | rebuilds `payload-types.ts` after a change to the collections |
| `python scripts/crawl/crawl.py` | crawls the old site into `content/` (`python scripts/crawl/validate.py` checks it) |

## Layout

```
app/(site)/       the public site: home, the catch-all route that renders any CMS document, the form endpoint
app/(payload)/    the admin, REST and GraphQL of Payload
collections/      CMS collections, page blocks, field rules and access
globals/          site settings and the home page
lib/cms/          reading the CMS for the site: routing, SEO, texts, media
components/       the design system and the blocks, forms, shop and studio parts
content/          the crawl of the old site and the reports made from it
scripts/          the seed, the crawl and the how-to recorder
tests/            unit tests and tests against a running site
proxy.ts          301 redirects from the CMS before a page renders
```

## Not in git

The database (`*.db`), uploads (`media/`), the downloaded pictures of the old site
(`content/images/`, fetched again by `scripts/crawl/crawl.py`), the how-to videos (`handover/`)
and `.env` stay on the machine. On a fresh clone the seed runs without pictures until
`content/images/` is downloaded.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · Payload CMS 3 · SQLite or Postgres ·
Bodoni Moda + Karla via `next/font` · Vitest and Playwright for tests.

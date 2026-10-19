# Hand Eye Ceramics — правила проекта

В репозитории две вещи:

1. **Код** — прототип нового сайта на Next.js (см. `README.md`). Данные студий, занятий и
   расписаний живут в `lib/site.ts`. Запуск: `npm run dev`, порт 3210.
2. **База знаний** о клиентском проекте — `raw/` и `wiki/`, по паттерну LLM Wiki
   (оригинал — `raw/karpathy-llm-wiki.md`).

**Тематика базы:** клиентский проект Hand Eye Ceramics — редизайн и переезд сайта гончарной
студии с тремя площадками (Чайнатаун и Mt Pleasant в Ванкувере, Нанаймо, в планах Калгари)
с Wix на новый сайт. Переписка с владельцем, аудит сайта, предложение и цена, обещания
клиенту, технические решения и их причины.

---

## Начало каждой сессии

Проект идёт: заказчик согласился, работа ведётся по четырём этапам. **До любой работы по
проекту** прочитай:

1. `wiki/concepts/delivery-plan.md` — статус, текущий этап, чек-листы, что блокирует;
2. `wiki/concepts/open-questions.md` — что ещё не получено от владельца;
3. последние записи журнала: `grep "^## \[" wiki/log.md | tail -5`.

Обещанное клиенту — `wiki/concepts/commitments.md`; за его пределы без согласования не выходи.
Закончил пункт плана — отметь `[x]` с датой и запиши событие в журнал.

---

## Приватность: репозиторий публичный

`raw/` и `wiki/` лежат **вне git** (`.gitignore`). В них переписка с клиентом, цены, торг и
его опасения — этому не место на публичном GitHub.

- Никогда не убирай `raw/` и `wiki/` из `.gitignore` и не коммить их содержимое.
- Не переноси знание из вики в файлы под версиями (`README.md`, комментарии в коде, этот файл).
  Здесь — только правила.
- **Секретов нет нигде:** пароли, токены, ключи API, коды от дверей студий, пароль страницы
  преподавателей, данные карт. Даже в `raw/` — если исходник их содержит, вырежи до сохранения.
- Личные данные: только то, что владелец публикует как бизнес (адреса студий, рабочий телефон,
  info@-почта). Имена учеников, их контакты, личные данные владельца — нет.

---

## Память: три слоя

| Слой | Что там | Кто пишет |
|---|---|---|
| `raw/` | неизменяемые исходники: письма, выгрузки аудита, версии предложения, заметки со встреч | человек (модель — только по прямой просьбе сохранить исходник) |
| `wiki/` | знание: страницы, индекс, журнал | модель |
| этот файл | схема: устройство и правила работы | человек и модель совместно |

`raw/` **не редактируется никогда**. Исходник кладётся датированным файлом:
`raw/ГГГГ-ММ-ДД-<что-это>.md`, например `raw/2026-08-12-owner-questions-email.md`.
Письма — выгрузкой текста без цитируемого хвоста. Знание из `raw/` извлекается в `wiki/`,
а не копируется целиком.

### Что идёт в вики, а что нет

В вики — то, что читают и синтезируют: бизнес и его студии, владелец как заказчик (что ему
важно, чего он боится, как с ним связываться), объём работ и цена, **обещания клиенту**,
технические решения и их причины, аудит сайта, открытые вопросы.

Не идёт: структура кода (её знает код), черновые файлы и PDF (они в `raw/` или вне репозитория),
пересказ переписки письмо за письмом (для этого есть `sources/`).

---

## Правила страниц

- **Перед созданием страницы проверь, нет ли уже близкой по смыслу.** Прочитай `wiki/index.md`,
  затем поищи по `wiki/` ключевые слова **на обоих языках и синонимы** (`redirect`,
  `редирект`, `301`, `переезд`). Нашлась близкая — дополни её, а не заводи вторую. Сомневаешься —
  спроси. Дубли — главная болезнь растущей вики.
- **Имя файла** — латиницей, в нижнем регистре, через дефис, существительным, без дат:
  `studio-nanaimo.md`, `redirect-policy.md`. Дата бывает только у `sources/`. Заголовок внутри —
  по-русски.
- **Раскладка:**
  - `entities/` — конкретные вещи: бизнес, студии, владелец, прототип, внешние сервисы
    (Stripe, Wix, Sage), документы (предложение, шпаргалка);
  - `concepts/` — правила, решения, процессы: политика редиректов, объём работ, налоги,
    запись на занятия, план переезда;
  - `sources/` — по странице на исходник из `raw/` или на внешний ресурс: что это, когда,
    что из него взято и на какие страницы разошлось.
- **У каждого факта источник и дата проверки.** Факт — это пункт списка или строка таблицы
  со своей сноской. Проза связывает разделы и фактов не содержит.

  ```markdown
  - Владелец просит подтверждать встречи только SMS: почту он почти не читает.[^sms]

  [^sms]: `raw/2026-09-27-owner-reply.md` — проверено 2026-09-30 — «please only verify via text»
  ```

  Части сноски разделяет тире с пробелами; источник — путь от корня в обратных кавычках или URL.
  Цитата необязательна, но **если она есть, она лежит в источнике дословно.**
- **Обещанное клиенту помечается отдельно** и с версией документа: «обещано в предложении от
  2026-09-30». Внутренние решения и догадки — отдельно. Смешать их — значит однажды
  пообещать клиенту черновую мысль.
- **Новое не стирает старое молча.** Если новый источник меняет факт (цену, срок, объём работ),
  старый факт остаётся строкой «было … до ГГГГ-ММ-ДД» со своей сноской, а в журнале — запись.
  Противоречие без разрешения помечается `> ⚠ Противоречие:` прямо на странице.
- Связывай страницы ссылками `[[имя-страницы]]`. У каждой страницы, кроме индекса и журнала,
  есть раздел «Связи» и хотя бы одна входящая ссылка; индекс входящей не считается.
- `wiki/index.md` обновляется при появлении и изменении страницы.

---

## Операции

**Ingest** — «добавь в вики», «разбери письмо/файл». Прочитай исходник целиком → скажи
главное в 3–5 пунктах → проверь индекс на близкие страницы → создай страницу в `sources/` →
обнови или создай затронутые `entities/` и `concepts/` → обнови индекс → запись в журнал.
Один исходник за раз, если не сказано иначе.

**Query** — «что мы знаем про…», «что мы обещали по…». Сначала индекс, потом страницы, ответ
со ссылками на страницы. Ответ, который пригодится ещё раз (сравнение, разбор, вывод),
предложи сохранить в вики страницей.

**Lint** — **раз в неделю** (или по просьбе «проверь вики»). Ищи:
- битые `[[ссылки]]` и страницы без входящих ссылок или вне индекса;
- факты без сноски и цитаты, которых нет в источнике;
- дубли и близкие по смыслу страницы;
- противоречия между страницами, особенно между обещанным клиенту и внутренними решениями;
- устаревшее: источник новее даты проверки, или факт не перепроверяли больше 90 дней;
- расхождения вики с кодом, где вики описывает прототип (`lib/site.ts`: студии, расписания);
- секреты и личные данные;
- открытые вопросы к владельцу, которые так и не закрыты.

Итог — список находок с файлом и строкой; чинится правкой страницы. Запись в журнал
обязательна, даже если находок нет.

## Журнал

`wiki/log.md` — только добавление. Префикс держи парсящимся:

```
## [ГГГГ-ММ-ДД] операция | заголовок
```

Операции: `setup`, `ingest`, `query`, `lint`, `decision`, `meeting`.

```bash
grep "^## \[" wiki/log.md | tail -5
```

<!-- autopilot:start -->
## Код: сайт и админка

Одно приложение Next.js 16.3 (App Router, React 19, Tailwind v4) + Payload CMS 3.90: публичный сайт рендерится из базы CMS, админка — `/admin`, REST — `/api`, GraphQL — `/api/graphql`. Node 23, `"type": "module"`, Windows.

### Команды

| Команда | Что делает |
|---|---|
| `npm install` | зависимости |
| `npm run dev` | сайт и админка на http://localhost:3210 (тот же запуск — `.claude/launch.json`); окружение — `.env`, поверх него `.env.development.local` |
| `npm run seed` | наполняет базу из `DATABASE_URI` описью `content/inventory.json` и данными `lib/site.ts`; группы налога товаров — из `content/tax-groups.json` (налоговые группы Wix); идемпотентно. Читает **только `.env`** — локальная база задаётся в окружении: `npx cross-env DATABASE_URI=file:./handeye.db BLOB_READ_WRITE_TOKEN= SEED_FIXES=0 npm run seed` |
| `npx cross-env SEED_IMAGES=0 npm run seed` | сид без загрузки картинок: уже лежащие в медиатеке остаются привязаны (так безопасно пересевать staging); `SEED_IMAGES="/a,/b"` — картинки только этих страниц |
| `npm test` | все тесты (unit + site), ~23 мин |
| `npx vitest run --project unit` | только юниты, секунды |
| `npm run test:mobile` | браузерный обход всех адресов описи на 390px (`MOBILE_ALL=1`) |
| `npm run build` | продакшен-сборка; с Postgres в `.env` без `PAYLOAD_SECRET` падает — локально собирать с `DATABASE_URI=file:./handeye.db` в окружении |
| `npm run start` | прод-сервер на 3210; в `.env` нужны `NEXT_PUBLIC_SERVER_URL` и `PAYLOAD_SECRET` |
| `npm run generate:types` | пересобрать `payload-types.ts` после правки коллекций и глобалов |
| `npm run generate:importmap` | пересобрать `app/(payload)/admin/importMap.js` после правки конфига, плагинов или admin-компонентов (`components/admin/`); компоненты Mux попадают в карту через заглушки `MUX_TOKEN_*` в скрипте |
| `npm run stripe:setup` | в аккаунте Stripe по `STRIPE_SECRET_KEY` создаёт продукты и месячные цены тарифов-абонементов (`period` содержит «month», есть `price`) и пишет их id в `plans.stripePriceId`; идемпотентен (продукт — по `metadata.cms_kind=plan`/`cms_id`, цена — активная recurring cad/month той же суммы); `-- --webhook <url>` заводит endpoint вебхука с событиями `WEBHOOK_EVENTS` (существующий по тому же url переиспользует и дописывает события), секрет печатает только первыми символами — полный кладёт `--secret-file <path>` (внутри рабочей копии — только путь под `.gitignore`) или `--write-env` (строка `STRIPE_WEBHOOK_SECRET` в `.env.development.local`); `--dry-run` — только отчёт. Окружение — как у `next dev`: `.env`, поверх `.env.development.local`, поверх обоих переменные процесса; для staging задай `DATABASE_URI` (и `BLOB_READ_WRITE_TOKEN`) из `.env` в окружении процесса. В PowerShell `--` берётся в кавычки: `npm run stripe:setup '--' --dry-run` |
| `npm run howto` | 7 роликов-инструкций по админке в `handover/videos/` и `handover/README.md`; часть — `npm run howto -- --only 03,05` |
| `npm run newsletter:import -- <wix-contacts.csv> [<part2.csv>] --tags "Nanaimo=Nanaimo,Vancouver=Vancouver" [--dry-run]` | переносит подписчиков из выгрузки Wix Contacts в Mailchimp (`MAILCHIMP_*` из `.env`, поверх `.env.development.local`): только «Subscribed», уже стоящих в списке не трогает, тег — по городу контакта из `--tags`; dry run печатает статусы Wix и города без тега. Выгрузку держать вне рабочей копии и удалить после переноса |
| `node scripts/lighthouse.mjs http://localhost:3210 3` | Lighthouse (mobile, Performance), медиана прогонов; сервер — `npm run build` + `npm run start` на базе с картинками; цифры — `content/lighthouse.md` |
| `python -m unittest discover -s scripts/crawl -p "test_*.py"` | тесты обходчика старого сайта |

### Структура

```
app/(site)/        публичный сайт: page.tsx (главная), [...path]/ (диспетчер + render*), forms/enquiry/route.ts, teachers/ (страница под паролем + unlock);
                   продажи: cart/ (страница и POST validate), checkout*/ (заказ, success, fake + fake/pay, subscribe), invoice/[token]/ (инвойс клиента + POST pay), stripe/webhook/, cron/daily/, exports/ (CSV)
app/(payload)/     обвязка Payload: /admin, /api, /api/graphql; importMap.js генерируется
app/robots.ts, app/sitemap.ts   robots по SITE_ENV; sitemap из CMS на каждый запрос
collections/       index.ts — коллекции контента; orders.ts — продажи (sessions, orders, registrations, holds, subscriptions, email-templates); invoices.ts — инвойсы; blocks.ts — блоки страниц; fields/ — path, доступ, seo; hooks/ — письмо о заявке, «работы готовы»
globals/           index.ts — глобалы settings и home
lib/cms/           чтение CMS для сайта: resolve, site, seo, text, media, address; payload — единственный ленивый загрузчик Payload, relations — relId
lib/booking/       места: availability (остаток, батч), holds (удержания, подтверждение мест)
lib/payments/      шлюз (Stripe / поддельный), Checkout, завершение заказа, оплата инвойса, вебхуки, ставки налога; db — условный UPDATE как замок
lib/invoices/      totals — суммы, налог и статус инвойса (чистое)
lib/cart/          проверка состава корзины и цены строк
lib/mail/          шаблоны писем (keys — ключи), подтверждение заказа, напоминания, «работы готовы»
lib/track/         рекламные теги: config (из env), purchase (покупка и тело Conversions API), client (fbq/gtag в браузере)
lib/newsletter/    Mailchimp: mailchimp (API, subscribe), index (покупатель с галочкой → список с тегом города студии)
lib/teachers.ts    пароль страницы преподавателей: cookie-хэш пароля, чтение глобала
lib/site.ts        данные прототипа: вход сида, страницы их не читают
lib/time.ts        часовой пояс студий и смещение в минутах (экспорты, сид)
components/        дизайн-система прототипа (корень) + blocks/, forms/, shop/, location/, site/, cart/ (корзина, storage — localStorage), admin/ (компоненты админки)
content/           опись старого сайта и отчёты по ней; images/ — вне git
docs/adr/          ADR 0001–0006 — решения этапа продаж
scripts/           seed/ (опись → CMS), stripe/ (setup и чистые plans), newsletter/ (import и чистый wix — перенос подписчиков), howto/ (запись роликов), crawl/ (Python, обход), lighthouse.mjs
tests/             unit/ — без сервера (stubs/ — заглушка `server-only`); site/ — HTTP по поднятому сайту
proxy.ts           301 из коллекции redirects до рендера
payload.config.ts  конфиг CMS; адаптеры БД, файлов, видео и почты выбираются по env
media/, handeye.db, handover/, .next/, .vercel/   локальные данные, сборка и линк Vercel — вне git
```

### Ключевые файлы

- `lib/cms/payload.ts` — `getCMS(): Promise<Payload>`: единственный ленивый загрузчик Payload (без `server-only`, конфиг импортируется при первом вызове); `lib/cms/resolve.ts` реэкспортирует его для страниц. `lib/cms/relations.ts` — `relId(v)` (id связи при любой глубине). `lib/time.ts` — `STUDIO_TIME_ZONE`, `offsetMinutes(at, timeZone?)`.
- `lib/cms/resolve.ts` — `resolvePath(path): Promise<Resolved | { redirect: string } | null>`, `getCMS`, `redirectTarget(rule)`, `PLANS_PATH`, `SHOP_PATH`. `Resolved` = `{kind:'studio', doc: Studio, page?: Page}` | `{kind:'product', doc: Product}` | `{kind:'plans'|'shop'|'page', doc: Page}`.
- `lib/cms/site.ts` — `getSiteData()`, `studioView(doc, site)`, `studioSchedule(doc)`, `classTabs(studioId?)`, `getHome()` → `{ hero, seo, gallery, text(key), list(prefix) }`, `homePage()`, `sitePaths()`, `phoneHref(display)`, `addressParts(address)` (из `lib/cms/address.ts`), `MEMBERSHIP_PATH`.
- `lib/cms/seo.ts` — `metadataFor(r: Resolved)`, `pageText(page)`; `lib/cms/text.ts` — `excerpt(text, max=155)`, `formatPrice(n)`, `lexicalText(v)`, `SITE_NAME`, `SITE_SUFFIX`, `SITE_URL`; `lib/cms/media.ts` — `mediaSrc(url)`.
- `lib/server-url.ts` — `serverURL(env?)`: единственный источник адреса сайта (canonical, sitemap, JSON-LD, таблица редиректов); `instrumentation.ts` вызывает его при старте.
- `lib/rate-limit.ts` — `rateLimiter({limit, windowMs}) → {allow(key, now?)}`, `SENDER_LIMIT` (5 за 10 мин), `addressOf(headers)` (loopback → `undefined`, лимит не применяется).
- `collections/fields/path.ts` — `normalizePath(input)`, `pathField()`; `collections/fields/common.ts` — `contentAccess`, `readWhenFlagged(flag)`, `flaggedContentAccess(flag)`, `readClassOfPublishedStudio`, `seoField`, `publishedField`, `photosField()`.
- `components/blocks/Blocks.tsx` — `<Blocks blocks />`; слаги блоков: `text, image, gallery, video, cta, form, classList, productList, planList`.
- `components/site/SiteShell.tsx` — `<SiteShell currentLocation? flush?>` (async; шапка и подвал всех шаблонов), `<PageHeading eyebrow? title>`; `components/site/SiteData.tsx` — `<SiteDataProvider value>`, `useSiteData()`, типы `SiteData`, `StudioCard`, `StudioView`, `ClassTab`.
- `components/forms/definitions.ts` — `FORMS: Record<EnquiryType, FieldDef[]>`, `validate(type, input) → {errors, values}`, `answersOf(type, values)`, `isVisible(field, values)`, `isEnquiryType(v)`; `components/forms/EnquiryForm.tsx` — `<EnquiryForm type studio? />`.
- `components/shop/data.ts` — `allProducts()`, `productsOfList({category, all})`, `allPlans()`, `plansIn(group?)`, `storefronts()`, `studioPhone()`, `splitCategories()`, `sessionChoices(product, now?)` (даты товара глазами посетителя); `components/shop/parts.tsx` — `<Price>`, `<ProductGrid>`, `<ProductShelves>`, `<PlanList plans grouped?>`, `<StorefrontNav current>`, `<SubscribeButton plan>`, `<CallStudio>`, `optionChoices(options)`, `SUBSCRIBE_PATH`.
- `components/cart/` — `<CartProvider>`, `useCart() → {lines, count, ready, add, setQuantity, remove, seen, clear}`, `<AddToCart productId price options sessions />`, `<CartLink light?>`, `<CartPage>`, `<ClearCart order>`; `storage.ts` — `CART_KEY`, `createCartSync(storage)`.
- `scripts/seed/index.ts` — сид; ключи идемпотентности: `path` / `title` (classes) / `name` (plans) / `filename` (media) / `from` (redirects); заодно пишет `content/seo-fixes.md`; `scripts/seed/sessions.ts` — `parseSessionLabel(label, floor)`.
- `scripts/stripe/plans.ts` (чистое) — `subscriptionPlans(plans)`, `syncPlan(setup, plan, {dryRun?})`, `ensureWebhookEndpoint(client, url, {dryRun?})`; `scripts/stripe/setup.ts` — CLI `npm run stripe:setup`.
- `lib/booking/availability.ts` — `availability(sessionId, payload?, now?, req?) → {seats, sold, held, left}`, `availabilityOf(sessions: {id, seats}[], payload?, now?, req?) → Map<id, Availability>` (два запроса на весь набор), `isSellable(session, now?)`, `SEATED_STATUSES` (`confirmed`, `imported` — оба занимают место); `lib/booking/holds.ts` — `holdSeats(items: {sessionId, qty}[], ref, ttlMs, payload?, now?) → {ok:true} | {ok:false, short}`, `releaseHolds(ref, payload?)`, `confirmSeats(orderId, payload?)`.
- `lib/payments/tax.ts` — `ratesFor(province, taxGroup)`, `MEMBERSHIP_PROVINCE` (тарифы облагаются как `service` в BC); `scripts/seed/tax-groups.ts` — `GOODS_PATHS`, `taxGroupOf(path)`.
- `lib/payments/index.ts` — `gateway(): PaymentGateway | null`, `CHECKOUT_TTL_MS` (30 мин — сессия Checkout и удержания), `PAYMENT_UNAVAILABLE`, `stripeDashboardUrl(kind, id)`, `createCheckoutForOrder(order, origin, payload?)`, `createSubscriptionCheckout(plan, origin)`, `studioProvince(studio)`, `finalizeOrder(stripeSessionId, payload?)`, `handleWebhookEvent(event, payload?)`, `WEBHOOK_EVENTS`, `fakeGateway()`, `stripeGateway(secretKey, client?)`, `CURRENCY`, `ratesFor(province, taxGroup)`, `trackPurchase(orderId)` (заглушка), `createInvoiceCheckout(invoice, origin)` (на остаток `due`), `finalizeInvoicePayment(sessionId, payload?)` (платёж пишется один раз: замок — колонка `claimed_session`, повтор — по `ref`), `invoiceUrl(token)`, `invoicePaidLetter`; типы — `lib/payments/types.ts`; `collections/orders.ts` — `orderNumber(id)` → `HE-000123`.
- `lib/track/config.ts` — `trackingConfig(env?) → {metaPixelId?, metaCapiToken?, metaTestEventCode?, googleAdsId?, googlePurchaseLabel?}`; `lib/track/purchase.ts` — `purchaseData(order)`, `purchaseEventId(number)` (`purchase-HE-000123`, общий у пикселя и CAPI), `metaPurchaseBody(order, {sourceUrl, testEventCode?})`, `normalPhone`, `META_GRAPH_VERSION`; `lib/track/client.ts` — `metaEvent`, `googleEvent`, `pageView`, `whenReady`; `components/site/Tracking.tsx` — `<Tracking>` в макете `(site)`; `components/site/TrackEvents.tsx` — `<RouteViews>`, `<TrackOnMount meta? google? once?>`. `trackPurchase(orderId, payload?, {config?, fetch?})` в `lib/payments/track.ts` шлёт CAPI после оплаты.
- `lib/newsletter/mailchimp.ts` — `mailchimpConfig(env?)`, `mailchimp(cfg, method, path, body?)`, `subscribe(cfg, subscriber)` (`status_if_new`, отписавшегося не возвращает), `subscriberHash`, `splitName`; `lib/newsletter/index.ts` — `addBuyerToList(orderId, payload?)`, `studioTag(studio)` (город из адреса); `scripts/newsletter/wix.ts` — `parseCsv`, `findColumns`, `parseCityTags`, `wixSubscribers(files, tags)`.
- `lib/teachers.ts` — `readTeachersPage(payload?)`, `passwordMatches(typed, actual)`, `teachersToken(password)`, `tokenOpens(token, actual)`, `TEACHERS_PATH`, `TEACHERS_COOKIE`.
- `lib/invoices/totals.ts` (чистое) — `invoiceTotals(lines, province, payments, voided?) → {lines, subtotal, taxes, tax, total, paid, due, status}` (центы; налог строки — как в корзине), `invoiceNumber(id)` → `INV-00042`, `INVOICE_TOKEN`, `INVOICE_STATUS_LABELS`, `INVOICE_DEFAULT_PROVINCE`.
- `lib/cart/validate.ts` — `validateCart(input: unknown[], pickupStudioId?, payload?, now?) → {lines: CartPricedLine[], errors, subtotal, tax, total, studio}`, `parseLine(input)`, `sessionPrice(session, product)`; `lib/cart/pricing.ts` (чистое) — `priceLine(line, item, province)`, `totals(lines)`, `cents(dollars)`, `MAX_QUANTITY`.
- `lib/mail/index.ts` — `renderTemplate(body, vars)`, `sendTemplate(key, to, vars, payload?)`, `sendOrderConfirmation(orderId, payload?)`, `sendPiecesReady(sessionId, payload?)`, `runDailyMail(now?, payload?) → {reminders, followups}`, `inBackground(work)`; `lib/mail/keys.ts` — `EMAIL_TEMPLATE_KEYS`, `TemplateKey`, `EMAIL_TEMPLATE_LABELS` (select коллекции и сид выводятся из них).
- `app/(site)/exports/csv.ts` — чистые `csvCell`, `toCSV(rows)` (BOM, CRLF, RFC 4180, защита от формул), `orderRows(orders)`, `registrationRows(registrations)`, `ORDER_COLUMNS`, `REGISTRATION_COLUMNS`; `app/(site)/exports/period.ts` — `dayRange(from?, to?, tz) → {from, to} | null`, `startOfDay(day, tz)`, реэкспорт `STUDIO_TIME_ZONE`; `shared.ts` — `editorOf(request)`, `csvFile(rows, filename)`.
- `tests/site/global-setup.ts` — поднимает тестовый сайт (`PAYMENT_GATEWAY=fake`; одноразовые секреты cron и вебхука — тестам через `inject("cronSecret")`, `inject("webhookSecret")`); `tests/site/editor.ts` — `editorToken(base)`; `tests/site/cms-update.ts` — правка CMS из теста через Local API (переменная `CMS_UPDATE`); `tests/unit/payments-harness.ts` — `tempCMS()`, `seedClassDate(payload, seats, suffix?)`.

### Архитектура

Путь запроса:
1. `proxy.ts` (proxy в Next 16 — бывший middleware) ловит GET/HEAD ко всему, кроме `api|admin|_next|media|images|assets|favicon|robots.txt|sitemap.xml`: читает таблицу из `GET /api/redirects` (кэш 10 с) и отвечает 301; POST не редиректит (иначе `POST /checkout` уезжал бы на `/cart`).
2. `/` → `app/(site)/page.tsx`; любой другой адрес → `app/(site)/[...path]/page.tsx`, который только диспетчеризует; статические маршруты сайта — `app/(site)/<name>/route.ts|page.tsx`, вне catch-all.
3. `resolvePath` ищет по `path` в порядке: redirects → studios (плюс документ pages с тем же `path` — приходит как `page`) → products → pages. `plans` — страница с `PLANS_PATH`; `shop` — `SHOP_PATH` или любая страница с блоком `productList`; `null` → 404.
4. По `kind` — `renderStudio(doc, page?)`, `renderProduct(doc)`, `renderShop(doc)`, `renderPlans(doc)`, `renderPage(doc)` в `app/(site)/[...path]/`; метаданные — `metadataFor`.

- Данные — только из CMS через Payload Local API (`getCMS()`); по HTTP к себе ходит один `proxy.ts` — за таблицей редиректов.
- Коллекции: users, media (alt обязателен), videos, studios, classes, pages, products, plans, enquiries, redirects (плагин; цели — pages, studios, products); продажи (группа Sales, `collections/orders.ts`): sessions (даты занятия с местами; виртуальные `sold`/`left` считаются хуком `afterOperation` на весь результат `find`/`findByID`, `context.skipAvailability` отключает), orders (пишет только сервер; редактор правит `status` и `note`, удаление запрещено; статусы `pending, finalizing, paid, expired, canceled, refunded, partially_refunded`; виртуальные `totalDisplay`, `stripeUrl`), registrations (ученики; редактор может добавить руками — статус `imported`, место занимает), holds (скрыта), subscriptions (только чтение, обновляет Stripe), email-templates, invoices (`collections/invoices.ts`: строки в долларах, хук `beforeChange` считает суммы в центах и `status` `open, partially_paid, paid, void`; `token` ссылки ставится один раз и правкой не меняется; платежи картой дописывает сервер, e-transfer — редактор; удаление запрещено, вместо него `voided`). Глобалы: `settings` (телефон, почта, instagram, меню, подвал, `stripePortalUrl`, `invoices.gstNumber`, `invoices.paymentNote`), `teachers` (пароль семестра, текст, преподаватели со студией и телефоном; читают только вошедшие, страница — через `readTeachersPage`) и `home` (hero, seo, gallery, `sections` по ключам: `classes`, `gallery`, `reviews`, `locations`, `other-studios`, `membership`, `feature-N`, `perk-N`, `review-N`, `step-N`, `stage-N`).
- Продажи: `GET /cart`, `POST /cart/validate`, `POST /checkout` (лимит → `validateCart` → заказ `pending` → `holdSeats` → Checkout; 409 с `errors`/`short`, 503 без шлюза), `GET /checkout/success?session_id=` (сам зовёт `finalizeOrder`), `GET /checkout/fake` + `POST /checkout/fake/pay` (только поддельный шлюз), `POST /checkout/subscribe`, `GET /invoice/<token>` (инвойс клиента по токену, noindex; `?session_id=` сам зовёт `finalizeInvoicePayment`) + `POST /invoice/<token>/pay` (лимит → Checkout на остаток → 303), `POST /stripe/webhook` (подпись Stripe, `WEBHOOK_EVENTS`), `GET /cron/daily` (`Authorization: Bearer $CRON_SECRET`, `vercel.json`), `GET /exports/orders.csv?from=YYYY-MM-DD&to=YYYY-MM-DD` и `GET /exports/registrations.csv?session=ID` (CSV для вошедшего редактора: cookie админки или `Authorization: JWT`; 401 без входа, 404 без даты, 400 при кривом периоде; период — календарные дни `STUDIO_TIME_ZONE` по `paidAt`, неоплаченные заказы не выгружаются). Деньги в заказах и Stripe — целые центы, `cad`; в CMS цены — доллары. В коде нет id объектов Stripe: продукты и ставки ищутся по метаданным.
- Реклама: `<Tracking>` грузит пиксель Meta и тег Google только при `META_PIXEL_ID` / `GOOGLE_ADS_ID`, баннера cookies нет (решение владельца). События: PageView (и на клиентских переходах), ViewContent/`view_item` на товаре, AddToCart/`add_to_cart`, InitiateCheckout/`begin_checkout` по «Pay», Purchase на `/checkout/success` с `eventID` = `purchaseEventId` и, при `GOOGLE_ADS_PURCHASE_LABEL`, `conversion` с суммой и `transaction_id` (один раз на браузер, ключ в localStorage). С `META_CAPI_TOKEN` `POST /checkout` кладёт в `orders.tracking` cookies `_fbp`/`_fbc`, адрес и user-agent, а `payOrder` шлёт серверную копию покупки (`trackPurchase`); ошибка CAPI пишется в лог и заказ не ломает. Сумма — `total` с налогом, как слал Wix.
- Рассылка: галочка «Email me new class dates» в корзине → `orders.newsletter` → после оплаты `addBuyerToList` (Mailchimp, теги — города студий заказа). Без `MAILCHIMP_*` ничего не уходит.
- Страница преподавателей: `GET /teachers` (noindex) — форма пароля или список; `POST /teachers/unlock` — лимит 5 за 10 мин, при совпадении cookie `he_teachers` = HMAC пароля (смена пароля выключает все старые), 303 назад, `?wrong=1` / `?wait=1`. В письмах — `{{teachers_url}}` и `{{teachers_password}}`.
- Правка в админке видна на следующем запросе: все публичные маршруты и sitemap — `force-dynamic`, кэша и revalidate нет; новое правило редиректа — в пределах 10 с.
- Заявки: `<EnquiryForm>` → `POST /forms/enquiry`, JSON `{ type, values: {<field>: string}, page?, studio?, company_url? }` → 201 `{ok:true}` | 400 `{ok:false, message, errors}` | 429 / 500 `{ok:false, message}`; `company_url` — ловушка для ботов. Маршрут валидирует и пишет Local API; хук `collections/hooks/notifyOwner.ts` шлёт письмо. Анонимный REST к enquiries закрыт; в админке правится только `status`, удаление запрещено всем.

| Модуль | Владеет | Выставляет |
|---|---|---|
| cms — `payload.config.ts`, `collections/`, `globals/` | схема, доступ, адаптеры | Local API, `payload-types.ts` |
| site — `app/(site)/`, `lib/cms/`, `components/` | маршруты, шаблоны, SEO, JSON-LD | `resolvePath`, рендереры по `kind`, `getCMS` |
| forms — `components/forms/`, `app/(site)/forms/` | поля, валидация, ловушка, лимит | `POST /forms/enquiry`, `<EnquiryForm>` |
| seed — `scripts/seed/` | перенос описи в коллекции, даты → sessions, шаблоны писем | `npm run seed` |
| payments — `lib/payments/`, `scripts/stripe/` | шлюз, налоги, Checkout, завершение заказа, вебхуки, настройка аккаунта | `gateway()`, `createCheckoutForOrder`, `createSubscriptionCheckout`, `createInvoiceCheckout`, `finalizeOrder`, `finalizeInvoicePayment`, `handleWebhookEvent`, `WEBHOOK_EVENTS`, `ratesFor`, `stripeDashboardUrl`, `npm run stripe:setup` |
| booking — `lib/booking/` | места и удержания | `availability`, `availabilityOf`, `holdSeats`, `releaseHolds`, `confirmSeats`, `isSellable` |
| cart — `lib/cart/`, `components/cart/` | состав корзины и его проверка | `validateCart`, `<CartProvider>`, `useCart()`, `<AddToCart>`, `<CartLink>` |
| mail — `lib/mail/` | шаблоны и отправка | `renderTemplate`, `sendTemplate`, `sendOrderConfirmation`, `sendPiecesReady`, `runDailyMail`, `inBackground` |
| exports — `app/(site)/exports/` | CSV для бухгалтера и списки учеников | `GET /exports/orders.csv`, `GET /exports/registrations.csv` |
| crawl — `scripts/crawl/` | обход старого сайта, вырезание секретов | `content/inventory.json`, `content/crawl-issues.json` |

### Соглашения кода

- `path` — ключ документа у pages, studios, products: уникален, нормализуется хуком поля; свою нормализацию не писать — `normalizePath()`.
- Картинка из media в `next/image` — только через `mediaSrc(url)`.
- Публичные чтения идут через доступ: Local API с `overrideAccess: false` либо явный фильтр по `published` / `visible`, как в `resolvePath`. Аноним видит studios и pages только `published`, products — только `visible`, classes — только опубликованных студий. Запись из маршрута — Local API с `overrideAccess: true` после своей проверки (образец — `app/(site)/forms/enquiry/route.ts`).
- Payload вне рендера страницы — только `getCMS()` из `lib/cms/payload.ts`; свой `getPayload` не заводить. Функции booking/payments/mail принимают необязательный `payload?` — так их гоняют юнит-тесты на временной базе.
- Id связи при любой глубине — `relId(v)`; часовой пояс — `STUDIO_TIME_ZONE` из `lib/time.ts`, не литерал.
- Всё, что видит редактор в админке (подписи, описания, группы, сообщения валидации), — на английском; в `app/`, `collections/`, `globals/`, `components/`, `lib/`, `scripts/seed/`, `scripts/howto/`, `tests/` кириллицы нет вообще (`tests/unit/admin-english.test.ts`).
- Факты о бизнесе (цены, адреса, тексты, расписание) — только из описи и сида, в код шаблонов не вписываются; нет факта — видимая заглушка `[TBD]`.
- H1 один на страницу и берётся из поля (`pages.h1`, `studios.h1`), не из блоков. Цена занятия — свободный текст; цена товара и тарифа — число.
- `Header`, `Footer`, `MobileCallBar` работают только внутри `SiteDataProvider`; новый шаблон оборачивается в `<SiteShell>`.
- Алиасы: `@/*` — корень, `@payload-config` — `payload.config.ts`; vitest их знает. Не дублировать `excerpt`, `formatPrice`, `lexicalText`, `phoneHref`, `metadataFor`, `normalizePath`, `mediaSrc`, `relId`.
- `/api` и `/admin` принадлежат Payload — туда ничего не добавлять.

### Окружение

Шаблон — `.env.example`; пустое необязательное значение выключает сервис.

- `DATABASE_URI` — `postgres://…` → Postgres, иначе файл SQLite (по умолчанию `handeye.db`).
- `PAYLOAD_SECRET` — обязателен с Postgres и в production; локальный SQLite без него берёт запасной.
- `NEXT_PUBLIC_SERVER_URL` — публичный адрес: canonical, sitemap, редиректы, CORS загрузки в Mux; в production сервер без него не стартует; локально — `http://localhost:${PORT||3210}`.
- `SITE_ENV` — только `production` снимает `X-Robots-Tag: noindex` и robots `Disallow: /`; в production `PAYMENT_GATEWAY=fake` игнорируется.
- `BLOB_READ_WRITE_TOKEN` — задан → файлы в Vercel Blob, иначе папка `media/`.
- `MUX_TOKEN_ID` + `MUX_TOKEN_SECRET` (+ `MUX_WEBHOOK_SIGNING_SECRET`) — оба заданы → videos расширяется плагином Mux, иначе обычная upload-коллекция с постером.
- `SMTP_HOST` (+ `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, `EMAIL_FROM_NAME`) — задан → письма через SMTP, иначе пишутся в лог сервера.
- `STRIPE_SECRET_KEY` — ключ аккаунта Stripe (`sk_test_…` → ссылки админки ведут в `/test/`); пуст и `PAYMENT_GATEWAY` не `fake` → шлюза нет, оплата отвечает 503. `STRIPE_WEBHOOK_SECRET` — подпись вебхука (`whsec_…`, локально его печатает `stripe listen`). `PAYMENT_GATEWAY` — `fake` → поддельный шлюз в памяти процесса (тесты, разработка без ключей); иначе Stripe при ключе. `CRON_SECRET` — bearer-секрет `GET /cron/daily`; пуст → 503. Значения ключей живут только в `.env.development.local` и переменных Vercel.
- `META_PIXEL_ID` (+ `META_CAPI_TOKEN`, `META_TEST_EVENT_CODE`), `GOOGLE_ADS_ID` (+ `GOOGLE_ADS_PURCHASE_LABEL`) — рекламные теги; на staging не задавать (иначе тестовые заказы попадут в боевой пиксель), кроме проверки с `META_TEST_EVENT_CODE`. Локальная проверка — конфиг `handeye-tracking-check` в `.claude/launch.json` (фиктивные id, поддельный шлюз).
- `MAILCHIMP_API_KEY` (с суффиксом `-usNN`) + `MAILCHIMP_AUDIENCE_ID` — список рассылки.
- `TEST_ADMIN_EMAIL`, `TEST_ADMIN_PASSWORD` — тестовый редактор для тестов по базе, где уже есть пользователи.
- Вне `.env.example`, для скриптов: `SEED_IMAGES`, `SEED_FIXES` (`0` — сид не пишет `content/seo-fixes.md`), `NEXT_DIST_DIR`, `TEST_BASE_URL`, `TEST_TEMP_DB`, `TEST_PORT`, `MOBILE_ALL`, `CMS_UPDATE`, `HOWTO_PORT`, `LH_CPU`.

### Тесты

- Vitest, два проекта (`vitest.config.ts`): `unit` — `tests/unit/`; `site` — `tests/site/`, HTTP + cheerio, в `mobile.test.ts` — Playwright. Оба знают алиасы `@/`, `@payload-config` и подменяют `server-only` заглушкой `tests/unit/stubs/server-only.ts`.
- `site` сам сидит временную SQLite, поднимает `next dev` на порту 3311 в `.next/test` и идёт по всем адресам описи: статус 200/301, title, один H1, description, уникальность title.
- Один файл: `npx vitest run tests/site/http.test.ts`. По уже запущенному серверу: `npx cross-env TEST_BASE_URL=http://localhost:3210 vitest run tests/site/http.test.ts`.
- Тесты, пишущие в CMS (`shop`, `studios`, `forms`, `sessions`, `cart`, `checkout`, `mail`, `exports`), идут только на localhost и по `TEST_BASE_URL` требуют `TEST_TEMP_DB=1`; секреты cron и вебхука там берутся из `process.env`.
- Юниты по Local API на временной SQLite (booking, payments, mail, availability) берут `tempCMS()` и `seedClassDate()` из `tests/unit/payments-harness.ts`; переменные окружения — до первого `getCMS()`.
- Долго: полный `npm test` — около 23 минут, из них `tests/site/studios.test.ts` — около 10. Фоновая команда в среде агента живёт не больше 10 минут — полный прогон запускать отдельным процессом с логом в файл.

### Подводные камни

- Менялись маршруты → перед `npm run build` удалить устаревшие типы: `node -e "for (const d of ['.next/types','.next/dev/types']) require('fs').rmSync(d,{recursive:true,force:true})"`.
- Dev-сервер виснет на вопросе push схемы после правки `collections/` — лечится пересевом на чистую базу.
- Без `mediaSrc` страница с картинкой падает с 500 при заданном `NEXT_PUBLIC_SERVER_URL`: CMS отдаёт абсолютный URL, `next/image` его не принимает.
- `NEXT_PUBLIC_SERVER_URL` должен совпадать с реальным адресом и портом: `proxy.ts` ходит по нему за таблицей и при ошибке молча работает без редиректов.
- Два прогона `npm test` одновременно конфликтуют (порт 3311, `.next/test`); параллельно — свой dev-сервер со своими `NEXT_DIST_DIR`, портом и копией базы плюс `TEST_BASE_URL`.
- `content/images/` вне git: на свежем клоне сид идёт без картинок и `tests/site/images.test.ts` падает, пока картинки не перекачаны `scripts/crawl/crawl.py`.
- `npm run lint` не работает: `next lint` в Next 16 нет, конфига ESLint в репозитории тоже.
- `next dev` с другим `NEXT_DIST_DIR` переписывает `tsconfig.json` и `next-env.d.ts` — не коммитить эти правки (`npm run howto` возвращает файлы сам).
- `next dev` без переменных Mux перегенерирует `app/(payload)/admin/importMap.js` без компонентов Mux (`MuxUploaderField`, `MuxVideoGifCell`) — коммитить только результат `npm run generate:importmap`, правку dev-сервера откатывать.
- Лимит заявок и checkout (5 за 10 минут на адрес) живёт в памяти процесса и обнуляется с рестартом сервера.
- Push схемы на staging Postgres (`npm run seed` с `DATABASE_URI` из `.env`; `npm run stripe:setup` — с `DATABASE_URI` staging в окружении процесса) запускать с `BLOB_READ_WRITE_TOKEN` из того же `.env`: с пустым токеном плагин Vercel Blob выключен, и Payload предлагает удалить колонку `media._objectkey` — на вопрос отвечать «нет». Production-переменные Vercel помечены sensitive, `vercel env pull` их не возвращает.
- Stripe CLI 1.53 требует список событий: `stripe listen --events checkout.session.completed,checkout.session.expired,charge.refunded,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.payment_failed --forward-to localhost:3210/stripe/webhook`; без `--events` выходит с ошибкой; список — `WEBHOOK_EVENTS` из `lib/payments/orders.ts`, тот же, что ставит `stripe:setup`. Секрет печатает `--print-secret`.
- Изменил `WEBHOOK_EVENTS` → endpoint на staging обновляется повторным `npm run stripe:setup -- --webhook https://<домен>/stripe/webhook` (дописывает события, секрет не меняет); локально — новый список в `stripe listen --events`.
- `lib/site.ts` страницы не читают: правка там меняет сайт только после `npm run seed`.

### Переезд на Stripe клиента

Сайт привязан к аккаунту Stripe только переменными окружения; в коде и в базе нет id объектов Stripe, кроме `plans.stripePriceId` (цены абонементов) и ссылок на уже созданные платежи в заказах. Порядок:

1. Сменить три переменные — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CRON_SECRET` (последний — свой, не из Stripe) — в `.env.development.local` и в проекте Vercel.
2. Выполнить `npm run stripe:setup -- --webhook https://<домен>/stripe/webhook --secret-file <путь вне репозитория>` с `DATABASE_URI` боевой базы в окружении процесса: продукты и месячные цены тарифов создаются в новом аккаунте, `plans.stripePriceId` перезаписываются, endpoint вебхука заводится, его signing secret попадает в файл — это и есть `STRIPE_WEBHOOK_SECRET` (Stripe показывает его один раз; потерян — перевыпустить в панели). Продукты товаров и сессий и `tax_rates` создаются лениво при первой покупке по метаданным `cms_kind` / `cms_id` и `code` / `province`.
3. В Site settings вставить ссылку портала покупателя (`stripePortalUrl`) нового аккаунта; пустое поле — кнопки нет.
4. Проверить: покупка тестовой картой, заказ `paid` в админке со ссылкой «Open in Stripe», событие в панели Stripe. Старые заказы остаются с id платежей прежнего аккаунта — их ссылки откроются только под старым ключом.

### Переезд Mux и Mailchimp на аккаунты клиента

Оба сервиса сначала живут на аккаунтах исполнителя и привязаны к сайту только переменными окружения.

- **Mux.** В аккаунте клиента: Access Token (Mux Video Read + Write) и webhook на `https://<домен>/api/mux/webhook`. Сменить `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_WEBHOOK_SIGNING_SECRET` в `.env.development.local` и Vercel, передеплоить. Уже загруженные ролики лежат в старом аккаунте: перезалить их из админки (или перенести ассеты в Mux и обновить документы videos), и только потом закрыть старый аккаунт.
- **Mailchimp.** В аккаунте клиента — аудитория; сменить `MAILCHIMP_API_KEY` и `MAILCHIMP_AUDIENCE_ID`. Подписчиков из старой аудитории выгрузить (Audience → Export, с тегами) и импортировать в новую в панели Mailchimp — согласие переносится вместе со статусом; либо заново `npm run newsletter:import` по выгрузке Wix.

### Как здесь работает Autopilot

Сборки ведутся навыком `/autopilot`. Требования, спецификация и таски — в `.autopilot/` (вне git, как `raw/` и `wiki/`). Прогресс — `.autopilot/dashboard.html`. Требование из `manifest.md` может снять только пользователь. Если работа прервалась — «продолжи автопилот»: состояние поднимется из `.autopilot/state.js`.
<!-- autopilot:end -->

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

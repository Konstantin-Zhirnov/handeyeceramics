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
| `npm run dev` | сайт и админка на http://localhost:3210 (тот же запуск — `.claude/launch.json`) |
| `npm run seed` | наполняет базу из `DATABASE_URI` описью `content/inventory.json` и данными `lib/site.ts`; идемпотентно |
| `npx cross-env SEED_IMAGES=0 npm run seed` | сид без картинок; `SEED_IMAGES="/a,/b"` — картинки только этих страниц |
| `npm test` | все тесты (unit + site), ~23 мин |
| `npx vitest run --project unit` | только юниты, секунды |
| `npm run test:mobile` | браузерный обход всех адресов описи на 390px (`MOBILE_ALL=1`) |
| `npm run build` | продакшен-сборка |
| `npm run start` | прод-сервер на 3210; в `.env` нужны `NEXT_PUBLIC_SERVER_URL` и `PAYLOAD_SECRET` |
| `npm run generate:types` | пересобрать `payload-types.ts` после правки коллекций и глобалов |
| `npm run generate:importmap` | пересобрать `app/(payload)/admin/importMap.js` после правки конфига или плагинов |
| `npm run howto` | 7 роликов-инструкций по админке в `handover/videos/` и `handover/README.md`; часть — `npm run howto -- --only 03,05` |
| `node scripts/lighthouse.mjs http://localhost:3210 3` | Lighthouse (mobile, Performance), медиана прогонов; сервер — `npm run build` + `npm run start` на базе с картинками; цифры — `content/lighthouse.md` |
| `python -m unittest discover -s scripts/crawl -p "test_*.py"` | тесты обходчика старого сайта |

### Структура

```
app/(site)/        публичный сайт: page.tsx (главная), [...path]/ (диспетчер + render*), forms/enquiry/route.ts
app/(payload)/     обвязка Payload: /admin, /api, /api/graphql; importMap.js генерируется
app/robots.ts, app/sitemap.ts   robots по SITE_ENV; sitemap из CMS на каждый запрос
collections/       index.ts — коллекции; blocks.ts — блоки страниц; fields/ — path, доступ, seo; hooks/ — письмо о заявке
globals/           index.ts — глобалы settings и home
lib/cms/           чтение CMS для сайта: resolve, site, seo, text, media
lib/site.ts        данные прототипа: вход сида, страницы их не читают
components/        дизайн-система прототипа (корень) + blocks/, forms/, shop/, location/, site/
content/           опись старого сайта и отчёты по ней; images/ — вне git
scripts/           seed/ (опись → CMS), howto/ (запись роликов), crawl/ (Python, обход), lighthouse.mjs
tests/             unit/ — без сервера; site/ — HTTP по поднятому сайту
proxy.ts           301 из коллекции redirects до рендера
payload.config.ts  конфиг CMS; адаптеры БД, файлов, видео и почты выбираются по env
media/, handeye.db, handover/, .next/   локальные данные и сборка — вне git
```

### Ключевые файлы

- `lib/cms/resolve.ts` — `resolvePath(path): Promise<Resolved | { redirect: string } | null>`, `getCMS(): Promise<Payload>`, `redirectTarget(rule)`, `PLANS_PATH`, `SHOP_PATH`. `Resolved` = `{kind:'studio', doc: Studio, page?: Page}` | `{kind:'product', doc: Product}` | `{kind:'plans'|'shop'|'page', doc: Page}`.
- `lib/cms/site.ts` — `getSiteData()`, `studioView(doc, site)`, `studioSchedule(doc)`, `classTabs(studioId?)`, `getHome()` → `{ hero, seo, gallery, text(key), list(prefix) }`, `homePage()`, `sitePaths()`, `phoneHref(display)`, `addressParts(address)`, `MEMBERSHIP_PATH`.
- `lib/cms/seo.ts` — `metadataFor(r: Resolved)`, `pageText(page)`; `lib/cms/text.ts` — `excerpt(text, max=155)`, `formatPrice(n)`, `lexicalText(v)`, `SITE_NAME`, `SITE_SUFFIX`, `SITE_URL`; `lib/cms/media.ts` — `mediaSrc(url)`.
- `lib/server-url.ts` — `serverURL(env?)`: единственный источник адреса сайта (canonical, sitemap, JSON-LD, таблица редиректов); `instrumentation.ts` вызывает его при старте.
- `collections/fields/path.ts` — `normalizePath(input)`, `pathField()`; `collections/fields/common.ts` — `contentAccess`, `readWhenFlagged(flag)`, `flaggedContentAccess(flag)`, `readClassOfPublishedStudio`, `seoField`, `publishedField`, `photosField()`.
- `components/blocks/Blocks.tsx` — `<Blocks blocks />`; слаги блоков: `text, image, gallery, video, cta, form, classList, productList, planList`.
- `components/site/SiteShell.tsx` — `<SiteShell currentLocation? flush?>` (async; шапка и подвал всех шаблонов), `<PageHeading eyebrow? title>`; `components/site/SiteData.tsx` — `<SiteDataProvider value>`, `useSiteData()`, типы `SiteData`, `StudioCard`, `StudioView`, `ClassTab`.
- `components/forms/definitions.ts` — `FORMS: Record<EnquiryType, FieldDef[]>`, `validate(type, input) → {errors, values}`, `answersOf(type, values)`, `isVisible(field, values)`, `isEnquiryType(v)`; `components/forms/EnquiryForm.tsx` — `<EnquiryForm type studio? />`.
- `components/shop/data.ts` — `allProducts()`, `productsOfList({category, all})`, `allPlans()`, `plansIn(group?)`, `storefronts()`, `studioPhone()`, `splitCategories()`; `components/shop/parts.tsx` — `<Price>`, `<ProductGrid>`, `<ProductShelves>`, `<ProductOptions>`, `<PlanList plans grouped?>`, `<StorefrontNav current>`.
- `scripts/seed/index.ts` — сид; ключи идемпотентности: `path` / `title` (classes) / `name` (plans) / `filename` (media) / `from` (redirects); заодно пишет `content/seo-fixes.md`.
- `tests/site/global-setup.ts` — поднимает тестовый сайт; `tests/site/editor.ts` — `editorToken(base)`; `tests/site/cms-update.ts` — правка CMS из теста через Local API (переменная `CMS_UPDATE`).

### Архитектура

Путь запроса:
1. `proxy.ts` (proxy в Next 16 — бывший middleware) ловит всё, кроме `api|admin|_next|media|images|assets`: читает таблицу из `GET /api/redirects` (кэш 10 с) и отвечает 301.
2. `/` → `app/(site)/page.tsx`; любой другой адрес → `app/(site)/[...path]/page.tsx`, который только диспетчеризует.
3. `resolvePath` ищет по `path` в порядке: redirects → studios (плюс документ pages с тем же `path` — приходит как `page`) → products → pages. `plans` — страница с `PLANS_PATH`; `shop` — `SHOP_PATH` или любая страница с блоком `productList`; `null` → 404.
4. По `kind` — `renderStudio(doc, page?)`, `renderProduct(doc)`, `renderShop(doc)`, `renderPlans(doc)`, `renderPage(doc)` в `app/(site)/[...path]/`; метаданные — `metadataFor`.

- Данные — только из CMS через Payload Local API (`getCMS()`); по HTTP к себе ходит один `proxy.ts` — за таблицей редиректов.
- Коллекции: users, media (alt обязателен), videos, studios, classes, pages, products, plans, enquiries, redirects (плагин; цели — pages, studios, products). Глобалы: `settings` (телефон, почта, instagram, меню, подвал) и `home` (hero, seo, gallery, `sections` по ключам: `classes`, `gallery`, `reviews`, `locations`, `other-studios`, `membership`, `feature-N`, `perk-N`, `review-N`, `step-N`, `stage-N`).
- Правка в админке видна на следующем запросе: все публичные маршруты и sitemap — `force-dynamic`, кэша и revalidate нет; новое правило редиректа — в пределах 10 с.
- Заявки: `<EnquiryForm>` → `POST /forms/enquiry`, JSON `{ type, values: {<field>: string}, page?, studio?, company_url? }` → 201 `{ok:true}` | 400 `{ok:false, message, errors}` | 429 / 500 `{ok:false, message}`; `company_url` — ловушка для ботов. Маршрут валидирует и пишет Local API; хук `collections/hooks/notifyOwner.ts` шлёт письмо. Анонимный REST к enquiries закрыт; в админке правится только `status`, удаление запрещено всем.

| Модуль | Владеет | Выставляет |
|---|---|---|
| cms — `payload.config.ts`, `collections/`, `globals/` | схема, доступ, адаптеры | Local API, `payload-types.ts` |
| site — `app/(site)/`, `lib/cms/`, `components/` | маршруты, шаблоны, SEO, JSON-LD | `resolvePath`, рендереры по `kind` |
| forms — `components/forms/`, `app/(site)/forms/` | поля, валидация, ловушка, лимит | `POST /forms/enquiry`, `<EnquiryForm>` |
| seed — `scripts/seed/` | перенос описи в коллекции | `npm run seed` |
| crawl — `scripts/crawl/` | обход старого сайта, вырезание секретов | `content/inventory.json`, `content/crawl-issues.json` |

### Соглашения кода

- `path` — ключ документа у pages, studios, products: уникален, нормализуется хуком поля; свою нормализацию не писать — `normalizePath()`.
- Картинка из media в `next/image` — только через `mediaSrc(url)`.
- Публичные чтения идут через доступ: Local API с `overrideAccess: false` либо явный фильтр по `published` / `visible`, как в `resolvePath`. Аноним видит studios и pages только `published`, products — только `visible`, classes — только опубликованных студий.
- Всё, что видит редактор в админке (подписи, описания, группы, сообщения валидации), — на английском; в `app/`, `collections/`, `globals/`, `components/`, `lib/`, `scripts/seed/`, `scripts/howto/`, `tests/` кириллицы нет вообще (`tests/unit/admin-english.test.ts`).
- Факты о бизнесе (цены, адреса, тексты, расписание) — только из описи и сида, в код шаблонов не вписываются; нет факта — видимая заглушка `[TBD]`.
- H1 один на страницу и берётся из поля (`pages.h1`, `studios.h1`), не из блоков. Цена занятия — свободный текст; цена товара и тарифа — число.
- `Header`, `Footer`, `MobileCallBar` работают только внутри `SiteDataProvider`; новый шаблон оборачивается в `<SiteShell>`.
- Алиасы: `@/*` — корень, `@payload-config` — `payload.config.ts`. Не дублировать `excerpt`, `formatPrice`, `lexicalText`, `phoneHref`, `metadataFor`.

### Окружение

Шаблон — `.env.example`; пустое необязательное значение выключает сервис.

- `DATABASE_URI` — `postgres://…` → Postgres, иначе файл SQLite (по умолчанию `handeye.db`).
- `PAYLOAD_SECRET` — обязателен с Postgres и в production; локальный SQLite без него берёт запасной.
- `NEXT_PUBLIC_SERVER_URL` — публичный адрес: canonical, sitemap, редиректы, CORS загрузки в Mux; в production сервер без него не стартует; локально — `http://localhost:${PORT||3210}`.
- `SITE_ENV` — только `production` снимает `X-Robots-Tag: noindex` и robots `Disallow: /`.
- `BLOB_READ_WRITE_TOKEN` — задан → файлы в Vercel Blob, иначе папка `media/`.
- `MUX_TOKEN_ID` + `MUX_TOKEN_SECRET` (+ `MUX_WEBHOOK_SIGNING_SECRET`) — оба заданы → videos расширяется плагином Mux, иначе обычная upload-коллекция с постером.
- `SMTP_HOST` (+ `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, `EMAIL_FROM_NAME`) — задан → письма через SMTP, иначе пишутся в лог сервера.
- `TEST_ADMIN_EMAIL`, `TEST_ADMIN_PASSWORD` — тестовый редактор для тестов по базе, где уже есть пользователи.
- Вне `.env.example`, для скриптов: `SEED_IMAGES`, `SEED_FIXES` (`0` — сид не пишет `content/seo-fixes.md`), `NEXT_DIST_DIR`, `TEST_BASE_URL`, `TEST_TEMP_DB`, `TEST_PORT`, `MOBILE_ALL`, `CMS_UPDATE`, `HOWTO_PORT`, `LH_CPU`.

### Тесты

- Vitest, два проекта (`vitest.config.ts`): `unit` — `tests/unit/`; `site` — `tests/site/`, HTTP + cheerio, в `mobile.test.ts` — Playwright.
- `site` сам сидит временную SQLite, поднимает `next dev` на порту 3311 в `.next/test` и идёт по всем адресам описи: статус 200/301, title, один H1, description, уникальность title.
- Один файл: `npx vitest run tests/site/http.test.ts`. По уже запущенному серверу: `npx cross-env TEST_BASE_URL=http://localhost:3210 vitest run tests/site/http.test.ts`.
- Тесты, пишущие в CMS (`shop`, `studios`, `forms`), идут только на localhost и по `TEST_BASE_URL` требуют `TEST_TEMP_DB=1`.
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
- Лимит заявок (5 за 10 минут на отправителя) живёт в памяти процесса и обнуляется с рестартом сервера.
- `lib/site.ts` страницы не читают: правка там меняет сайт только после `npm run seed`.

### Как здесь работает Autopilot

Сборки ведутся навыком `/autopilot`. Требования, спецификация и таски — в `.autopilot/` (вне git, как `raw/` и `wiki/`). Прогресс — `.autopilot/dashboard.html`. Требование из `manifest.md` может снять только пользователь. Если работа прервалась — «продолжи автопилот»: состояние поднимется из `.autopilot/state.js`.
<!-- autopilot:end -->

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

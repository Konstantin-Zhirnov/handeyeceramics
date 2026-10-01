# Опись сайта handeyeceramics.com

Сгенерировано `python scripts/crawl/crawl.py`; проверка — `python scripts/crawl/validate.py`. Руками не править: повторный обход перезапишет.

- `inventory.json` — опись: `pages`, `products`, `pricing`, `images`, `other`, `site`
- `crawl-issues.json` — SEO-находки по страницам
- `redactions.json` — где вырезаны секреты и частные контакты (без значений)
- `images/` — картинки (Wix, длинная сторона до 2400px; gif/svg — оригинал)

## URL

| раздел | вид | статус | сколько |
|---|---|---|---|
| other | booking | 200 | 2 |
| other | not-found | 404 | 1 |
| other | service | 200 | 5 |
| pages | page | 200 | 31 |
| pricing | pricing | 200 | 1 |
| products | product | 200 | 42 |
| всего | | | 82 |

## Картинки: 147

## Находки SEO: 74 на 67 страницах

- broken-link: 1
- duplicate-title: 4
- empty-description: 53
- multiple-h1: 4
- no-h1: 12

## Вырезано: 4

- email: 2
- password: 2
  - `/wheel-rental` — email ×2 (blocks)
  - `/wheel-rental` — password ×2 (blocks)

## Тарифы: сверка с живым сайтом (2026-09-30)

- `/pricing-plans/plans-pricing` открыта в браузере (после выполнения JS): на странице ровно один тариф —
  «Tuesday Evening», CA$267.75, «Valid for 7 days». Виджет Wix выводит его дважды; в описи он один. Расхождений нет.
- `/membership-rentals`, `/memberships-rentals-shop`, `/wheel-rental`: виджетов тарифов нет, цены стоят обычным текстом,
  и этот текст совпадает с описью (сумм с `$` на живой странице столько же, сколько в описи: 8, 2 и 8).
- В тарифы админки сид переносит дословно: тариф страницы тарифов; восемь вариантов абонемента «Option 1…8» с
  `/membership-rentals` (цена — единственная сумма в тексте варианта; период «per month» — только там, где он назван рядом с суммой:
  варианты 2, 3, 7, 8; у вариантов 1, 4, 5, 6 периода в тексте нет — поле пустое); аренду круга с `/wheel-rental`
  («costs $125/month»). Абзацы вариантов стали описаниями тарифов и на страницах выводятся из админки блоком
  «Список тарифов». Налог (+GST) остаётся в описании, как на сайте.
- Товары-подписки («Studio Membership Subscription», «Wheel Rental Subscription» — CA$132.00) — это товары магазина,
  а не тарифы; цена аренды в товаре и в тексте `/wheel-rental` на старом сайте разная, перенесены обе как есть.
- `/gift-card` — виджет подарочной карты Wix, товара в описи нет; страница перенесена текстом.

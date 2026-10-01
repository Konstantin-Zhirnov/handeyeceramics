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

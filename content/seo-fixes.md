# Исправления SEO при переносе

Генерируется `npm run seed` по `content/crawl-issues.json`; руками не править.
Правило — история 8: повтор title дополняется отличием, пустой description — первые ~155 символов
текста самой страницы, нет H1 — первый заголовок становится H1, несколько H1 — первый остаётся, остальные H2.
Текст страниц не меняется.

Находок в обходе: 74. Записей ниже: 74.

| Страница | Находка | Что сделано |
|---|---|---|
| `/` | 4 H1 | H1 — «Hands-on Pottery Classes», остальные стали H2 |
| `/` | повтор title | title оставлен как на Wix; отличие получил title товара с тем же названием |
| `/adult-beginner-pottery-classes-in-vancouver` | повтор title | title оставлен как на Wix; отличие получил title товара с тем же названием |
| `/apron-tools` | нет H1 | заголовков нет: H1 — «Aprons, Tools, Extra Pots» из title |
| `/apron-tools` | пустой description | первые 153 символов текста страницы |
| `/art-gallery` | пустой description | первые 118 символов текста страницы |
| `/booking-calendar/copy-of-tuesday-evening-wheel-throwing` | пустой description | страница не переносится: адрес переведён 301 на страницу своей студии |
| `/booking-calendar/tuesday-6-30-wheel-throwing` | пустой description | страница не переносится: адрес переведён 301 на страницу своей студии |
| `/clay` | нет H1 | заголовков нет: H1 — «Clay» из title |
| `/clay` | пустой description | первые 152 символов текста страницы |
| `/commissions-form` | нет H1 | первый заголовок «COMMISSIONS» стал H1 |
| `/contact-us` | нет H1 | первый заголовок «CONTACT US» стал H1 |
| `/friday-night-drop-in` | нет H1 | заголовков нет: H1 — «Friday/Saturday Drop In» из title |
| `/gallery` | нет H1 | первый заголовок «GALLERY» стал H1 |
| `/gallery` | пустой description | первые 7 символов текста страницы |
| `/gift-card` | пустой description | первые 82 символов текста страницы |
| `/home` | несколько H1 | страница не переносится: адрес переведён 301 на / |
| `/home` | повтор title | страница не переносится: адрес переведён 301 на / |
| `/memberships-rentals-shop` | нет H1 | заголовков нет: H1 — «Studio Memberships and Wheel Rentals» из title |
| `/nanaimo-pottery-classes` | 2 H1 | H1 — «3168 uplands DR Nanaimo», остальные стали H2 |
| `/open-studio-private-lessons` | нет H1 | заголовков нет: H1 — «Open Studio & Private Lessons» из title |
| `/open-studio` | битая ссылка /product-page/private-lessons | ссылки нет среди блоков страницы — на новый сайт она не перенесена |
| `/our-workshops` | нет H1 | первый заголовок «OUR WORKSHOPS» стал H1 |
| `/our-workshops` | пустой description | первые 155 символов текста страницы |
| `/paywall` | пустой description | страница не переносится: адрес переведён 301 на / |
| `/pieces-for-sale` | пустой description | первые 147 символов текста страницы |
| `/pottery-date-night` | 2 H1 | H1 — «Pottery Date Night», остальные стали H2 |
| `/pricing-plans/plans-pricing` | пустой description | первые 155 символов текста страницы |
| `/product-page/6-week-wheel-throwing-pottery-classes-in-vancouver` | повтор title | title дополнен категорией: «6-Week Pottery Classes in Vancouver \| Classes \| Hand Eye Ceramics» |
| `/product-page/apron-trimming-tool-bundle` | пустой description | первые 112 символов текста товара |
| `/product-page/apron` | пустой description | первые 61 символов текста товара |
| `/product-page/black-clay-4-lb` | пустой description | первые 62 символов текста товара |
| `/product-page/calico-clay-3-lb` | пустой description | первые 70 символов текста товара |
| `/product-page/canvas-apron-with-pockets` | пустой description | первые 48 символов текста товара |
| `/product-page/coffee-clay` | пустой description | первые 11 символов текста товара |
| `/product-page/coleman-s-porcelain-4-5-lb` | пустой description | первые 88 символов текста товара |
| `/product-page/coming-back-to-under-glaze-1-off-pottery-workshop-pots` | пустой description | первые 150 символов текста товара |
| `/product-page/date-night-drop-in-class-if-paying-via-gift-card` | пустой description | первые 48 символов текста товара |
| `/product-page/date-night-for-two` | пустой description | первые 41 символов текста товара |
| `/product-page/demo-pot` | пустой description | первые 8 символов текста товара |
| `/product-page/demystifying-slip-casting-and-marbling-clay` | пустой description | первые 151 символов текста товара |
| `/product-page/extra-workshop-pots` | пустой description | первые 85 символов текста товара |
| `/product-page/fri-sat-sun-date-night-wheel-seats-sold-separately-bigger-groups-welcome-also` | пустой description | первые 150 символов текста товара |
| `/product-page/frost-translucent` | пустой description | первые 94 символов текста товара |
| `/product-page/gift-card-payment-for-1-in-group-of-six` | пустой description | первые 39 символов текста товара |
| `/product-page/glaze-chemistry-class-1` | пустой description | первые 148 символов текста товара |
| `/product-page/glaze-session-sat-sundays-4pm-6pm` | пустой description | первые 151 символов текста товара |
| `/product-page/h550` | пустой description | первые 152 символов текста товара |
| `/product-page/hand-building-beginner-to-intermediate` | пустой description | первые 152 символов текста товара |
| `/product-page/hanging-plant-pot` | пустой description | первые 50 символов текста товара |
| `/product-page/long-denim-apron` | пустой description | первые 26 символов текста товара |
| `/product-page/m332-clay-2-50-lb` | пустой description | первые 147 символов текста товара |
| `/product-page/m350` | пустой description | первые 154 символов текста товара |
| `/product-page/m370-porcelain-like-clay-3-00-lb` | пустой description | первые 72 символов текста товара |
| `/product-page/m390-red-clay-2-50-lb` | пустой description | первые 64 символов текста товара |
| `/product-page/non-speckled-clay-340-2-lb` | пустой description | первые 112 символов текста товара |
| `/product-page/open-studio-drop-in` | пустой description | первые 155 символов текста товара |
| `/product-page/polar-ice` | пустой description | первые 154 символов текста товара |
| `/product-page/private-instruction-date-night-for-two` | пустой description | первые 152 символов текста товара |
| `/product-page/private-pottery-class-for-2` | пустой description | первые 153 символов текста товара |
| `/product-page/raku-clay-cone-10` | пустой description | первые 16 символов текста товара |
| `/product-page/re-booking-fee` | пустой description | первые 14 символов текста товара |
| `/product-page/recycled-clay` | пустой description | первые 149 символов текста товара |
| `/product-page/single-person-drop-in-class` | пустой description | первые 27 символов текста товара |
| `/product-page/speckled-clay-340gs-2-lb` | пустой description | первые 48 символов текста товара |
| `/product-page/split-leg-apron-with-pocket` | пустой description | первые 26 символов текста товара |
| `/product-page/studio-membership-subscription` | пустой description | первые 155 символов текста товара |
| `/product-page/trimming-tools-small-medium` | пустой description | первые 113 символов текста товара |
| `/product-page/wheel-rental-subscription` | пустой description | первые 152 символов текста товара |
| `/product-page/wheel-throwing-intermediate-only-spring` | пустой description | первые 153 символов текста товара |
| `/saturday-night-drop-in` | нет H1 | первый заголовок «We don’t have any products to show here right now.» стал H1 |
| `/saturday-night-drop-in` | пустой description | первые 152 символов текста страницы |
| `/shop` | нет H1 | заголовков нет: H1 — «Store» из title |
| `/youth-pottery-classes-shop` | нет H1 | первый заголовок «We don’t have any products to show here right now.» стал H1 |

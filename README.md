# Lampa plugins

Расширения для [Lampa](https://github.com/yumata/lampa). Сайт: https://edembey.github.io/lampa-torbox/

## Установка

Lampa → **Настройки** → **Расширения** → **Добавить расширение** → вставить ссылку.

### Всё сразу

```
https://edembey.github.io/lampa-torbox/ultra.js
```

Один файл со всеми плагинами из [`plugin/ultra.json`](plugin/ultra.json). Собирается автоматически при каждом пуше в `master`.

### По отдельности

| Плагин | Ссылка |
|---|---|
| online_mod | `https://edembey.github.io/lampa-torbox/plugin/online_mod.js` |
| TorBox | `https://edembey.github.io/lampa-torbox/plugin/torbox-lampa-plugin.js` |
| YummyAnime | `https://edembey.github.io/lampa-torbox/plugin/yummyani.js` |
| Меню для всех языков | `https://edembey.github.io/lampa-torbox/plugin/lang_menu.js` |
| Рейтинг Шикимори | `https://edembey.github.io/lampa-torbox/plugin/shikimori.js` |

Зеркало на jsDelivr: `https://cdn.jsdelivr.net/gh/EdemBey/lampa-torbox@master/plugin/<файл>.js`

## Плагины

### online_mod

Фильм или сериал → **Онлайн** → выбрать источник. Балансеры: HDrezka, Filmix, CDNVideoHub, AniLibria.top, Kodik, Naruto Based, Alloha, Turbo. FanSerials — только на Android; Collaps — только когда Lampa открыта по http(s) с адреса без «lampa» в имени. Остальные балансеры исходного online_mod отключены.

- **Alloha** и **Turbo** работают только через свой сервер (см. [Сервер](#сервер)).
- **HDrezka** на Android работает напрямую. В браузере (lampa.mx) сайт не отвечает странице и показывает проверку на бота, поэтому нужен один из вариантов:
  - свой сервер (см. [Сервер](#сервер));
  - скрипт Tampermonkey (рассчитан на Chrome): https://edembey.github.io/lampa-torbox/plugin/rezka-bridge.user.js. Если скрипт установлен, он используется вместо сервера. Через него любой плагин на lampa.mx может пользоваться вашим входом в HDrezka.

  Затем в браузере: Настройки → online_mod → HDrezka → логин, пароль → **Войти в HDrezka**.
- **Filmix** просит токен в своих настройках.

Поле **«Адрес своего сервера»** есть в настройках Alloha, Turbo и HDrezka (у HDrezka — только в браузере). Это одно и то же значение: достаточно заполнить его в любом из трёх разделов.

### TorBox

Торренты через [TorBox](https://torbox.app): поиск по IMDb через Torrentio, плюс MaxVol/Jacred, прямое воспроизведение, выбор серии и продолжение просмотра. Нужен только **TorBox API-ключ** в настройках плагина. Он же используется для Torrentio. Если задан «Адрес своего сервера» (его можно указать и в настройках TorBox — это то же значение, что в online_mod), запросы к TorBox идут через него. На Android без своего сервера — напрямую, в браузере — через сторонний CORS-прокси (Cloudflare Worker, меняется в настройках), который видит ключ.

### YummyAnime

Пункт меню **Аниме** с каталогом [YummyAnime](https://yummyani.me): онгоинги, новинки, популярное, топ, фильмы. В карточке аниме: порядок просмотра и рекомендации. Постеры берутся из TMDB.

### Меню для всех языков

Lampa показывает пункты «Аниме», «Лента» и «Релизы» только в русском, украинском и белорусском интерфейсе. Плагин добавляет их и для остальных языков («Ленту» — если она включена в сборке Lampa).

### Рейтинг Шикимори

Для аниме показывает оценку [Шикимори](https://shikimori.io) на постерах (бейдж в углу) и в карточке рядом с КП и IMDb. Что показывать, выбирается в Настройки → Шикимори → «Рейтинг аниме»: «Только Шикимори на аниме» (по умолчанию: у аниме оценка Шикимори вместо TMDB, у остального TMDB), «Только TMDB» (Шикимори выключен, запросов к нему нет), «Показывать оба». Если оценку Шикимори найти не удалось, остаётся TMDB. Запросы идут по очереди (не больше ~85 в минуту), ответы хранятся неделю.

### Настройка шапки и Статистика

Только в `ultra.js`: так же подгружаются с сайта [and7ey/lampa](https://github.com/and7ey/lampa) при запуске.

- [`head_filter.js`](https://github.com/and7ey/lampa/blob/main/head_filter.js) — скрывает элементы шапки: Настройки → Интерфейс → Шапка.
- [`stats.js`](https://github.com/and7ey/lampa/blob/main/stats.js) — статистика просмотров и «Итоги года» (14 декабря – 15 января). Сериалы и профили не учитываются.

### Плагины tvigl и OpenSubtitles

Только в `ultra.js`: так же подгружаются с сайтов авторов при запуске. Если они уже стоят в «Расширениях», удалите их там, иначе загрузятся дважды.

- [tvigl](https://github.com/tvigl/plugins): `rating_omdb.js` (рейтинги Кинопоиска, IMDb, TMDB, Metacritic, Rotten Tomatoes, награды и средняя оценка в карточке фильма), `vote_colour.js` (цветной рейтинг на карточках), `WikiFind.js` (Wiki о фильме), `new_year3.js` (гирлянда), `cache.js` (кнопка в шапке, которая чистит кеш Lampa и перезагружает её; ещё перекрашивает и меняет иконки кнопок «Онлайн», «Торренты», «Трейлер»).
- `snow.js` — своя копия tvigl `new_year2.js` (снег): осевший снег лежит на самих карточках, едет вместе с ними при листании, запоминается у каждой карточки и осыпается, когда карточка получает фокус. В открытой карточке снег оседает на постере и пропадает, когда из неё выходишь.
- `seasons.js` — своя копия tvigl `seasons.js` (сезон и серия на карточках сериалов): у карточек YummyAnime берёт найденный сериал TMDB, а не номер YummyAnime (раньше показывало чужой сезон).
- OpenSubtitles от hub.alcopa.cc (v1.2.9) — субтитры в плеере.
- `buttons.js` от [mylampa1](https://mylampa1.github.io/buttons.js) — редактор кнопок в карточке фильма: порядок, скрытие, вид (иконка или иконка с текстом), папки.
- `buttons_fix.js` — своя правка: постер в карточке не прыгает, когда кнопки buttons.js переносятся во второй ряд.

Все скрипты, которые `ultra.js` подгружает с чужих сайтов (эти и плагины and7ey выше), работают внутри Lampa с полным доступом к её настройкам, в том числе к ключу TorBox и логину и паролю HDrezka. Кто управляет этими сайтами, может в любой момент поменять код.

## Сервер

`server/` — помощник для Alloha, Turbo, HDrezka и TorBox в браузере (Node, порт 8790). К Alloha ходит через Cloudflare WARP (wireproxy) и curl-impersonate. К Turbo, HDrezka и TorBox — напрямую; HDrezka получает запросы как от приложения (`okhttp`), и проверка на бота не показывается. Пересылает запросы только на rezka.ag и hdrezka.ag (зеркало HDrezka на другом домене через сервер и скрипт не работает) и на api.torbox.app; cookie, пароль и ключ TorBox в логи не пишет. Маршрут `/torbox` пересылает запросы любому, кто знает адрес сервера (с любым ключом TorBox), поэтому адрес держите в секрете.

Нужен `server/wireproxy.conf` (в git не хранится): WireGuard-профиль WARP (`wgcf register && wgcf generate`, затем скопировать `wgcf-profile.conf` в `server/wireproxy.conf`) и в конце секция

```
[http]
BindAddress = 127.0.0.1:40000
```

Запуск (только amd64):

```
cd server
docker compose up -d
docker compose logs tunnel | grep trycloudflare   # публичный https-адрес
```

Этот адрес вставляется в Lampa: Настройки → online_mod → Alloha, Turbo или HDrezka → **Адрес своего сервера**.

Обновление после `git pull`:

```
cd server
docker compose up -d --build --no-deps alloha
```

Пересобирайте только `alloha`. Если перезапустится `tunnel`, адрес trycloudflare сменится и его придётся заново вписать в Lampa.

Если контейнеры впервые запускали из папки с другим именем (другой compose-проект), команда упадёт с ошибкой «container name "/alloha" is already in use». Тогда передайте имя того проекта через `-p`. Узнать его можно так:

```
docker inspect alloha --format '{{ index .Config.Labels "com.docker.compose.project" }}'
```

Затем обновите (тоже из папки `server/`):

```
docker compose -p <имя> up -d --build --no-deps alloha
```

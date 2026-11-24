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

Торренты через [TorBox](https://torbox.app): поиск по IMDb через Torrentio, плюс MaxVol/Jacred, прямое воспроизведение, выбор серии и продолжение просмотра. Нужен только **TorBox API-ключ** в настройках плагина. Он же используется для Torrentio. Запросы идут через CORS-прокси по умолчанию (сторонний Cloudflare Worker), его можно сменить в настройках.

### YummyAnime

Пункт меню **Аниме** с каталогом [YummyAnime](https://yummyani.me): онгоинги, новинки, популярное, топ, фильмы. В карточке аниме: порядок просмотра и рекомендации. Постеры берутся из TMDB.

### Меню для всех языков

Lampa показывает пункты «Аниме», «Лента» и «Релизы» только в русском, украинском и белорусском интерфейсе. Плагин добавляет их и для остальных языков («Ленту» — если она включена в сборке Lampa).

### Рейтинги КП и IMDb

Только в `ultra.js`: подгружает [`rating.js`](https://github.com/nb557/plugins/blob/main/rating.js) от nb557 прямо с его сайта при запуске Lampa, код у нас не копируется. Показывает рейтинги Кинопоиска и IMDb в карточке фильма. Если nb557 уберёт файл, пропадёт только этот плагин.

### Настройка шапки и Статистика

Только в `ultra.js`: так же подгружаются с сайта [and7ey/lampa](https://github.com/and7ey/lampa) при запуске.

- [`head_filter.js`](https://github.com/and7ey/lampa/blob/main/head_filter.js) — скрывает элементы шапки: Настройки → Интерфейс → Шапка.
- [`stats.js`](https://github.com/and7ey/lampa/blob/main/stats.js) — статистика просмотров и «Итоги года» (14 декабря – 15 января). Сериалы и профили не учитываются.

### Рейтинг Шикимори

Для аниме показывает оценку [Шикимори](https://shikimori.io) на постерах (бейдж в углу) и в карточке рядом с КП и IMDb. Оценку TMDB прячет везде (на постерах вместе с ней пропадает и «огонь» CUB — Lampa выводит их в одном месте). Запросы идут по очереди (не больше ~85 в минуту), ответы хранятся неделю.

## Сервер

`server/` — помощник для Alloha, Turbo и HDrezka в браузере (Node, порт 8790). К Alloha ходит через Cloudflare WARP (wireproxy) и curl-impersonate. К Turbo и HDrezka — напрямую; HDrezka получает запросы как от приложения (`okhttp`), и проверка на бота не показывается. Пересылает запросы только на rezka.ag и hdrezka.ag (зеркало HDrezka на другом домене через сервер и скрипт не работает), cookie и пароль в логи не пишет.

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
docker compose up -d --build alloha
```

Пересобирайте только `alloha`. Если перезапустится `tunnel`, адрес trycloudflare сменится и его придётся заново вписать в Lampa.

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

Зеркало на jsDelivr: `https://cdn.jsdelivr.net/gh/EdemBey/lampa-torbox@master/plugin/<файл>.js`

## Плагины

### online_mod

Фильм или сериал → **Онлайн** → выбрать источник. Балансеры: HDrezka, Filmix, CDNVideoHub, AniLibria.top, Kodik, Naruto Based, Alloha, Turbo. FanSerials — только на Android; Collaps — только когда Lampa открыта по http(s) с адреса без «lampa» в имени. Остальные балансеры исходного online_mod отключены.

- **Alloha** и **Turbo** работают через свой сервер (см. [Сервер](#сервер)): его адрес указывается в настройках Alloha.
- **HDrezka в браузере** (lampa.mx): сайт не пускает браузер напрямую. Нужен либо сервер Alloha (адрес в настройках Alloha), либо скрипт Tampermonkey: https://edembey.github.io/lampa-torbox/plugin/rezka-bridge.user.js (только Chrome).
- **HDrezka** и **Filmix** могут попросить вход или токен в своих настройках.

### TorBox

Торренты через [TorBox](https://torbox.app): поиск по IMDb через Torrentio, плюс MaxVol/Jacred, прямое воспроизведение, выбор серии и продолжение просмотра. Нужен только **TorBox API-ключ** в настройках плагина. Он же используется для Torrentio. Запросы идут через CORS-прокси по умолчанию (сторонний Cloudflare Worker), его можно сменить в настройках.

### YummyAnime

Пункт меню **Аниме** с каталогом [YummyAnime](https://yummyani.me): онгоинги, новинки, популярное, топ, фильмы. В карточке аниме: порядок просмотра и рекомендации. Постеры берутся из TMDB.

### Меню для всех языков

Lampa показывает пункты «Аниме», «Лента» и «Релизы» только в русском, украинском и белорусском интерфейсе. Плагин добавляет их и для остальных языков («Ленту» — если она включена в сборке Lampa).

## Сервер

`server/` — помощник для Alloha и Turbo (Node, порт 8790). Ходит к источникам через Cloudflare WARP (wireproxy) и curl-impersonate.

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

Этот адрес вставляется в Lampa: Настройки → online_mod → Alloha → адрес сервера.

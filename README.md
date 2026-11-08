# lampa-torbox

Плагин TorBox для Lampa с поиском **по IMDb через Torrentio**.
MaxVol/Jacred остались вторым источником.

## Установка

Ссылка для Lampa (jsDelivr, отдаёт `application/javascript`):

```
https://cdn.jsdelivr.net/gh/EdemBey/lampa-torbox@master/plugin/torbox-lampa-plugin.js?torrentio_key=ТВОЙ_КЛЮЧ
```

Lampa → Настройки → Расширения → Добавить расширение → вставить ссылку.
После этого вписать TorBox API-ключ в настройках плагина.

Для жёсткой привязки к коммиту используйте `@<sha>` вместо `@master`.

## Что изменено

1. **Torrentio по IMDb.** `/stream/movie/<imdb>.json` или
   `/stream/series/<imdb>:<s>:<e>.json` — поиск не зависит от названия.
2. **Комбинирование.** Torrentio и MaxVol/Jacred опрашиваются параллельно,
   результаты склеиваются и дедуплицируются по `infoHash`; Torrentio побеждает
   при совпадении, потому что только он отдаёт готовую ссылку.
3. **Прямое воспроизведение.** Если Torrentio (с ключом TorBox) вернул `url`,
   плагин играет сразу, без `createtorrent → mylist → requestdl`.
4. **Сначала серия.** Для сериалов открывается выбор серии: кадры и названия
   берутся из Cinemeta (`v3-cinemeta.strem.io`), последняя просмотренная серия
   помечена «Продолжить» и получает фокус. Кэш учитывает сезон и серию.
   Навигация: торренты → серии сезона → сезоны → выход (кнопка «назад» в
   фильтре и системный Back). Над списком торрентов показывается
   `Сезон N · Серия M — название`.

## Ключи

Ключи не хранятся в репозитории.

- Torrentio: `?torrentio_key=...` в ссылке расширения, `localStorage.torrentio_key`
  или пустая константа `TORRENTIO_KEY` в файле.
- TorBox: вводится в настройках плагина, лежит в `localStorage` устройства.

## Naruto Based в online_mod

`plugin/online_mod.js` — копия
[online_mod](https://nb557.github.io/plugins/online_mod.js) с добавленным
балансером **Naruto Based** (`https://anime.home.kopenkin.tech`).
В списке источников он появляется рядом с HDrezka, Kodik, CDNVideoHub и др.

Установка:

```
https://cdn.jsdelivr.net/gh/EdemBey/lampa-torbox@master/plugin/online_mod.js
```

Что добавлено:

1. Поиск по названию через `/api/catalog?q=...`.
2. Сезоны и серии из `/api/series/<slug>`.
3. Воспроизведение через `/api/lampa/play/<slug>?language=sub|dub`
   (302 на `/api/player/proxy`, поддержка Range).
4. Переключатель «Субтитры / Озвучка» и плейлист по сериям сезона.
5. Учитывается последняя выбранная озвучка сайта (`naruto_based_language`).

Сайт отдаёт `Access-Control-Allow-Origin: *` для API, поэтому сторонний
прокси не нужен. Если адрес сайта изменится, его можно переопределить:

```js
localStorage.online_mod_narutobased_site = 'https://новый-адрес'
```

## Структура

```
plugin/torbox-lampa-plugin.js   рабочая копия TorBox
plugin/online_mod.js            online_mod + Naruto Based
UPSTREAM.md                     откуда форки
```

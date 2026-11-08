# Lampa plugins

Расширения для [Lampa](https://lampa.mx):

- **online_mod + Naruto Based** — онлайн-источники с балансером аниме-сайта
  `anime.home.kopenkin.tech`;
- **TorBox** — торренты через TorBox с поиском по IMDb через Torrentio.

Репозиторий исторически называется `lampa-torbox`, но теперь здесь лежат оба
плагина.

## Установка

Lampa → **Настройки** → **Расширения** → **Добавить расширение** → вставить
ссылку → сохранить.

### online_mod + Naruto Based

```
https://edembey.github.io/lampa-torbox/plugin/online_mod.js
```

После установки откройте фильм или сериал → **Онлайн** → в фильтре источников
выберите **Naruto Based**.

### TorBox

```
https://edembey.github.io/lampa-torbox/plugin/torbox-lampa-plugin.js
```

После установки откройте настройки плагина **TorBox** и вставьте **TorBox
API‑ключ**. Параметр `?torrentio_key=...` в ссылке не нужен.

Ссылки отдаются с GitHub Pages. Если Pages недоступен, те же файлы можно
поставить через jsDelivr:

```
https://cdn.jsdelivr.net/gh/EdemBey/lampa-torbox@master/plugin/online_mod.js
https://cdn.jsdelivr.net/gh/EdemBey/lampa-torbox@master/plugin/torbox-lampa-plugin.js
```

## Naruto Based

Балансер встроен в `online_mod` и появляется в списке источников рядом с
HDrezka, Kodik, CDNVideoHub и другими. Отдельной кнопки в карточке нет.

Что делает:

1. Ищет тайтл по названию через `/api/catalog?q=...`.
2. Если каталог вернул эпизоды (`resultKind: episodes`), показывает их и
   играет напрямую, без запроса `/api/series/`.
3. Для сериала открывает сезоны и серии через `/api/series/<slug>` —
   каталог не отдаёт полный список серий.
4. Переключатель **Субтитры / Озвучка**.
5. Запускает поток через `/api/lampa/play/<slug>?language=sub|dub`
   (302 на `/api/player/proxy`, поддержка Range).
6. Строит плейлист по сериям выбранного сезона.
7. Учитывает последнюю озвучку сайта (`naruto_based_language`) и прогресс
   просмотра в общем timeline-ключе сайта.

### Быстрый старт и выбор качества

Видео запускается сразу в авто-качестве через `/api/lampa/play`, не дожидаясь
`/api/player/based`. Качества подгружаются в фоне и появляются в меню качества
плеера через `Lampa.PlayerPanel.quality`. Если для этой серии и языка уже есть
свежий кэш, плеер сразу стартует в лучшем известном качестве.

Качества берутся из `/api/player/based`. Плагин сначала пробует прямой запрос.
Если у эндпоинта нет CORS, используется резервный прокси `https://r.jina.ai/`
(медленнее и с лимитом запросов), а при его недоступности остаётся
авто-качество через `/api/lampa/play`.

Для внешнего Android-плеера (DDD) качества передаются в intent как
`ddd_quality` (JSON), и DDD показывает свою кнопку качества. Это работает для
всех балансеров online_mod, у которых есть больше одного готового URL-качества:
`first.quality` автоматически конвертируется в `ddd_quality` в общем
`playWithoutPreroll()`. Если у балансера только один URL или качества задаются
через `call`-функции, кнопки в DDD не будет — передавать нечего.

Lampa Android при запуске DDD не пробрасывает произвольные extras, поэтому
плагин дополнительно кладёт ту же JSON-карту в HTTP-заголовок
`X-DDD-Quality`. DDD разбирает его в качества и удаляет перед запросом видео.

Для внутреннего плеера Lampa работает быстрый старт с фоновой подгрузкой
качеств.

Чтобы выбор качества работал быстро, владельцу сайта достаточно добавить:

```http
Access-Control-Allow-Origin: *
```

на `/api/player/based` (или на весь `/api/player/*`).

Настройки в `localStorage`:

```js
// Адрес сайта
localStorage.online_mod_narutobased_site = 'https://anime.home.kopenkin.tech'

// Прокси для /api/player/based. Пустая строка — не использовать Jina.
localStorage.online_mod_narutobased_quality_proxy = 'https://r.jina.ai/'

// Свой прокси с подстановкой URL
localStorage.online_mod_narutobased_quality_proxy = 'https://my.proxy/?url={url}'
```

### Реклама Lampa

Плагин помечает свои воспроизведения как `continue_play` и кладёт текущий
элемент в `Lampa.PlayerPlaylist` перед `Player.play`. Из-за этого Lampa не
запускает свой CUB-преролл для видео, открытого из online_mod.

Это не отключает рекламу Lampa глобально и не убирает рекламу сторонних модов
(например, `plugin_modss.js`) — только CUB-преролл на воспроизведении из
online_mod.

## TorBox

Поиск **по IMDb через Torrentio**, MaxVol/Jacred остаются вторым источником.

1. **Torrentio по IMDb.** `/stream/movie/<imdb>.json` или
   `/stream/series/<imdb>:<s>:<e>.json` — поиск не зависит от названия.
2. **Комбинирование.** Torrentio и MaxVol/Jacred опрашиваются параллельно,
   результаты склеиваются и дедуплицируются по `infoHash`; Torrentio побеждает
   при совпадении, потому что только он отдаёт готовую ссылку.
3. **Прямое воспроизведение.** Если Torrentio с ключом TorBox вернул `url`,
   плагин играет сразу, без `createtorrent → mylist → requestdl`.
4. **Сначала серия.** Для сериалов открывается выбор серии: кадры и названия
   берутся из Cinemeta (`v3-cinemeta.strem.io`), последняя просмотренная серия
   помечена «Продолжить» и получает фокус. Кэш учитывает сезон и серию.

### Ключ

Нужен **один ключ — TorBox API key**. Он вводится в настройках плагина:
**Настройки → Расширения → TorBox → API‑ключ**.

Ключ используется в двух местах:

- для TorBox API (`createtorrent`, `mylist`, `requestdl`);
- для Torrentio — плагин сам подставляет его как `torbox=<key>` в URL,
  чтобы Torrentio возвращал готовые ссылки.

`torrentio_key` — это **не отдельный ключ Torrentio**, а тот же самый
TorBox-ключ. Параметр `?torrentio_key=...` в ссылке расширения оставлен только
как необязательное переопределение (например, если ключ нельзя хранить в
настройках). Обычно он не нужен.

Дополнительно ключ можно переопределить через `localStorage.torrentio_key` или
константу `TORRENTIO_KEY` в файле — для локальной сборки. Ключи не хранятся в
репозитории.

## GitHub Pages

Сайт публикуется из корня ветки `master`:

- `index.html` — страница с ссылками установки;
- `.nojekyll` — отключает обработку Jekyll, чтобы файлы отдавались как есть;
- `plugin/*.js` — сами плагины.

После пуша в `master` GitHub Pages пересобирает сайт автоматически.
Проверить можно так:

```bash
curl -I https://edembey.github.io/lampa-torbox/plugin/online_mod.js
curl -s https://edembey.github.io/lampa-torbox/plugin/online_mod.js | grep narutobased
```

## Структура

```
index.html                      страница GitHub Pages
.nojekyll                       отключение Jekyll
plugin/online_mod.js            online_mod + Naruto Based
plugin/torbox-lampa-plugin.js   TorBox
UPSTREAM.md                     откуда форки и что изменено
```

## Upstream

- TorBox: https://slonce70.github.io/addon_lampa_torbox/torbox-lampa-plugin.js
- online_mod: https://nb557.github.io/plugins/online_mod.js

Подробности и команды для сравнения с оригиналом — в `UPSTREAM.md`.

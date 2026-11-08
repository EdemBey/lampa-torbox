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

Откройте фильм или сериал → **Онлайн** → в фильтре источников выберите
**Naruto Based**. Плагин ищет тайтл на сайте, показывает сезоны и серии,
поддерживает субтитры/озвучку и выбор качества, если источник его отдаёт.

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
- `.nojekyll` — отключает обработку Jekyll;
- `plugin/*.js` — сами плагины.

После пуша в `master` GitHub Pages пересобирает сайт автоматически.

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

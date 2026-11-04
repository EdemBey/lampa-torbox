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
   Повторный заход в сериал снова спрашивает серию, а не показывает старый
   список.

## Ключи

Ключи не хранятся в репозитории.

- Torrentio: `?torrentio_key=...` в ссылке расширения, `localStorage.torrentio_key`
  или пустая константа `TORRENTIO_KEY` в файле.
- TorBox: вводится в настройках плагина, лежит в `localStorage` устройства.

## Структура

```
plugin/torbox-lampa-plugin.js   рабочая копия
UPSTREAM.md                     откуда форк
```

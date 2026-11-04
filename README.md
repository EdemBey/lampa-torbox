# lampa-torbox

Форк плагина TorBox для Lampa. Цель — искать торренты **по IMDb ID через
Torrentio**, а существующие парсеры (MaxVol, Jacred) оставить как второй
источник.

## Установка

1. Раздайте файл `plugin/torbox-lampa-plugin.js` любым HTTP-сервером или
   положите его содержимое на хостинг.
2. В Lampa: **Настройки → Расширения → Добавить расширение** и укажите URL
   файла.
3. Откройте настройки плагина и вставьте:
   - TorBox API-ключ;
   - ключ Torrentio (`torrentio.strem.fun/torbox=<KEY>`).

## Ключи

Ключи **не хранятся в репозитории**. Они вводятся в настройках расширения и
лежат в `localStorage` устройства (как в оригинальном плагине).

В коде предусмотрено одно место для значения по умолчанию — константа
`TORRENTIO_KEY`; в репозитории она пустая.

## Что планируется изменить относительно upstream

1. Torrentio как источник по IMDb (`/stream/movie/<imdb>.json`,
   `/stream/series/<imdb>:<s>:<e>.json`), параллельно с MaxVol/Jacred.
2. Склейка результатов и дедупликация по `infoHash`.
3. Если Torrentio вернул готовый `url` (TorBox настроен в его конфиге) —
   играть сразу, без `createtorrent`.
4. Для `infoHash`-записей — прежний путь TorBox:
   `checkcached → createtorrent → mylist → requestdl`, с выбором файла по
   `fileIdx` / `behaviorHints.filename`.
5. Экран сезонов и серий **до** поиска: запрос уходит только после выбора
   эпизода.

## Структура

```
plugin/torbox-lampa-plugin.js   рабочая копия (наши правки)
upstream/torbox-lampa-plugin.js исходник как скачан (для диффов)
UPSTREAM.md                     откуда и когда форкнуто
```

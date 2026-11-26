import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('../plugin/theme.js', import.meta.url)), 'utf8');
const from = src.indexOf('  function bbCache(');
const to = src.indexOf('  function bbRender(');
assert(from > 0 && to > from, 'billboard helpers not found in plugin/theme.js');

let store = {};
const Lampa = { Storage: { get: (k, d) => (k in store ? store[k] : d) } };
const bb = { genres: { 28: 'Action', 18: 'Drama' }, kp: {}, sh: {}, cacheAt: 0 };
const { bbRatings, bbFallback, bbMeta, bbCaches } = new Function('Lampa', 'bb', src.slice(from, to) + '\nreturn { bbRatings, bbFallback, bbMeta, bbCaches };')(Lampa, bb);

const count = (html) => (html.match(/lampa-bb__r"/g) || []).length;

// zero and missing ratings are hidden, one decimal for the rest
let html = bbRatings({ id: 1, vote_average: '7.24', kp_rating: 0 }, false);
assert.strictEqual(count(html), 1);
assert(html.includes('7.2') && !html.includes('7.24'));

// cached kp/imdb/shikimori values, keyed like the rating plugins write them
store = {
  kp_rating: JSON.stringify({ 2: { kp: 8.94, imdb: 9.5 } }),
  shikimori_rating: JSON.stringify({ tmdb_tv_2: { s: 8.6 } })
};
bbCaches(true);
html = bbRatings({ id: 2, name: 'X', vote_average: 7.8 }, true);
assert.strictEqual(count(html), 4);
for (const v of ['7.8', '8.9', '9.5', '8.6']) assert(html.includes(v), v);
assert.strictEqual(count(bbRatings({ id: 2, vote_average: 7.8 }, false)), 3, 'shikimori key is per media type');

// the caches are re-read at most every 30 s, or when forced
store = { kp_rating: '{}', shikimori_rating: '{}' };
assert.strictEqual(count(bbRatings({ id: 2, vote_average: 0 }, false)), 2);
bbCaches(true);
assert.strictEqual(count(bbRatings({ id: 2, vote_average: 0 }, false)), 0);

// broken storage content does not throw
store = { kp_rating: '{oops', shikimori_rating: '5' };
bbCaches(true);
assert.strictEqual(bbRatings({ id: 3, vote_average: 6 }, false).includes('6.0'), true);

assert.strictEqual(bbFallback({ title: 'A', original_title: 'A', runtime: 90 }), '90 min');
assert.strictEqual(bbFallback({ name: 'Goliath', original_name: 'Goliath', number_of_seasons: 4, number_of_episodes: 32, status: 'Ended' }), 'S4 · 32 ep. · Ended');
assert.strictEqual(bbFallback({ title: 'Дом', original_title: 'House' }), '');
assert(!bbFallback({ name: 'X', original_name: '追放', number_of_seasons: 1, number_of_episodes: 1 }).includes('追放'), 'original title is never shown');

// fillCard copies only missing fields from a TMDB response
const f0 = src.indexOf('  function fillCard(');
const f1 = src.indexOf('  // Billboard: title, meta');
assert(f0 > 0 && f1 > f0, 'fillCard not found in plugin/theme.js');
let handler, refreshed = [], requests = [], callbacks = [];
const env = {
  document: { addEventListener: (type, fn) => { handler = fn; } },
  isOn: () => true,
  bbEnabled: () => globalThis.__bbOn !== false,
  bbRefresh: (c) => refreshed.push(c),
  Lampa: {
    Reguest: function () { this.silent = (url, ok, err) => { requests.push(url); callbacks.push({ ok, err }); }; },
    TMDB: { api: (u) => u, key: () => 'k' },
    Utils: { cardImgBackgroundBlur: () => 'blur' },
    Storage: { get: () => 'en' },
    Background: { change: () => {} }
  }
};
const win = globalThis.window;
globalThis.window = { Lampa: env.Lampa };
const { fillCard, fixBackdrops, bbMerge, details } = new Function(...Object.keys(env), src.slice(f0, f1) + '\nreturn { fillCard, fixBackdrops, bbMerge, details };')(...Object.values(env));
const card = { id: 1, name: 'Dead Account', vote_average: 0, genres: [], overview: 'mine', first_air_date: '2025-01-01' };
fillCard(card, { backdrop_path: '/b.jpg', overview: 'theirs', vote_average: 6.7, first_air_date: '2030-01-01', number_of_seasons: 1, episode_run_time: [24], genres: [{ name: 'Anime' }] });
assert.deepStrictEqual(card, { id: 1, name: 'Dead Account', vote_average: 6.7, genres: [{ name: 'Anime' }], overview: 'mine', first_air_date: '2025-01-01', backdrop_path: '/b.jpg', number_of_seasons: 1, runtime: 24 });
assert.deepStrictEqual(fillCard({}, {}), {}, 'empty response fills nothing');

// meta: year and genres, tolerant of odd card data
const dot = ' \u00a0·\u00a0 ';
assert.strictEqual(bbMeta({ release_date: '2026-05-01', genre_ids: [28, 18, 999] }), '2026' + dot + 'Action, Drama');
assert.strictEqual(bbMeta({ first_air_date: 2016, genres: [{ name: 'Crime' }, null, { name: 'Drama' }] }), '2016' + dot + 'Crime, Drama');
assert.strictEqual(bbMeta({ release_date: '2020-01-01', genres: 'Action' }), '2020');
assert.strictEqual(bbMeta({ genres: { name: 'x' }, genre_ids: 'nope' }), '');
assert.strictEqual(bbMeta({ release_date: '2020-01-01', genres: [{ name: '<img src=x onerror=alert(1)>' }] }), '2020' + dot + '<img src=x onerror=alert(1)>');

// fixBackdrops writes only backdrop_path into Lampa's card; the other details go to the cache and are merged at render time
fixBackdrops();
const el = (c) => ({ classList: { contains: (k) => k === 'card' || k === 'focus' }, card_data: c });
const hist = { id: 5, name: 'Dead Account', source: 'tmdb', backdrop_path: '' };
handler({ target: el(hist) });
handler({ target: el(hist) });
assert.strictEqual(requests.length, 1, 'a pending request is not repeated');
callbacks[0].ok({ backdrop_path: '/b.jpg', overview: 'o', genres: [{ name: 'Anime' }], vote_average: 6.7 });
assert.deepStrictEqual(hist, { id: 5, name: 'Dead Account', source: 'tmdb', backdrop_path: '/b.jpg' }, 'only backdrop_path is written into the card');
assert.strictEqual(refreshed[0], hist);
const merged = bbMerge(hist);
assert.notStrictEqual(merged, hist);
assert.strictEqual(merged.overview, 'o');
assert.strictEqual(merged.vote_average, 6.7);
assert.strictEqual(merged.genres[0].name, 'Anime');
assert.strictEqual(merged.name, 'Dead Account');
assert(!('overview' in hist) && !('genres' in hist), 'merging does not mutate the card');
handler({ target: el({ id: 5, name: 'Dead Account', source: 'tmdb' }) });
assert.strictEqual(requests.length, 1, 'a cached result is reused');

// a failed or empty response is cached as {} and never requested again
const bad = { id: 6, name: 'X', source: 'tmdb' };
handler({ target: el(bad) });
assert.strictEqual(requests.length, 2);
callbacks[1].err();
assert.deepStrictEqual(details.tv6, {});
handler({ target: el(bad) });
assert.strictEqual(requests.length, 2, 'failed request is not retried');
const empty = { id: 7, name: 'Y', source: 'tmdb' };
handler({ target: el(empty) });
callbacks[2].ok(null);
assert.deepStrictEqual(details.tv7, {});
handler({ target: el(empty) });
assert.strictEqual(requests.length, 3, 'empty response is not retried');

// no request when nothing is missing, or when only the overview is missing and the billboard is off
handler({ target: el({ id: 8, name: 'Z', source: 'tmdb', backdrop_path: '/x', overview: 'y' }) });
globalThis.__bbOn = false;
handler({ target: el({ id: 9, name: 'W', source: 'tmdb', backdrop_path: '/x' }) });
handler({ target: el({ id: 10, name: 'V', source: 'other' }) });
handler({ target: el({ id: 'abc', name: 'U', source: 'tmdb' }) });
assert.strictEqual(requests.length, 3);
handler({ target: el({ id: 11, name: 'T', source: 'tmdb' }) });
assert.strictEqual(requests.length, 4, 'a missing backdrop still triggers the request');
delete globalThis.__bbOn;
if (win === undefined) delete globalThis.window; else globalThis.window = win;

console.log('theme-billboard: ok');

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
assert.strictEqual(bbFallback({ title: 'Дом', original_title: 'House' }), 'House');

// meta: year and genres, tolerant of odd card data
const dot = ' \u00a0·\u00a0 ';
assert.strictEqual(bbMeta({ release_date: '2026-05-01', genre_ids: [28, 18, 999] }), '2026' + dot + 'Action, Drama');
assert.strictEqual(bbMeta({ first_air_date: 2016, genres: [{ name: 'Crime' }, null, { name: 'Drama' }] }), '2016' + dot + 'Crime, Drama');
assert.strictEqual(bbMeta({ release_date: '2020-01-01', genres: 'Action' }), '2020');
assert.strictEqual(bbMeta({ genres: { name: 'x' }, genre_ids: 'nope' }), '');
assert.strictEqual(bbMeta({ release_date: '2020-01-01', genres: [{ name: '<img src=x onerror=alert(1)>' }] }), '2020' + dot + '<img src=x onerror=alert(1)>');

console.log('theme-billboard: ok');

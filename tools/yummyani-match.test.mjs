import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('../plugin/yummyani.js', import.meta.url)), 'utf8');
const from = src.indexOf('  function yearOf(s) {');
const to = src.indexOf('  // yani_url -> TMDB match');
assert(from !== -1 && to > from, 'yummyani code not found');

const code = src.slice(from, to);

let fixtures = function () { return []; };

function LampaFor() {
  return {
    Storage: { field: function () { return 'ru'; } },
    TMDB: { api: function (u) { return u; }, key: function () { return 'k'; } },
    Reguest: function () {
      this.silent = function (url, ok) {
        const q = decodeURIComponent(url.split('query=')[1].split('&')[0]);
        Promise.resolve().then(function () { ok({ results: fixtures(q) }); });
      };
    }
  };
}

function run(card, fx) {
  fixtures = fx;
  const Lampa = LampaFor();
  const api = new Function('Lampa', code + '\nreturn { findTmdb: findTmdb };')(Lampa);
  return new Promise(function (resolve) { api.findTmdb(card, resolve); });
}

// a) TV season vs same-year movie: show wins, recap movie does not.
{
  const card = { name: 'Чёрный клевер 2', original_name: 'Black Clover 2nd Season', first_air_date: '2026', yani_type: 'tv', yani_titles: ['Чёрный клевер 2', 'Black Clover 2nd Season', 'ブラッククローバー'] };
  const fx = function () { return [{ id: 1828693, media_type: 'movie', genre_ids: [16], release_date: '2026-10-03' }, { id: 73223, media_type: 'tv', genre_ids: [16], first_air_date: '2017-10-03' }]; };
  const hit = await run(card, fx);
  assert.strictEqual(hit.id, 73223);
  assert.strictEqual(hit.method, 'tv');
  assert.strictEqual(hit.loose, true);
}

// b) Non-TV (ova) still takes a same-year match of other type.
{
  const card = { name: 'X OVA', original_name: 'X OVA', first_air_date: '2020', yani_type: 'ova', yani_titles: ['X OVA'] };
  const fx = function () { return [{ id: 5, media_type: 'tv', genre_ids: [16], first_air_date: '2015-01-01' }, { id: 6, media_type: 'movie', genre_ids: [16], release_date: '2020-05-01' }]; };
  const hit = await run(card, fx);
  assert.strictEqual(hit.id, 6);
}

// c) Real NARUTO/Boruto case: first query returns only Boruto (2017); show from later query wins.
{
  const card = { name: 'Наруто', original_name: 'NARUTO', first_air_date: '2002', yani_type: 'tv', yani_titles: ['Наруто', 'NARUTO', 'ナルト'] };
  const fx = function (q) {
    if (q === 'NARUTO') return [{ id: 1, media_type: 'tv', genre_ids: [16], first_air_date: '2017-04-05' }];
    return [{ id: 2, media_type: 'tv', genre_ids: [16], first_air_date: '2002-10-03' }];
  };
  const hit = await run(card, fx);
  assert.strictEqual(hit.id, 2);
  assert.notStrictEqual(hit.loose, true);
}

// d) TV entry, only a same-year movie exists: fallback to movie.
{
  const card = { name: 'Т', original_name: 'T', first_air_date: '2026', yani_type: 'tv', yani_titles: ['Т', 'T'] };
  const fx = function () { return [{ id: 9, media_type: 'movie', genre_ids: [16], release_date: '2026-01-01' }]; };
  const hit = await run(card, fx);
  assert.strictEqual(hit.id, 9);
  assert.strictEqual(hit.method, 'movie');
}

console.log('yummyani-match: ok');

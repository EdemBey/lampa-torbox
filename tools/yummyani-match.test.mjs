import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('../plugin/yummyani.js', import.meta.url)), 'utf8');
const from = src.indexOf('  function yearOf(s) {');
const to = src.indexOf('  // yani_url -> TMDB match');
assert(from !== -1 && to > from, 'yummyani code not found');

const code = src.slice(from, to);

let fixtures = function () { return []; };
let arm = {};

function LampaFor() {
  return {
    Storage: { field: function () { return 'ru'; } },
    TMDB: { api: function (u) { return u; }, key: function () { return 'k'; } },
    Reguest: function () {
      this.silent = function (url, ok) {
        let res;
        const mal = url.match(/arm\.haglund\.dev.*[?&]id=(\d+)/);
        const details = url.match(/^(tv|movie)\/(\d+)\?/);
        if (mal) res = arm[mal[1]] || null;
        else if (details) res = { id: +details[2], poster_path: '/p' + details[2], genres: details[2] === '999' ? [{ id: 18 }] : [{ id: 16 }] };
        else res = { results: fixtures(decodeURIComponent(url.split('query=')[1].split('&')[0])) };
        Promise.resolve().then(function () { ok(res); });
      };
    }
  };
}

function run(card, fx, armFx, yani) {
  fixtures = fx;
  arm = armFx || {};
  const Lampa = LampaFor();
  const get = function (path, ok) { Promise.resolve().then(function () { ok((yani || {})[path] || {}); }); };
  const api = new Function('Lampa', 'get', code + '\nreturn { findTmdb: findTmdb };')(Lampa, get);
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

// e) MAL id via arm (real Black Clover data): OVA kept in the show's season 0 -> the show, no title search.
{
  const card = { name: 'Чёрный клевер — OVA', original_name: 'Black Clover: Jump Festa 2016 Special', first_air_date: '2016', yani_type: 'ova', mal: 33950 };
  const fx = function () { throw new Error('title search must not run'); };
  const hit = await run(card, fx, { 33950: { myanimelist: 33950, media: 'OVA', themoviedb: 73223, 'themoviedb-season': 0 } });
  assert.deepStrictEqual([hit.id, hit.method, hit.loose], [73223, 'tv', true]);
  assert.strictEqual(hit.poster_path, '/p73223');
}

// e2) Viewing-order item: no remote_ids on it, the MAL id comes from its yani record.
{
  const card = { name: 'Чёрный клевер', original_name: 'Black Clover', first_air_date: '2017', yani_type: 'tv', yani_url: 'chernyj-klever-tv' };
  const fx = function () { throw new Error('title search must not run'); };
  const yani = { '/anime/chernyj-klever-tv?need_videos=false': { remote_ids: { shikimori_id: 34572, myanimelist_id: 34572 } } };
  const hit = await run(card, fx, { 34572: { media: 'TV', themoviedb: 73223, 'themoviedb-season': 1 } }, yani);
  assert.deepStrictEqual([hit.id, hit.method, hit.loose], [73223, 'tv', undefined]);
}

// e3) arm id resolves to a non-animation title (wrong type guess): title search instead.
{
  const card = { name: 'Т', original_name: 'T', first_air_date: '2026', yani_type: 'ona', yani_titles: ['Т', 'T'], mal: 1 };
  const fx = function () { return [{ id: 9, media_type: 'movie', genre_ids: [16], release_date: '2026-01-01' }]; };
  const hit = await run(card, fx, { 1: { media: 'ONA', themoviedb: 999, 'themoviedb-season': null } });
  assert.strictEqual(hit.id, 9);
}

// f) Film via arm -> movie.
{
  const card = { title: 'Меч короля магов', original_title: 'Black Clover: Sword of the Wizard King', release_date: '2023', yani_type: 'movie', mal: 48585 };
  const hit = await run(card, function () { return []; }, { 48585: { media: 'MOVIE', themoviedb: 812225, 'themoviedb-season': null } });
  assert.deepStrictEqual([hit.id, hit.method], [812225, 'movie']);
}

// g) arm knows the MAL id but has no TMDB id (Jump Festa 2018): falls back to title search.
{
  const card = { name: 'Т', original_name: 'T', first_air_date: '2026', yani_type: 'tv', yani_titles: ['Т', 'T'], mal: 38768 };
  const fx = function () { return [{ id: 9, media_type: 'movie', genre_ids: [16], release_date: '2026-01-01' }]; };
  const hit = await run(card, fx, { 38768: { media: 'SPECIAL', themoviedb: null } });
  assert.strictEqual(hit.id, 9);
}

console.log('yummyani-match: ok');

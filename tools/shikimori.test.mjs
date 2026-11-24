import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('../plugin/shikimori.js', import.meta.url)), 'utf8');
const from = src.indexOf('  function isAnime(d)');
const to = src.indexOf('  // UI');
assert(from !== -1 && to > from, 'shikimori code not found');

const API = 'https://shikimori.io/api/animes';
const TTL = 7 * 24 * 3600 * 1000;
const GAP = 0;

function load(fixtures) {
  const store = {};
  const called = [];
  const network = {
    timeout: function () {},
    silent: function (url, ok, fail) {
      called.push(url);
      Promise.resolve().then(function () {
        if (Object.prototype.hasOwnProperty.call(fixtures, url)) ok(fixtures[url]);
        else fail();
      });
    }
  };
  const Lampa = {
    Storage: {
      cache: function (name, limit, def) { return store[name] || def; },
      set: function (name, v) { store[name] = v; }
    }
  };
  const code = src.slice(from, to);
  const api = new Function('Lampa', 'setTimeout', 'API', 'TTL', 'GAP', 'network', 'queue', 'busy', 'waiting', code + '\nreturn { isAnime: isAnime, get: get };')(
    Lampa, setTimeout, API, TTL, GAP, network, [], false, {}
  );
  return { api, store, called };
}

// a) isAnime
{
  const { api } = load({});
  assert.strictEqual(api.isAnime({ original_language: 'ja', genre_ids: [16] }), true);
  assert.strictEqual(api.isAnime({ original_language: 'ja', genre_ids: [18] }), false);
  assert.strictEqual(api.isAnime({ original_language: 'en', genres: [{ id: 16 }] }), false);
  assert.strictEqual(api.isAnime({ yani_shikimori: [5] }), true);
  assert.strictEqual(api.isAnime(undefined), false);
}

// b) year filter
{
  const fixtures = {};
  fixtures[API + '?limit=10&kind=!movie&search=Naruto'] = [{ aired_on: '2007-02-15', score: '8.3' }, { aired_on: '2002-10-03', score: '8.0' }];
  const { api } = load(fixtures);
  const card = { id: 1, name: 'Naruto', original_name: 'Naruto', first_air_date: '2002-10-03' };
  const score = await new Promise(function (resolve) { api.get(card, resolve); });
  assert.strictEqual(score, 8);
}

// c) falls back to second name
{
  const fixtures = {};
  fixtures[API + '?limit=10&kind=!movie&search=X'] = [];
  fixtures[API + '?limit=10&kind=!movie&search=Y'] = [{ aired_on: '2020-04-01', score: '7.5' }];
  const { api, called } = load(fixtures);
  const card = { id: 2, original_name: 'X', name: 'Y', first_air_date: '2020-01-01' };
  const score = await new Promise(function (resolve) { api.get(card, resolve); });
  assert.strictEqual(score, 7.5);
  assert.deepStrictEqual(called, [API + '?limit=10&kind=!movie&search=X', API + '?limit=10&kind=!movie&search=Y']);
}

// d) yani id
{
  const fixtures = {};
  fixtures[API + '/52991'] = { score: '9.25' };
  const { api, called } = load(fixtures);
  const card = { id: 3, yani_shikimori: [52991] };
  const score = await new Promise(function (resolve) { api.get(card, resolve); });
  assert.strictEqual(score, 9.25);
  assert.deepStrictEqual(called, [API + '/52991']);
}

// e) cache + dedupe
{
  const fixtures = {};
  fixtures[API + '?limit=10&kind=!movie&search=Naruto'] = [{ aired_on: '2002-10-03', score: '8.0' }];
  const { api, called } = load(fixtures);
  const card = { id: 5, name: 'Naruto', original_name: 'Naruto', first_air_date: '2002-10-03' };
  const p1 = new Promise(function (resolve) { api.get(card, resolve); });
  const p2 = new Promise(function (resolve) { api.get(card, resolve); });
  const results = await Promise.all([p1, p2]);
  assert.strictEqual(called.length, 1);
  assert.deepStrictEqual(results, [8, 8]);
  const before = called.length;
  const s3 = await new Promise(function (resolve) { api.get(card, resolve); });
  assert.strictEqual(called.length, before);
  assert.strictEqual(s3, 8);
}

// f) network error is not cached
{
  const { api, store, called } = load({});
  const card = { id: 9, name: 'Missing', original_name: 'Missing', first_air_date: '2020-01-01' };
  const score = await new Promise(function (resolve) { api.get(card, resolve); });
  assert.strictEqual(score, 0);
  const cache = store['shikimori_rating'];
  assert.ok(!cache || !cache['tmdb_tv_9'], 'should not be cached');
}

// g) id beats cached search
{
  const fixtures = {};
  fixtures[API + '?limit=10&kind=movie&search=N'] = [{ aired_on: '2020-01-01', score: '5.0' }];
  fixtures[API + '/11'] = { score: '8.8' };
  const { api, called } = load(fixtures);
  const card1 = { id: 7, original_name: 'N', first_air_date: '2020-01-01' };
  const s1 = await new Promise(function (resolve) { api.get(card1, resolve); });
  assert.strictEqual(s1, 5);
  const card2 = { id: 7, original_name: 'N', first_air_date: '2020-01-01', yani_shikimori: [11] };
  const s2 = await new Promise(function (resolve) { api.get(card2, resolve); });
  assert.strictEqual(s2, 8.8);
  assert.ok(called.indexOf(API + '/11') !== -1, 'API/11 should be called');
  const before = called.length;
  const s3 = await new Promise(function (resolve) { api.get(card2, resolve); });
  assert.strictEqual(s3, 8.8);
  assert.strictEqual(called.length, before, 'no new request on third get');
}

// h) movie vs tv
{
  const fixtures = {};
  fixtures[API + '?limit=10&kind=movie&search=M'] = [{ aired_on: '2010-01-01', score: '6.0' }];
  fixtures[API + '?limit=10&kind=!movie&search=M'] = [{ aired_on: '2010-01-01', score: '7.0' }];
  const { api } = load(fixtures);
  const m = await new Promise(function (resolve) { api.get({ id: 8, title: 'M', original_title: 'M', release_date: '2010-01-01' }, resolve); });
  const t = await new Promise(function (resolve) { api.get({ id: 8, name: 'M', original_name: 'M', first_air_date: '2010-01-01' }, resolve); });
  assert.strictEqual(m, 6);
  assert.strictEqual(t, 7);
}

// i) urgent jumps the queue
{
  const store = {};
  const called = [];
  const pending = [];
  const network = {
    timeout: function () {},
    silent: function (url, ok, fail) {
      called.push(url);
      pending.push(ok);
    }
  };
  const Lampa = {
    Storage: {
      cache: function (name, limit, def) { return store[name] || def; },
      set: function (name, v) { store[name] = v; }
    }
  };
  const code = src.slice(from, to);
  const api = new Function('Lampa', 'setTimeout', 'API', 'TTL', 'GAP', 'network', 'queue', 'busy', 'waiting', code + '\nreturn { isAnime: isAnime, get: get };')(
    Lampa, setTimeout, API, TTL, GAP, network, [], false, {}
  );
  const a = { id: 1, name: 'A', first_air_date: '2020-01-01' };
  const b = { id: 2, name: 'B', first_air_date: '2020-01-01' };
  const c = { id: 3, name: 'C', first_air_date: '2020-01-01' };
  const u = { id: 4, name: 'U', first_air_date: '2020-01-01' };
  api.get(a, function () {});
  api.get(b, function () {});
  api.get(c, function () {});
  api.get(u, function () {}, true);

  // resolve A
  pending[0]([]);
  await new Promise(function (r) { setTimeout(r, 0); });
  // resolve U
  pending[1]([]);
  await new Promise(function (r) { setTimeout(r, 0); });
  // resolve B
  pending[2]([]);
  await new Promise(function (r) { setTimeout(r, 0); });
  // resolve C
  pending[3]([]);
  await new Promise(function (r) { setTimeout(r, 0); });

  const names = called.map(function (url) {
    const m = url.match(/search=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : url;
  });
  assert.deepStrictEqual(names, ['A', 'U', 'B', 'C']);
}

// j) id lookup does not join a queued name search
{
  const fixtures = {};
  fixtures[API + "?limit=10&kind=!movie&search=Q"] = [{ aired_on: '2020-01-01', score: '5.0' }];
  fixtures[API + '/21'] = { score: '9.0' };
  const { api, called } = load(fixtures);
  const card1 = { id: 12, name: 'Q', original_name: 'Q', first_air_date: '2020-01-01' };
  const card2 = { id: 12, name: 'Q', original_name: 'Q', first_air_date: '2020-01-01', yani_shikimori: [21] };
  const p1 = new Promise(function (resolve) { api.get(card1, resolve); });
  const p2 = new Promise(function (resolve) { api.get(card2, resolve, true); });
  const results = await Promise.all([p1, p2]);
  assert.strictEqual(results[0], 5);
  assert.strictEqual(results[1], 9);
  assert.ok(called.indexOf(API + '/21') !== -1, 'API/21 should be called');
}

console.log('shikimori: ok');
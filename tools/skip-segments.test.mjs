import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('../plugin/online_mod.js', import.meta.url)), 'utf8');
const from = src.indexOf('    function skipOf(el)');
const to = src.indexOf('    function startPlayer(first, playlist)');
assert(from > 0 && to > from, 'skip code not found in plugin/online_mod.js');
const code = src.slice(from, to);

function load(fixtures, card) {
  const headers = [];
  const state = { calls: 0, timers: [] };
  const Lampa = {
    Reguest: function () {
      this.timeout = function () {};
      this.silent = function (url, ok, fail) {
        state.calls++;
        const path = url.replace('https://api.yani.tv', '');
        if (fixtures === null) return;
        Promise.resolve().then(function () {
          if (path in fixtures) ok({ response: fixtures[path] });
          else fail();
        });
      };
    },
    Activity: { active: function () { return { movie: card }; } },
    Loading: { start: function (cb) { state.cancel = cb; }, stop: function () {} }
  };
  const setDddHeader = function (item, name, value) { headers.push([name, value]); };
  const noTimer = function (fn) { state.timers.push(fn); };
  const api = new Function('setDddHeader', 'Lampa', 'setTimeout', code + '\nreturn { skipOf: skipOf, animeSkip: animeSkip, attachSkipSegments: attachSkipSegments };')(setDddHeader, Lampa, noTimer);
  return { api, headers, state };
}

// a) segments are indexed like the sanitized playlist (items without url are dropped)
{
  const { api, headers } = load({}, {});
  api.attachSkipSegments({}, [{ url: 'a' }, { url: '' }, { url: 'c', anime_segments: [1] }]);
  assert.deepStrictEqual(headers, [['X-DDD-Segments', '{"1":[1]}']]);
}

// b) concurrent get() of one path makes one request
{
  const { api, state } = load({ '/x': [1] }, {});
  const got = [];
  await new Promise(function (resolve) {
    api.animeSkip.get('/x', function (r) { got.push(r); }, assert.fail);
    api.animeSkip.get('/x', function (r) { got.push(r); resolve(); }, assert.fail);
  });
  assert.strictEqual(state.calls, 1);
  assert.deepStrictEqual(got, [[1], [1]]);
}

// c) non-anime playlist: done at once, no requests
{
  const { api, state } = load({}, { genres: [], original_language: 'en' });
  const list = [1, 2, 3].map(function (n) { return { url: 'u' + n, anime_skip: api.skipOf({ episode: n }) }; });
  let done = 0;
  api.animeSkip.prepare(list, function () { done++; });
  assert.strictEqual(done, 1);
  assert.strictEqual(state.calls, 0);
}

const aniskip = function (mal, n) {
  return 'https://api.aniskip.com/v2/skip-times/' + mal + '/' + n + '?types[]=op&types[]=ed&types[]=mixed-op&types[]=mixed-ed&episodeLength=0';
};
const animeCard = { kinopoisk_id: 1, genres: [{ id: 16 }], original_language: 'ja' };

const videosFixture = [{ number: '1', skips: { opening: { time: 0, length: 90 }, ending: null } }];
const yani = [{ type: 'op', startTime: 0, endTime: 90 }];
const prepared = function (api, list) {
  return new Promise(function (resolve) { api.animeSkip.prepare(list, resolve); });
};

// d) MAL id from the yani entry + timings: {segments, url} for the episode that has timings, url alone for the other
{
  const fixtures = {
    '/anime?limit=1&kp_ids=1': [{ anime_id: 5, anime_url: 'x', remote_ids: { myanimelist_id: 9 } }],
    '/anime/5/videos': videosFixture
  };
  const { api, state } = load(fixtures, animeCard);
  const list = [1, 2].map(function (n) { return { url: 'u' + n, anime_skip: api.skipOf({ episode: n }) }; });
  let done = 0;
  await new Promise(function (resolve) {
    api.animeSkip.prepare(list, function () { done++; resolve(); });
  });
  state.timers[0]();
  assert.strictEqual(done, 1);
  assert.deepStrictEqual(list[0].anime_segments, { segments: yani, url: aniskip(9, 1) });
  assert.strictEqual(list[1].anime_segments, aniskip(9, 2));
  assert.strictEqual(state.calls, 2);
}

// d2) entry without a MAL id: timings only, as a list
{
  const fixtures = {
    '/anime?limit=1&kp_ids=1': [{ anime_id: 5, anime_url: 'x', remote_ids: {} }],
    '/anime/5/videos': videosFixture
  };
  const { api } = load(fixtures, animeCard);
  const list = [1, 2].map(function (n) { return { url: 'u' + n, anime_skip: api.skipOf({ episode: n }) }; });
  await prepared(api, list);
  assert.deepStrictEqual(list[0].anime_segments, yani);
  assert.strictEqual(list[1].anime_segments, undefined);
}

// d3) Naruto-style item (malId + episode), timings found: object form, one entry lookup and one /videos request, header carries the object
{
  const fixtures = {
    '/anime?limit=1&mal_ids=7': [{ anime_id: 5, anime_url: 'x', remote_ids: {} }],
    '/anime/5/videos': videosFixture
  };
  const { api, state, headers } = load(fixtures, animeCard);
  const list = [{ url: 'u1', anime_skip: api.skipOf({ episode: 1, malId: 7 }) }];
  await prepared(api, list);
  const expected = { segments: yani, url: aniskip(7, 1) };
  assert.deepStrictEqual(list[0].anime_segments, expected);
  assert.strictEqual(state.calls, 2);
  api.attachSkipSegments({}, list);
  assert.deepStrictEqual(headers, [['X-DDD-Segments', JSON.stringify({ 0: expected })]]);
}

// d4) MAL id and episode known, yani down: the url string alone
{
  const { api } = load({}, animeCard);
  const list = [{ url: 'u1', anime_skip: { mal: 9, episode: 3, season: 1, shikimori: '' } }];
  await prepared(api, list);
  assert.strictEqual(list[0].anime_segments, aniskip(9, 3));
}

// d5) several known items share one entry and one /videos request
{
  const fixtures = {
    '/anime?limit=1&mal_ids=7': [{ anime_id: 5, anime_url: 'x', remote_ids: {} }],
    '/anime/5/videos': videosFixture
  };
  const { api, state } = load(fixtures, animeCard);
  const list = [1, 1].map(function (n) { return { url: 'u', anime_skip: api.skipOf({ episode: n, malId: 7 }) }; });
  await prepared(api, list);
  assert.strictEqual(state.calls, 2);
}

// d6) a failed fetch is remembered: the second prepare() is done at once, no new request
{
  const { api, state } = load({}, animeCard);
  const list = [{ url: 'u1', anime_skip: api.skipOf({ episode: 1 }) }];
  await prepared(api, list);
  const calls = state.calls;
  assert.strictEqual(calls, 1);
  let done = 0;
  api.animeSkip.prepare(list, function () { done++; });
  assert.strictEqual(done, 1);
  assert.strictEqual(state.calls, calls);
}

// f) 4 s cap with yani hanging: an item with a known MAL id still sends its url
{
  const { api, state } = load(null, animeCard);
  const list = [{ url: 'u1', anime_skip: api.skipOf({ episode: 2, malId: 7 }) }];
  let done = 0;
  api.animeSkip.prepare(list, function () { done++; });
  assert.strictEqual(done, 0);
  state.timers[0]();
  assert.strictEqual(done, 1);
  assert.strictEqual(list[0].anime_segments, aniskip(7, 2));
}

// e) cancel (back button) while requests hang: playback must not start
{
  const { api, state } = load(null, { kinopoisk_id: 1, genres: [{ id: 16 }], original_language: 'ja' });
  const list = [{ url: 'u1', anime_skip: api.skipOf({ episode: 1 }) }];
  let done = 0;
  api.animeSkip.prepare(list, function () { done++; });
  assert.strictEqual(typeof state.cancel, 'function');
  state.cancel();
  await Promise.resolve();
  assert.strictEqual(done, 0);
}

console.log('skip-segments OK');

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
  const state = { calls: 0 };
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
  const noTimer = function () {};
  const api = new Function('setDddHeader', 'Lampa', 'setTimeout', code + '\nreturn { skipOf: skipOf, animeSkip: animeSkip, attachSkipSegments: attachSkipSegments, skipTimesUrl: skipTimesUrl };')(setDddHeader, Lampa, noTimer);
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

// d) MAL id known (from the yani entry): AniSkip url for every item, YummyAnime videos are not fetched
{
  const fixtures = {
    '/anime?limit=1&kp_ids=1': [{ anime_id: 5, anime_url: 'x', remote_ids: { myanimelist_id: 9 } }],
    '/anime/5/videos': [{ number: '1', skips: { opening: { time: 0, length: 90 }, ending: null } }]
  };
  const { api, state } = load(fixtures, animeCard);
  const list = [1, 2].map(function (n) { return { url: 'u' + n, anime_skip: api.skipOf({ episode: n }) }; });
  let done = 0;
  await new Promise(function (resolve) {
    api.animeSkip.prepare(list, function () { done++; resolve(); });
  });
  await Promise.resolve();
  assert.strictEqual(done, 1);
  assert.strictEqual(list[0].anime_segments, aniskip(9, 1));
  assert.strictEqual(list[1].anime_segments, aniskip(9, 2));
  assert.strictEqual(state.calls, 1);
}

// d2) entry without a MAL id: YummyAnime timings inline
{
  const fixtures = {
    '/anime?limit=1&kp_ids=1': [{ anime_id: 5, anime_url: 'x', remote_ids: {} }],
    '/anime/5/videos': [{ number: '1', skips: { opening: { time: 0, length: 90 }, ending: null } }]
  };
  const { api } = load(fixtures, animeCard);
  const list = [1, 2].map(function (n) { return { url: 'u' + n, anime_skip: api.skipOf({ episode: n }) }; });
  await new Promise(function (resolve) {
    api.animeSkip.prepare(list, resolve);
  });
  assert.deepStrictEqual(list[0].anime_segments, [{ type: 'op', startTime: 0, endTime: 90 }]);
  assert.strictEqual(list[1].anime_segments, undefined);
}

// d4) item that already knows MAL id and episode: AniSkip url at once, no request, done once
{
  const { api, state } = load({}, animeCard);
  const list = [{ url: 'u1', anime_skip: { mal: 9, episode: 3, season: 1, shikimori: '' } }];
  let done = 0;
  api.animeSkip.prepare(list, function () { done++; });
  assert.strictEqual(done, 1);
  assert.strictEqual(state.calls, 0);
  assert.strictEqual(list[0].anime_segments, aniskip(9, 3));
}

// d5) Naruto Based url builder
{
  const { api } = load({}, {});
  assert.strictEqual(api.skipTimesUrl('https://s', 7, 3), 'https://s/api/player/skip-times?malId=7&episode=3&duration=0');
  assert.strictEqual(api.skipTimesUrl('https://s', '', 3), undefined);
  assert.strictEqual(api.skipTimesUrl('https://s', 7, ''), undefined);
}

// d3) Naruto Based item: url already set, nothing to look up, done at once, header carries the url
{
  const { api, state, headers } = load({}, animeCard);
  const url = 'https://site/api/player/skip-times?malId=7&episode=3&duration=0';
  const list = [{ url: 'u1', anime_skip: api.skipOf({ episode: 3, malId: 7 }), anime_segments: url }];
  let done = 0;
  api.animeSkip.prepare(list, function () { done++; });
  assert.strictEqual(done, 1);
  assert.strictEqual(state.calls, 0);
  api.attachSkipSegments({}, list);
  assert.deepStrictEqual(headers, [['X-DDD-Segments', JSON.stringify({ 0: url })]]);
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

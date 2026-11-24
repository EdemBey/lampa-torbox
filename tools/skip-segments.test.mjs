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

// Three uploads agree on the opening; one lone upload claims a wrong ending (ignored: fewer than 3 votes).
const upload = (skips) => ({ number: '1', duration: 1400, skips: skips });
const videosFixture = [
  upload({ opening: { time: 0, length: 90 }, ending: { time: 600, length: 90 } }),
  upload({ opening: { time: 2, length: 88 }, ending: null }),
  upload({ opening: { time: 0, length: 90 }, ending: null }),
  upload({ opening: null, ending: null }),
  // Another cut with a wrong opening: ignored, only the most common duration votes
  { number: '1', duration: 1500, skips: { opening: { time: 300, length: 90 }, ending: null } }
];
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

// g) regular TV series: TheIntroDB (+ IntroDB with an IMDb id) urls, no request, done at once
{
  const tv = { id: 1396, number_of_seasons: 5, genres: [], original_language: 'en', imdb_id: 'tt0903747' };
  const { api, state, headers } = load({}, tv);
  const list = [{ url: 'u1', anime_skip: api.skipOf({ season: 2, episode: 3 }) }];
  let done = 0;
  api.animeSkip.prepare(list, function () { done++; });
  assert.strictEqual(done, 1);
  assert.strictEqual(state.calls, 0);
  const expected = { url: [
    'https://api.theintrodb.org/v4/media?tmdb_id=1396&season=2&episode=3',
    'https://api.introdb.app/segments?imdb_id=tt0903747&season=2&episode=3'
  ] };
  assert.deepStrictEqual(list[0].anime_segments, expected);
  api.attachSkipSegments({}, list);
  assert.deepStrictEqual(headers, [['X-DDD-Segments', JSON.stringify({ 0: expected })]]);
}

// g2) series without an IMDb id: one url; other sources and movies get nothing
{
  const run = function (card, season) {
    const { api, state } = load({}, card);
    const list = [{ url: 'u1', anime_skip: api.skipOf({ season: season === undefined ? 1 : season, episode: 1 }) }];
    let done = 0;
    api.animeSkip.prepare(list, function () { done++; });
    assert.strictEqual(done, 1);
    assert.strictEqual(state.calls, 0);
    return list[0].anime_segments;
  };
  assert.deepStrictEqual(run({ id: 5, number_of_seasons: 1, source: 'tmdb', imdb_id: 'bad' }), { url: 'https://api.theintrodb.org/v4/media?tmdb_id=5&season=1&episode=1' });
  assert.strictEqual(run({ id: 5, number_of_seasons: 1, source: 'ivi' }), undefined);
  assert.strictEqual(run({ id: 5, number_of_seasons: 1 }, 0), undefined);
  assert.strictEqual(run({ id: 5, title: 'Film', original_title: 'Film', genres: [] }), undefined);
}

// g3) header size guard: 30 items get series urls, 31 do not
{
  const tv = { id: 5, number_of_seasons: 1, genres: [], original_language: 'en' };
  const make = function (count) {
    const { api } = load({}, tv);
    const list = [];
    for (let n = 1; n <= count; n++) list.push({ url: 'u' + n, anime_skip: api.skipOf({ season: 1, episode: n }) });
    api.animeSkip.prepare(list, function () {});
    return list;
  };
  assert.ok(make(30).every(function (item) { return item.anime_segments; }));
  assert.ok(make(31).every(function (item) { return item.anime_segments === undefined; }));
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

// h) YummyAnime voting: lone marks are dropped, missing durations and tiny titles still work
{
  const { api } = load({}, {});
  const up = (d, skips) => ({ number: '1', duration: d, skips: skips });
  const op = (t, l) => ({ opening: { time: t, length: l } });
  // 2 of 20 same-cut uploads mark an opening: below 3 votes and 15%
  const noise = Array.from({ length: 18 }, () => up(2924, {})).concat([up(2924, op(0, 214)), up(2924, op(0, 214))]);
  assert.deepStrictEqual(api.animeSkip.fromVideos(noise, '1'), []);
  // Without durations every upload votes; numbers may come as strings
  assert.deepStrictEqual(api.animeSkip.fromVideos([1, 2, 3].map(() => ({ number: '1', skips: { opening: { time: '10', length: '80' } } })), '1'), [{ type: 'op', startTime: 10, endTime: 90 }]);
  // A title with two uploads needs only two agreeing marks
  assert.deepStrictEqual(api.animeSkip.fromVideos([up(100, { ending: { time: 50, length: 30 } }), up(100, { ending: { time: 51, length: 30 } })], '1'), [{ type: 'ed', startTime: 51, endTime: 81 }]);
}

console.log('skip-segments OK');

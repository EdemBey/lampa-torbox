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
  const api = new Function('setDddHeader', 'Lampa', 'setTimeout', 'isExternalAndroidPlayer', code + '\nreturn { skipOf: skipOf, animeSkip: animeSkip, attachSkipSegments: attachSkipSegments };')(setDddHeader, Lampa, noTimer, function () { return true; });
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
  return 'https://api.aniskip.com/v2/skip-times/' + mal + '/' + n + '?types[]=op&types[]=ed&types[]=mixed-op&types[]=mixed-ed&types[]=recap&episodeLength=0';
};
// The episode first, then its neighbours (no episode 0)
const aniskips = function (mal, n) {
  return [n, n - 1, n + 1].filter(function (e) { return e > 0; }).map(function (e) { return aniskip(mal, e); });
};
const animeCard = { kinopoisk_id: 1, genres: [{ id: 16 }], original_language: 'ja' };

// Kodik uploads of episode 1 with different voiceovers, plus a CVH upload of the same voiceover
const videosFixture = [
  { number: '1', data: { player: 'Плеер Kodik', dubbing: 'Озвучка AniDUB' }, skips: { opening: { time: 10, length: 90 }, ending: null } },
  { number: '1', data: { player: 'Плеер Kodik', dubbing: 'Субтитры Netflix' }, skips: { opening: { time: 0, length: 214 }, ending: { time: 600, length: 19 } } },
  { number: '1', data: { player: 'Плеер CVH', dubbing: 'Озвучка AniDUB' }, skips: { opening: { time: 50, length: 90 } } }
];
const prepared = function (api, list) {
  return new Promise(function (resolve) { api.animeSkip.prepare(list, resolve); });
};

// d) MAL id known (Naruto Based, Alloha...): AniSkip urls for the episode and its neighbours, no request, done at once
{
  const { api, state, headers } = load({}, animeCard);
  const list = [1, 2].map(function (n) { return { url: 'u' + n, anime_skip: api.skipOf({ episode: n, malId: 7 }) }; });
  let done = 0;
  api.animeSkip.prepare(list, function () { done++; });
  assert.strictEqual(done, 1);
  assert.strictEqual(state.calls, 0);
  assert.deepStrictEqual(list[0].anime_segments, { aniskip: aniskips(7, 1) });
  assert.deepStrictEqual(list[1].anime_segments, { aniskip: aniskips(7, 2) });
  assert.strictEqual(list[1].anime_segments.aniskip.length, 3);
  api.attachSkipSegments({}, list);
  assert.deepStrictEqual(headers, [['X-DDD-Segments', JSON.stringify({ 0: list[0].anime_segments, 1: list[1].anime_segments })]]);
}

// d2) MAL id from the yani entry (kp id): AniSkip urls; no /videos without a Kodik voiceover
{
  const { api, state } = load({ '/anime?limit=1&kp_ids=1': [{ anime_id: 5, anime_url: 'x', remote_ids: { myanimelist_id: 9 } }] }, animeCard);
  const list = [{ url: 'u1', anime_skip: api.skipOf({ episode: 2 }) }];
  await prepared(api, list);
  assert.deepStrictEqual(list[0].anime_segments, { aniskip: aniskips(9, 2) });
  assert.strictEqual(state.calls, 1);
}

// d3) Kodik: timings of the Kodik upload with the chosen voiceover only (not CVH, not another voiceover)
{
  const fixtures = {
    '/anime?limit=1&shikimori_ids=61469': [{ anime_id: 5, anime_url: 'x', remote_ids: { myanimelist_id: 61469 } }],
    '/anime/5/videos': videosFixture
  };
  const { api } = load(fixtures, animeCard);
  const list = [{ url: 'u1', anime_skip: api.skipOf({ episode: 1, shikimori: 61469, kodik_voice: 'AniDUB' }) }];
  await prepared(api, list);
  assert.deepStrictEqual(list[0].anime_segments, { aniskip: aniskips(61469, 1), segments: [{ type: 'op', startTime: 10, endTime: 100 }] });
}

// d4) Kodik voiceover without a YummyAnime upload: AniSkip only
{
  const fixtures = {
    '/anime?limit=1&shikimori_ids=61469': [{ anime_id: 5, anime_url: 'x', remote_ids: { myanimelist_id: 61469 } }],
    '/anime/5/videos': videosFixture
  };
  const { api } = load(fixtures, animeCard);
  const list = [{ url: 'u1', anime_skip: api.skipOf({ episode: 1, shikimori: 61469, kodik_voice: 'Студийная Банда' }) }];
  await prepared(api, list);
  assert.deepStrictEqual(list[0].anime_segments, { aniskip: aniskips(61469, 1) });
}

// d4c) Alloha: only its own /skips url, no TheIntroDB
{
  const tv = { id: 5, number_of_seasons: 1, genres: [], original_language: 'en' };
  const { api } = load({}, tv);
  const list = [{ url: 'u1', anime_skip: api.skipOf({ season: 1, episode: 2, alloha_skips: 'https://h/skips?url=x' }) }];
  api.animeSkip.prepare(list, function () {});
  assert.deepStrictEqual(list[0].anime_segments, { url: 'https://h/skips?url=x' });
}
{
  const { api } = load({}, animeCard);
  const list = [{ url: 'u1', anime_skip: api.skipOf({ episode: 2, malId: 7, alloha_skips: 'https://h/skips?url=x' }) }];
  api.animeSkip.prepare(list, function () {});
  assert.deepStrictEqual(list[0].anime_segments, { aniskip: aniskips(7, 2), url: 'https://h/skips?url=x' });
}

// d5) no MAL id anywhere (entry without remote ids): nothing
{
  const { api } = load({ '/anime?limit=1&kp_ids=1': [{ anime_id: 5, anime_url: 'x', remote_ids: {} }] }, animeCard);
  const list = [{ url: 'u1', anime_skip: api.skipOf({ episode: 1 }) }];
  await prepared(api, list);
  assert.strictEqual(list[0].anime_segments, undefined);
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

// f) 4 s cap with yani hanging: a Kodik item with a known MAL id still sends its AniSkip urls
{
  const { api, state } = load(null, animeCard);
  const list = [{ url: 'u1', anime_skip: { mal: 7, episode: 2, season: 1, shikimori: '', voice: 'AniDUB' } }];
  let done = 0;
  api.animeSkip.prepare(list, function () { done++; });
  assert.strictEqual(done, 0);
  state.timers[0]();
  assert.strictEqual(done, 1);
  assert.deepStrictEqual(list[0].anime_segments, { aniskip: aniskips(7, 2) });
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

// h) Kodik voiceover names match YummyAnime dubbing names loosely; short names never match
{
  const { api } = load({}, {});
  assert.deepStrictEqual(api.animeSkip.kodikTimings(videosFixture, 1, 'Netflix'), [{ type: 'op', startTime: 0, endTime: 214 }, { type: 'ed', startTime: 600, endTime: 619 }]);
  assert.deepStrictEqual(api.animeSkip.kodikTimings(videosFixture, 1, 'An'), []);
  assert.deepStrictEqual(api.animeSkip.kodikTimings(videosFixture, 2, 'AniDUB'), []);
  // The exact name wins over a longer one listed first
  const both = [
    { number: '1', data: { player: 'Плеер Kodik', dubbing: 'Озвучка AniDUB Online' }, skips: { opening: { time: 5, length: 90 } } },
    { number: '1', data: { player: 'Плеер Kodik', dubbing: 'Озвучка AniDUB' }, skips: { opening: { time: 10, length: 90 } } }
  ];
  assert.deepStrictEqual(api.animeSkip.kodikTimings(both, 1, 'AniDUB'), [{ type: 'op', startTime: 10, endTime: 100 }]);
}

// i) Lampa's own player (browserSkip): resolved once the video length is known, like DDD
{
  const fixtures = {};
  const ep2 = aniskip(61469, 2), ep1 = aniskip(61469, 1), ep3 = aniskip(61469, 3);
  fixtures[ep2] = { found: true, results: [
    { interval: { startTime: 182, endTime: 270.3 }, skipType: 'op', episodeLength: 1512 },
    { interval: { startTime: 1297.7, endTime: 1387.5 }, skipType: 'ed', episodeLength: 1516.1 }
  ] };
  fixtures[ep1] = { found: true, results: [{ interval: { startTime: 136.8, endTime: 223.8 }, skipType: 'op', episodeLength: 1516 }] };
  fixtures[ep3] = { found: true, results: [{ interval: { startTime: 30, endTime: 120 }, skipType: 'op', episodeLength: 1516 }] };
  const tvdb = 'https://api.theintrodb.org/v4/media?tmdb_id=1396&season=1&episode=2';
  fixtures[tvdb] = { intro: [{ start_ms: 314517, end_ms: 331147 }], recap: [{ start_ms: 0, end_ms: 0 }, { start_ms: 10000, end_ms: null }], credits: [{ start_ms: 2848346, end_ms: null }] };
  fixtures['https://h/skips'] = { intro: [], credits: [{ start_ms: 1345000, end_ms: 1441000 }] };
  let calls = 0;
  const api = new Function('Lampa', code.slice(code.indexOf('    var browserSkip = {'), code.indexOf('    // X-DDD-Segments, indexed')) + '\nreturn browserSkip;')({
    Reguest: function () {
      this.timeout = function () {};
      this.silent = function (url, ok, fail) { calls++; Promise.resolve().then(function () { if (url in fixtures) ok(fixtures[url]); else fail(); }); };
    }
  });
  const resolved = function (source, duration) { return new Promise(function (r) { api.resolve(source, duration, r); }); };
  // JoJo SBR ep 2 (1516 s): its own ed, the opening from AniSkip's ep 1; ep 3's same-length opening does not add a second one
  assert.deepStrictEqual(await resolved({ aniskip: [ep2, ep1, ep3] }, 1516), [{ type: 'op', start: 136.8, end: 223.8 }, { type: 'ed', start: 1297.7, end: 1387.5 }]);
  // ep 3 (1512 s): only the 1512 s opening
  assert.deepStrictEqual(await resolved({ aniskip: [ep2] }, 1512.085), [{ type: 'op', start: 182, end: 270.3 }]);
  // Kodik's own timing wins over an overlapping AniSkip one
  assert.deepStrictEqual(await resolved({ segments: [{ type: 'op', startTime: 140, endTime: 230 }], aniskip: [ep2, ep1] }, 1516), [{ type: 'op', start: 140, end: 230 }, { type: 'ed', start: 1297.7, end: 1387.5 }]);
  // Series: junk recaps dropped, credits to the end; IntroDB (no CORS) is never requested
  const before = calls;
  assert.deepStrictEqual(await resolved({ url: [tvdb, 'https://api.introdb.app/segments?imdb_id=tt1'] }, 2900), [{ type: 'op', start: 314.517, end: 331.147 }, { type: 'ed', start: 2848.346, end: 2900 }]);
  assert.strictEqual(calls - before, 1);
  assert.deepStrictEqual(await resolved({ url: 'https://h/skips' }, 1500), [{ type: 'ed', start: 1345, end: 1441 }]);
  // Nothing to resolve
  assert.deepStrictEqual(await resolved(undefined, 100), []);
}

console.log('skip-segments OK');

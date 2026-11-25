import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('../plugin/online_mod.js', import.meta.url)), 'utf8');
const from = src.indexOf('    var watch = {');
const to = src.indexOf('    // Season/episode of a playlist item');
assert(from > 0 && to > from, 'watch code not found in plugin/online_mod.js');
const code = src.slice(from, to);

const store = {};
let updateCalls = 0;
const viewed = {};
const listeners = [];
let apiData = null;

const Lampa = {
  Utils: {
    hash: (s) => 'h:' + s,
    countSeasons: (c) => {
      const n = (c.seasons || []).filter((s) => s.episode_count > 0).length;
      return c.number_of_seasons ? Math.min(n, c.number_of_seasons) : n;
    },
    splitEpisodesIntoSeasons: (eps) => {
      const parts = {};
      let cur = 1;
      let bucket = [];
      eps.forEach((e) => {
        if (e && e.cut) { if (bucket.length) { parts[cur++] = bucket; bucket = []; } }
        bucket.push(e);
      });
      if (bucket.length) parts[cur] = bucket;
      return parts;
    }
  },
  Storage: {
    get: (k, d) => (k === 'fv' ? viewed : (store[k] !== undefined ? store[k] : (d === '{}' ? {} : d))),
    set: (k, v) => { store[k] = v; },
    cache: (k, ttl, def) => (k === 'fv' ? viewed : (store[k] !== undefined ? store[k] : (def || {})))
  },
  Api: { seasons: (card, list, cb) => cb(apiData) },
  Timeline: {
    filename: () => 'fv',
    listener: { follow: (name, fn) => { listeners.push(fn); } },
    link: (card, s, e) => ({ card: 'tv_' + card.id, season: s, episode: e }),
    view: (hash, meta) => {
      const v = viewed[hash] || { percent: 0, time: 0, duration: 0 };
      const out = { hash: hash, percent: v.percent, time: v.time, duration: v.duration, updated: v.updated };
      if (meta) { out.card = meta.card; out.season = meta.season; out.episode = meta.episode; }
      return out;
    },
    update: (p) => {
      updateCalls++;
      const prev = viewed[p.hash] || {};
      viewed[p.hash] = {
        percent: p.percent,
        time: p.time,
        duration: p.duration,
        card: p.card !== undefined ? p.card : prev.card,
        season: p.card ? p.season : prev.season,
        episode: p.card ? p.episode : prev.episode,
        updated: p.updated !== undefined ? p.updated : prev.updated,
        profile: p.profile !== undefined ? p.profile : prev.profile
      };
      listeners.forEach((fn) => fn({ data: { hash: p.hash, road: viewed[p.hash] } }));
    }
  },
  Listener: { follow: () => {} }
};

const animeSkip = { isAnime: (card) => !!card.anime, get: () => {} };
const skipOf = () => null;

const watch = new Function('Lampa', 'animeSkip', 'skipOf', 'window', code + '\nreturn watch;')(Lampa, animeSkip, skipOf, {});

// canon
{
  assert.deepStrictEqual(watch.canon([1, 1, 1], 13, { 1: 12, 2: 12 }), { season: 2, episode: 1 });
  assert.deepStrictEqual(watch.canon([1, 1, 1], 25, { 1: 12, 2: 12 }), { season: 2, episode: 13 });
  assert.strictEqual(watch.canon([5, 1, 1], 3, { 1: 12 }), null);
}

// place helpers
function q(extra) { return Object.assign({ src: '', balancer: 'rezka2' }, extra); }

// non-anime fits
{
  const m = {};
  const counts = { 1: 10, 2: 10 };
  assert.deepStrictEqual(watch.place(m, counts, false, q({ season: 2, episode: 3, min: 1, max: 10 })), { season: 2, episode: 3 });
}
// season 1 of 22 eps
{
  const m = {};
  const counts = { 1: 10, 2: 12 };
  assert.deepStrictEqual(watch.place(m, counts, false, q({ season: 1, episode: 11, min: 1, max: 22 })), { season: 2, episode: 1 });
}
// season 1 of 13 eps
{
  const m = {};
  const counts = { 1: 12, 2: 12 };
  assert.deepStrictEqual(watch.place(m, counts, false, q({ season: 1, episode: 13, min: 1, max: 13 })), null);
}
// anime season 2 without std / with std
{
  const counts = { 1: 12, 2: 12 };
  assert.strictEqual(watch.place({}, counts, true, q({ season: 2, episode: 3, min: 1, max: 12 })), null);
  assert.deepStrictEqual(watch.place({ std: 1 }, counts, true, q({ season: 2, episode: 3, min: 1, max: 12 })), { season: 2, episode: 3 });
}
// season 2 listing 13..25
{
  const counts = { 1: 12, 2: 13 };
  assert.deepStrictEqual(watch.place({}, counts, false, q({ season: 2, episode: 13, min: 13, max: 25 })), { season: 2, episode: 1 });
  // 1..25 in the last season: a series keeps its numbers (TMDB lags behind a running season), anime asks
  assert.deepStrictEqual(watch.place({}, counts, false, q({ season: 2, episode: 13, min: 1, max: 25 })), { season: 2, episode: 13 });
  assert.strictEqual(watch.place({}, counts, true, q({ season: 2, episode: 13, min: 1, max: 25 })), null);
}
// shiki src without saved map -> null
{
  assert.strictEqual(watch.place({}, { 1: 12, 2: 12 }, true, { src: 'shiki:1', balancer: 'kodik', season: 1, episode: 3, min: 1, max: 12 }), null);
}
// map saved
{
  assert.strictEqual(watch.place({ 'rezka2:2': 0 }, { 1: 12, 2: 12 }, false, q({ season: 2, episode: 1, min: 1, max: 12 })), false);
  const m = { 'rezka2:2': [1, 2, 5], 'std:2': [1, 2, 1] };
  assert.deepStrictEqual(watch.place(m, { 1: 12, 2: 12 }, false, q({ season: 2, episode: 1, min: 1, max: 12 })), { season: 2, episode: 5 });
}
// no TMDB list
{
  assert.deepStrictEqual(watch.place({}, {}, false, q({ season: 2, episode: 3, min: 1, max: 3 })), { season: 2, episode: 3 });
}

// stacked
{
  const part = { index: 1, bounds: [0, 12, 25], first: 1 };
  assert.deepStrictEqual(watch.stacked(part, 1, { 1: 25 }), { season: 1, episode: 13 });
  const part2 = { index: 1, bounds: [0, 12, 24], first: 1 };
  assert.strictEqual(watch.stacked(part2, 1, { 1: 26 }), null);
  const part3 = { index: 0, bounds: [0, 13], first: 1 };
  assert.strictEqual(watch.stacked(part3, 13, { 1: 12, 2: 12 }), null);
  const part4 = { index: -1, bounds: [0, 12, 25], first: 1 };
  assert.strictEqual(watch.stacked(part4, 1, { 1: 25 }), false);
  const part5 = { index: 1, bounds: [0, 12, 25], first: 13 };
  assert.deepStrictEqual(watch.stacked(part5, 13, { 1: 25 }), { season: 1, episode: 13 });
}
// episode 0 -> false
{
  const part = { index: 1, bounds: [0, 12, 25], first: 1 };
  assert.strictEqual(watch.stacked(part, 0, { 1: 25 }), false);
}

// view + link + migration
{
  // reset
  for (const k in viewed) delete viewed[k];
  updateCalls = 0;
  listeners.length = 0;
  watch.installed = false;
  for (const k in store) delete store[k];
  store['online_mod_watch_map'] = {};
  store['online_mod_watch_split'] = { 'tmdb_5': { '1': 10 } };
  watch.splits = null;
  watch.cached = undefined; watch.cachedCard = undefined; watch.cachedSeason = undefined; watch.cachedLength = undefined; watch.cachedSplit = undefined; watch.cachedSeasons = undefined;
 
  const card = { id: 5, original_title: 'X', seasons: [{ season_number: 1, episode_count: 10 }], source: 'tmdb' };
  const element = { season: '1', episode: '3' };
  const legacy = 'legacy';
  viewed['legacy'] = { percent: 40, time: 100, duration: 250 };

  const v = watch.view(card, 'kodik', element, legacy, [element]);
  assert.strictEqual(v.percent, 40);
  assert.ok(viewed['h:13X']);
  assert.strictEqual(viewed['h:13X'].card, 'tv_5');
}

// relink
{
  // links should be registered
  assert.ok(watch.links['h:13X']);
  delete viewed['h:13X'];
  const beforeCalls = updateCalls;
  Lampa.Timeline.update({ hash: 'h:13X', percent: 90, time: 200, duration: 250 });
  assert.strictEqual(viewed['h:13X'].card, 'tv_5');
  assert.strictEqual(updateCalls, beforeCalls + 2);
}

// relink: record already has card -> cardless update does not trigger second update
{
  for (const k in viewed) delete viewed[k];
  updateCalls = 0;
  watch.installed = false;
  for (const k in store) delete store[k];
  store['online_mod_watch_map'] = {};
  const card = { id: 5, original_title: 'X', seasons: [{ season_number: 1, episode_count: 10 }], source: 'tmdb' };
  const element = { season: '1', episode: '3' };
  const legacy = 'legacy';
  viewed['h:13X'] = { percent: 40, time: 100, duration: 250, card: 'tv_5', season: 1, episode: 3 };
  const v = watch.view(card, 'kodik', element, legacy, [element]);
  const beforeCalls = updateCalls;
  Lampa.Timeline.update({ hash: 'h:13X', percent: 90, time: 200, duration: 250 });
  assert.strictEqual(updateCalls, beforeCalls + 1);
}
// unproven
{
  for (const k in viewed) delete viewed[k];
  updateCalls = 0;
  watch.installed = false;
  for (const k in store) delete store[k];
  store['online_mod_watch_map'] = {};
  const card = { id: 6, original_title: 'Y', anime: true, seasons: [{ season_number: 1, episode_count: 12 }, { season_number: 2, episode_count: 12 }] };
  const element = { season: '2', episode: '3' };
  const legacy = 'legacy2';
  viewed['legacy2'] = { percent: 0, time: 0, duration: 0 };
  const v = watch.view(card, 'kodik', element, legacy, [element]);
  assert.strictEqual(v.hash, legacy);
  assert.strictEqual(element.watch_pending, true);
}

// migration: legacy equals standard key of raw numbers but place shifted -> no copy
{
  for (const k in viewed) delete viewed[k];
  updateCalls = 0;
  watch.installed = false;
  for (const k in store) delete store[k];
  store['online_mod_watch_map'] = {};
  const card = { id: 11, original_title: 'X', seasons: [{ season_number: 1, episode_count: 12 }, { season_number: 2, episode_count: 13 }] };
  const element = { season: '1', episode: '25' };
  const legacy = 'h:125X';
  viewed[legacy] = { percent: 40, time: 100, duration: 250 };
  const v = watch.view(card, 'kodik', element, legacy, [element]);
  assert.strictEqual(v.percent, 0);
}
// TorBox-like hashOf (no items list)
{
  const card = { id: 7, original_title: 'X', seasons: [{ season_number: 1, episode_count: 12 }, { season_number: 2, episode_count: 10 }] };
  assert.strictEqual(watch.hashOf(card, 'torbox', { season: '2', episode: '13' }, null), '');
  const card2 = { id: 8, original_title: 'X', seasons: [{ season_number: 1, episode_count: 12 }, { season_number: 2, episode_count: 13 }] };
  assert.strictEqual(watch.hashOf(card2, 'torbox', { season: '1', episode: '25' }, null), '');
  const card3 = { id: 9, original_title: 'X', seasons: [{ season_number: 1, episode_count: 12 }, { season_number: 2, episode_count: 10 }] };
  assert.strictEqual(watch.hashOf(card3, 'torbox', { season: '2', episode: '3' }, null), 'h:23X');
}
// card without original_title
{
  const card = { id: 10, seasons: [{ season_number: 1, episode_count: 12 }] };
  assert.strictEqual(watch.hashOf(card, 'torbox', { season: '1', episode: '2' }, null), '');
}
// cross-card cache: counts must not leak between cards
{
  const cardA = { id: 1, original_title: 'X', seasons: [{ season_number: 1, episode_count: 12 }, { season_number: 2, episode_count: 10 }] };
  const cardB = { id: 2, original_title: 'X', seasons: [{ season_number: 1, episode_count: 20 }, { season_number: 2, episode_count: 20 }] };
  assert.strictEqual(watch.hashOf(cardA, 'torbox', { season: '2', episode: '15' }, null), '');
  assert.strictEqual(watch.hashOf(cardB, 'torbox', { season: '2', episode: '15' }, null), 'h:215X');
  // reverse order on a fresh pair
  watch.cached = undefined; watch.cachedCard = undefined; watch.cachedSeason = undefined; watch.cachedLength = undefined;
  assert.strictEqual(watch.hashOf(cardB, 'torbox', { season: '2', episode: '15' }, null), 'h:215X');
  assert.strictEqual(watch.hashOf(cardA, 'torbox', { season: '2', episode: '15' }, null), '');
}
// same regex as plugin/torbox-lampa-plugin.js (_getPlayerConfig)
{
  const strict = (name) => {
    const m = name.match(/(?:^|[^a-z0-9])s(\d{1,2})[ ._-]?e(\d{1,4})(?!\d)/i);
    return m ? [Number(m[1]), Number(m[2])] : null;
  };
  assert.deepStrictEqual(strict('Show.S02E05.1080p.mkv'), [2, 5]);
  assert.deepStrictEqual(strict('Show - s1e12 [x].mkv'), [1, 12]);
  assert.strictEqual(strict('Movie.DTS5.1.mkv'), null);
  assert.strictEqual(strict('Se7en.1995.mkv'), null);
  assert.strictEqual(strict('Show.S02.Pack'), null);
}
// every TMDB-like balancer and Kodik go through the shared key; the six with their own keys do not yet
{
  // redheadsound (movies) and Naruto Based (its own tracking keys) keep their own keys
  assert.strictEqual(src.split('component.watchView(element, hash, items)').length - 1, 21);
  assert.strictEqual(src.split('var view = Lampa.Timeline.view(hash);').length - 1, 2);
  // release-numbered balancers are never placed by the TMDB rules: their own release key
  ['anilibria:', 'anilibria2:', 'animelib:'].forEach((s) => assert.ok(src.indexOf("watch_info: { src: '" + s + "'") > 0, s));
  // every item menu gets its element: "Match episodes…" and the redraw after an answer look it up
  const menus = src.split('component.contextmenu({').slice(1);
  assert.ok(menus.length >= 21);
  menus.forEach((rest, i) => assert.ok(rest.slice(0, rest.indexOf('});')).indexOf('element: element') >= 0, 'contextmenu #' + (i + 1) + ' without element'));
}
// place: split
{
  const counts = { 1: 24, 2: 13, 3: 13, 4: 13 };
  const m = {};
  assert.deepStrictEqual(watch.place(m, counts, true, { src: '', balancer: 'alloha', season: 2, episode: 9, min: 1, max: 13, split: true, seasons: 4 }), { season: 2, episode: 9 });
  assert.strictEqual(watch.place(m, counts, true, { src: '', balancer: 'alloha', season: 2, episode: 9, min: 1, max: 12, split: true, seasons: 4 }), null);
  assert.strictEqual(watch.place(m, counts, true, { src: '', balancer: 'alloha', season: 2, episode: 9, min: 1, max: 13, split: true, seasons: 5 }), null);
  assert.strictEqual(watch.place(m, counts, true, { src: '', balancer: 'alloha', season: 2, episode: 9, min: 1, max: 13, split: false, seasons: 4 }), null);
}

// prefetch
{
  for (const k in store) delete store[k];
  store['online_mod_watch_map'] = {};
  store['online_mod_watch_split'] = {};
  watch.splits = null;
  watch.cached = undefined; watch.cachedCard = undefined; watch.cachedSeason = undefined; watch.cachedLength = undefined; watch.cachedSplit = undefined;
  const eps = [];
  for (let i = 0; i < 63; i++) eps.push({ n: i + 1 });
  eps[24].cut = true; eps[37].cut = true; eps[50].cut = true;
  apiData = { 1: { episodes_original: eps } };
  const card = { id: 105009, original_name: 'X', original_title: 'X', anime: true, number_of_seasons: 1, seasons: [{ season_number: 0, episode_count: 44 }, { season_number: 1, episode_count: 63 }] };
  // split unknown -> hashOf keeps source's own key
  const unknownCard = { id: 999, original_name: 'Z', original_title: 'Z', number_of_seasons: 1, seasons: [{ season_number: 1, episode_count: 5 }] };
  assert.strictEqual(watch.hashOf(unknownCard, 'alloha', { season: '1', episode: '2' }, null), '');
  watch.prefetch(card);
  assert.deepStrictEqual(watch.splitOf(card), { 1: 24, 2: 13, 3: 13, 4: 13 });
  assert.deepStrictEqual(watch.counts(card), { 1: 24, 2: 13, 3: 13, 4: 13 });
  // cached split -> no fetch; force -> fetch
  let calls = 0;
  const orig = Lampa.Api.seasons;
  Lampa.Api.seasons = (c, l, cb) => { calls++; cb(apiData); };
  watch.prefetch(card);
  assert.strictEqual(calls, 0);
  watch.prefetch(card, true);
  assert.strictEqual(calls, 1);
  Lampa.Api.seasons = orig;
  // two real seasons -> no fetch
  let calls2 = 0;
  const orig2 = Lampa.Api.seasons;
  Lampa.Api.seasons = (c, l, cb) => { calls2++; cb(apiData); };
  const card2 = { id: 2, original_name: 'Y', original_title: 'Y', seasons: [{ season_number: 1, episode_count: 10 }, { season_number: 2, episode_count: 10 }] };
  watch.prefetch(card2);
  assert.strictEqual(calls2, 0);
  Lampa.Api.seasons = orig2;
}

// cached split invalidated when card becomes multi-season
{
  for (const k in store) delete store[k];
  store['online_mod_watch_map'] = {};
  store['online_mod_watch_split'] = { 'tmdb_105009': { '1': 24, '2': 13, '3': 13, '4': 13 } };
  watch.splits = null;
  const card4 = { id: 105009, original_name: 'X', original_title: 'X', number_of_seasons: 4, anime: true, seasons: [{ season_number: 1, episode_count: 24 }, { season_number: 2, episode_count: 13 }, { season_number: 3, episode_count: 13 }, { season_number: 4, episode_count: 13 }] };
  assert.strictEqual(watch.splitOf(card4), null);
  assert.deepStrictEqual(watch.counts(card4), { 1: 24, 2: 13, 3: 13, 4: 13 });
}

// known-but-single split falls back to card.seasons
{
  for (const k in store) delete store[k];
  store['online_mod_watch_map'] = {};
  store['online_mod_watch_split'] = { 'tmdb_777': { '1': 63 } };
  watch.splits = null;
  const c = { id: 777, original_name: 'K', original_title: 'K', number_of_seasons: 1, seasons: [{ season_number: 1, episode_count: 10 }] };
  assert.deepStrictEqual(watch.counts(c), { 1: 10 });
}

// end-to-end
{
  for (const k in viewed) delete viewed[k];
  updateCalls = 0;
  watch.installed = false;
  for (const k in store) delete store[k];
  store['online_mod_watch_map'] = {};
  store['online_mod_watch_split'] = { 'tmdb_105009': { '1': 24, '2': 13, '3': 13, '4': 13 } };
  watch.splits = null;
  const card = { id: 105009, original_name: 'X', original_title: 'X', source: 'tmdb', anime: true, number_of_seasons: 1, seasons: [{ season_number: 0, episode_count: 44 }, { season_number: 1, episode_count: 63 }] };
  const items = [];
  for (let i = 1; i <= 13; i++) items.push({ season: '2', episode: String(i) });
  const element = { season: '2', episode: '9' };
  const legacy = Lampa.Utils.hash('29X');
  viewed[legacy] = { percent: 42, time: 595, duration: 1423, updated: 111 };
  const v = watch.view(card, 'alloha', element, legacy, items, 4);
  assert.strictEqual(v.hash, 'h:29X');
  assert.strictEqual(v.card, 'tv_105009');
  assert.strictEqual(viewed['h:29X'].card, 'tv_105009');
  assert.strictEqual(viewed['h:29X'].updated, 111);
}

// alt sources (2b)
{
  const alt = { y: [24, 13, 13, 13] };
  const qq = { src: '', balancer: 'alloha', season: 2, episode: 9, min: 1, max: 13, seasons: 4 };
  const w = (extra) => Object.assign({}, qq, extra);
  // a season counted from 1 inside one TMDB season: YummyAnime's watch order alone does not place it, TMDB's group confirms
  assert.strictEqual(watch.place({}, { 1: 63 }, true, qq, alt), null);
  assert.deepStrictEqual(watch.place({}, { 1: 63 }, true, qq, { y: alt.y, g: [24, 13, 13, 13] }), { season: 1, episode: 33 });
  // Lampa's split has the part's ends: YummyAnime alone is enough
  assert.deepStrictEqual(watch.place({}, { 1: 24, 2: 13, 3: 13, 4: 13 }, true, w({ seasons: 4 }), { y: [24, 13, 13, 13] }), { season: 2, episode: 9 });
  // a prequel listed first that aired last
  assert.strictEqual(watch.place({}, { 1: 24, 2: 13, 3: 12 }, true, { src: '', balancer: 'x', season: 2, episode: 5, min: 1, max: 24, seasons: 3 }, { y: [12, 24, 13] }), null);
  assert.strictEqual(watch.place({}, { 1: 63 }, true, w({ max: 12 }), alt), null);
  assert.strictEqual(watch.place({}, { 1: 63 }, true, w({ seasons: 5 }), alt), null);
  assert.strictEqual(watch.place({}, { 1: 60 }, true, qq, alt), null);
  assert.deepStrictEqual(watch.place({}, { 1: 63 }, true, w({ episode: 33, min: 25, max: 37 }), alt), { season: 1, episode: 33 });
  assert.strictEqual(watch.place({}, { 1: 63 }, true, qq, { y: [24, 13, 13, 13], g: [26, 13, 12, 12] }), null);
  assert.strictEqual(watch.place({}, { 1: 12, 2: 12, 3: 24 }, true, { src: '', balancer: 'x', season: 2, episode: 5, min: 1, max: 12, seasons: 3 }, { y: [24, 12, 12] }), null);
  assert.deepStrictEqual(watch.place({}, { 1: 12, 2: 12 }, true, { src: '', balancer: 'x', season: 2, episode: 5, min: 1, max: 12, seasons: 2 }, { g: [12, 12] }), { season: 2, episode: 5 });
  assert.strictEqual(watch.place({ 'alloha:2': 0 }, { 1: 63 }, true, qq, alt), false);
}

// alt: fetched once per card, kept 12 h, handed to place()
{
  for (const k in viewed) delete viewed[k];
  for (const k in store) delete store[k];
  store['online_mod_watch_split'] = { tmdb_60: { 1: 63 } };
  watch.splits = null; watch.alts = null; watch.cached = undefined;
  const own = [watch.yummy, watch.groups];
  let calls = 0;
  watch.yummy = (c, call) => { calls++; call([24, 13, 13, 13]); };
  watch.groups = (c, call) => { call([24, 13, 13, 13]); call([1]); };
  const card = { id: 60, original_name: 'T', original_title: 'T', source: 'tmdb', anime: true, number_of_seasons: 1, seasons: [{ season_number: 1, episode_count: 63 }] };
  const items = [];
  for (let i = 1; i <= 13; i++) items.push({ season: '2', episode: String(i) });
  assert.strictEqual(watch.view(card, 'alloha', items[0], 'legacy1', items, 4).hash, 'legacy1');
  assert.strictEqual(calls, 1);
  assert.deepStrictEqual(watch.altOf(card).g, [24, 13, 13, 13]);
  const v9 = watch.view(card, 'alloha', items[8], 'legacy9', items, 4);
  assert.strictEqual(v9.hash, 'h:133T');
  assert.strictEqual(v9.episode, 33);
  let done = 0;
  watch.alt(card, () => { done++; });
  assert.strictEqual(calls, 1);
  assert.strictEqual(done, 1);
  watch.yummy = (c, call) => { calls++; call(0); };
  watch.altOf(card).t -= 43200001;
  watch.alt(card);
  assert.strictEqual(calls, 2);
  assert.deepStrictEqual(watch.altOf(card).y, [24, 13, 13, 13]);
  card.kinopoisk_id = 5;
  watch.alt(card);
  watch.alt(card);
  assert.strictEqual(calls, 3);
  assert.strictEqual(watch.altOf(card).k, 5);
  watch.yummy = own[0]; watch.groups = own[1];
}

// alt: TMDB "Seasons" group -> runs of regular episodes
{
  for (const k in store) delete store[k];
  watch.alts = null;
  const run = (s, a, b) => { const o = []; for (let e = a; e <= b; e++) o.push({ season_number: s, episode_number: e }); return o; };
  let detail = { groups: [{ episodes: run(1, 1, 24) }, { episodes: run(1, 38, 50) }, { episodes: run(1, 25, 37) }, { episodes: run(0, 1, 24) }, { episodes: run(1, 51, 63) }] };
  const ownReq = Lampa.Reguest;
  Lampa.TMDB = { api: (p) => p, key: () => 'K' };
  Lampa.Reguest = function () {
    this.timeout = () => {};
    this.silent = (url, ok) => ok(url.indexOf('episode_groups') > 0 ? { results: [{ id: 'g1', type: 6 }, { id: 'g2', type: 5 }] } : detail);
  };
  const ownY = watch.yummy;
  watch.yummy = (c, call) => call(0);
  const card = { id: 105009, original_name: 'X', original_title: 'X', seasons: [{ season_number: 0, episode_count: 44 }, { season_number: 1, episode_count: 63 }] };
  watch.alt(card);
  assert.deepStrictEqual(watch.altOf(card).g, [24, 13, 13, 13]);
  detail = { groups: [{ episodes: run(1, 1, 24).concat(run(1, 30, 31)) }, { episodes: run(1, 25, 29) }] };
  watch.alts = null; delete store['online_mod_watch_alt'];
  watch.alt(card);
  assert.strictEqual(watch.altOf(card).g, 0);
  delete Lampa.TMDB; Lampa.Reguest = ownReq; watch.yummy = ownY;
}

// alt: YummyAnime TV parts by the Kinopoisk id
{
  for (const k in store) delete store[k];
  watch.alts = null;
  const ownGet = animeSkip.get, ownG = watch.groups;
  watch.groups = (c, call) => call(0);
  const eps = { '/anime/a1?need_videos=false': 24, '/anime/a2?need_videos=false': 13, '/anime/3?need_videos=false': 13, '/anime/a4?need_videos=false': 0 };
  animeSkip.get = (path, ok, fail) => {
    if (path === '/anime?limit=1&kp_ids=77') return ok([{ anime_id: 1, anime_url: 'a1' }]);
    if (!(path in eps)) return fail();
    ok({ episodes: { count: eps[path] || 12, aired: eps[path] }, viewing_order: [
      { anime_id: 1, anime_url: 'a1', type: { alias: 'tv' } }, { anime_id: 9, anime_url: 'm', type: { alias: 'movie' } },
      { anime_id: 2, anime_url: 'a2', type: { alias: 'tv' } }, { anime_id: 3, type: { alias: 'tv' } }, { anime_id: 4, anime_url: 'a4', type: { alias: 'tv' } }] });
  };
  const card = { id: 50, original_name: 'A', original_title: 'A', kinopoisk_id: 77, seasons: [{ season_number: 1, episode_count: 50 }] };
  watch.alt(card);
  assert.deepStrictEqual(watch.altOf(card).y, [24, 13, 13]);
  watch.alt({ id: 51, original_name: 'B', original_title: 'B' });
  assert.strictEqual(watch.altOf({ id: 51 }).y, 0);
  animeSkip.get = ownGet; watch.groups = ownG;
}

assert.strictEqual(watch.place({}, { 1: 24, 2: 13 }, true, { src: '', balancer: 'x', season: 3, episode: 5, min: 1, max: 13, seasons: 3 }, { y: [24, 13, 13] }), null);

// alt() is not triggered for a non-anime card with an unproven season
{
  for (const k in viewed) delete viewed[k];
  for (const k in store) delete store[k];
  store['online_mod_watch_map'] = {};
  watch.splits = null; watch.alts = null; watch.cached = undefined; watch.cachedCard = undefined; watch.cachedSeason = undefined; watch.cachedLength = undefined; watch.cachedSplit = undefined; watch.cachedSeasons = undefined; watch.cachedAlt = undefined;
  watch.installed = false;
  let altCalls = 0;
  const ownY = watch.yummy; const ownG = watch.groups;
  watch.yummy = (c, call) => { altCalls++; call(0); };
  watch.groups = (c, call) => { altCalls++; call(0); };
  const card = { id: 77, original_name: 'N', original_title: 'N', source: 'tmdb', seasons: [{ season_number: 1, episode_count: 12 }, { season_number: 2, episode_count: 12 }] };
  const element = { season: '1', episode: '13' };
  const items = [element];
  watch.view(card, 'kodik', element, 'legacyN', items, 2);
  assert.strictEqual(altCalls, 0);
  watch.yummy = ownY; watch.groups = ownG;
}

// rekey: an answer saved after the list was drawn moves the elements and the player items
{
  for (const k in viewed) delete viewed[k];
  for (const k in store) delete store[k];
  const ownY = watch.yummy, ownG = watch.groups;
  watch.yummy = (c, call) => call(0); watch.groups = (c, call) => call(0);
  watch.splits = null; watch.alts = null; watch.cached = undefined; watch.asks = [];
  const card = { id: 70, original_title: 'R', anime: true, seasons: [{ season_number: 1, episode_count: 12 }, { season_number: 2, episode_count: 12 }] };
  const items = [{ season: '2', episode: '1' }, { season: '2', episode: '2' }];
  items.forEach((el) => { el.timeline = watch.view(card, 'alloha', el, 'legacy' + el.episode, items, 2); });
  assert.strictEqual(items[1].watch_pending, true);
  const first = { timeline: items[1].timeline };
  const cell = { timeline: items[0].timeline };
  store['online_mod_watch_map'] = { tmdb_70: { std: 1 } };
  let redrawn = 0;
  watch.refresh = () => { redrawn++; };
  watch.rekey([first, cell, first]);
  assert.strictEqual(first.timeline.hash, 'h:22R');
  assert.strictEqual(cell.timeline.hash, 'h:21R');
  assert.strictEqual(items[1].timeline, first.timeline);
  assert.strictEqual(items[1].watch_pending, false);
  assert.strictEqual(watch.asks.length, 2);
  assert.strictEqual(redrawn, 1);
  watch.refresh = null; watch.yummy = ownY; watch.groups = ownG;
}

// answers: map.parts, the std guard, the sizes an answer stands on, save
{
  for (const k in store) delete store[k];
  watch.alts = null; watch.splits = null; watch.cached = undefined;
  const P = { parts: [24, 13, 13, 13] };
  const qq = { src: '', balancer: 'alloha', season: 2, episode: 9, min: 1, max: 13, seasons: 4 };
  const w = (extra) => Object.assign({}, qq, extra);
  assert.deepStrictEqual(watch.place(P, { 1: 63 }, true, w({ min: 3, max: 9 })), { season: 1, episode: 33 });
  assert.deepStrictEqual(watch.place(P, { 1: 63 }, true, w({ episode: 33, min: 25, max: 37 })), { season: 1, episode: 33 });
  assert.strictEqual(watch.place(P, { 1: 63 }, true, w({ seasons: 3 })), null);
  assert.strictEqual(watch.place(P, { 1: 63 }, true, w({ max: 14 })), null);
  // the last season is still airing: more episodes than the list had
  assert.deepStrictEqual(watch.place(P, { 1: 70 }, true, w({ season: 4, episode: 15, max: 15 })), { season: 1, episode: 65 });
  // 13..24 of a 24-episode season 2: counted from 1 or run on from 12?
  assert.strictEqual(watch.place({ parts: [12, 24, 12] }, { 1: 48 }, true, { src: '', balancer: 'x', season: 2, episode: 13, min: 13, max: 24, seasons: 3 }), null);
  // std answered for TMDB's two seasons does not apply to a balancer with three
  assert.strictEqual(watch.place({ std: 1 }, { 1: 12, 2: 12 }, true, { src: '', balancer: 'rezka2', season: 2, episode: 3, min: 1, max: 12, seasons: 3 }), null);
  assert.strictEqual(watch.stands([24, 13], { 1: 24, 2: 13, 3: 13 }), true);
  assert.strictEqual(watch.stands([24, 13], { 1: 24, 2: 15 }), true);
  assert.strictEqual(watch.stands([24, 13], { 1: 25, 2: 13 }), false);
  assert.strictEqual(watch.stands([63], { 1: 24, 2: 39 }), false);
  const card = { id: 80, original_name: 'O', original_title: 'O', anime: true, number_of_seasons: 1, seasons: [{ season_number: 1, episode_count: 63 }] };
  store['online_mod_watch_split'] = { tmdb_80: { 1: 63 } };
  watch.splits = null;
  store['online_mod_watch_map'] = { tmdb_80: { std: 1, 'alloha:2': 0, t: 1, c: [63] } };
  watch.save(card, { parts: [24, 13, 13, 13], std: null, 'alloha:2': null });
  const saved = store['online_mod_watch_map'].tmdb_80;
  assert.deepStrictEqual(saved.parts, [24, 13, 13, 13]);
  assert.deepStrictEqual(saved.c, [63]);
  assert.ok(saved.t > 1 && !('std' in saved) && !('alloha:2' in saved));
  watch.save(card, null);
  assert.deepStrictEqual(Object.keys(store['online_mod_watch_map'].tmdb_80).sort(), ['c', 't']);
  // TMDB renumbered the seasons after the answer: it is not applied
  store['online_mod_watch_map'] = { tmdb_81: { std: 1, t: 1, c: [12, 12] } };
  const card81 = { id: 81, original_title: 'N', anime: true, number_of_seasons: 2, seasons: [{ season_number: 1, episode_count: 12 }, { season_number: 2, episode_count: 12 }] };
  const ownY = watch.yummy, ownG = watch.groups;
  watch.yummy = (c, call) => call(0); watch.groups = (c, call) => call(0);
  const el = { season: '2', episode: '3' };
  assert.strictEqual(watch.hashOf(card81, 'x', el, [el], 2), 'h:23N');
  card81.seasons[0].episode_count = 13;
  const el2 = { season: '2', episode: '3' };
  assert.strictEqual(watch.hashOf(card81, 'x', el2, [el2], 2), '');
  watch.yummy = ownY; watch.groups = ownG;
}

// the match menu
{
  for (const k in store) delete store[k];
  watch.alts = null; watch.splits = null; watch.cached = undefined;
  const ownLang = Lampa.Lang;
  Lampa.Lang = { translate: (k) => k };
  const card = { id: 80, original_name: 'O', original_title: 'O', anime: true, seasons: [{ season_number: 1, episode_count: 63 }] };
  store['online_mod_watch_alt'] = { tmdb_80: { t: Date.now(), k: 0, y: [24, 13, 13, 13], g: [24, 13, 13, 13] } };
  const a = { card: card, element: { watch_q: { src: '', balancer: 'alloha', season: 2, episode: 9, min: 1, max: 12, seasons: 4 } } };
  const opts = watch.options(a);
  // both sources say the same: one row; TMDB has no season 2: no "as in Lampa" row
  assert.strictEqual(opts.length, 3);
  assert.strictEqual(opts[0].title, 'online_mod_season 1, online_mod_episode 33');
  assert.strictEqual(opts[0].subtitle, 'online_mod_watch_by YummyAnime + TMDB: 24 / 13 / 13 / 13');
  assert.deepStrictEqual(opts[0].patch, { parts: [24, 13, 13, 13], std: null, 'alloha:2': null });
  assert.strictEqual(opts[1].manual, 'alloha:2');
  assert.deepStrictEqual(opts[2].patch, { 'alloha:2': 0 });
  // what the first row saves places the episode
  watch.save(card, opts[0].patch);
  assert.deepStrictEqual(watch.place(watch.map(card), watch.counts(card), true, a.element.watch_q), { season: 1, episode: 33 });
  // TMDB has the season and as many seasons as the balancer: std for the title plus this season's anchor
  const card2 = { id: 82, original_title: 'P', anime: true, seasons: [{ season_number: 1, episode_count: 12 }, { season_number: 2, episode_count: 12 }] };
  const same = watch.options({ card: card2, element: { watch_q: { src: '', balancer: 'x', season: 2, episode: 3, min: 1, max: 12, seasons: 2 } } })[0];
  assert.deepStrictEqual(same.patch, { std: 1, parts: null, 'x:2': [1, 2, 1] });
  // Kodik: its season is its own part number, so no "as in Lampa" row; its own key for the manual pick
  const kodik = watch.options({ card: card2, element: { watch_q: { src: 'shiki:7', balancer: 'kodik', season: 2, episode: 3, min: 1, max: 12 } } });
  assert.strictEqual(kodik[0].manual, 'shiki:7');
  assert.deepStrictEqual(kodik[1].patch, { 'shiki:7': 0 });
  Lampa.Lang = ownLang;
}

// answers on the server: the newest answer of a title wins, the rest is united
{
  for (const k in store) delete store[k];
  const mine = { a: { std: 1, t: 5 }, b: { t: 9 }, d: { std: 1 } };
  const theirs = { a: { parts: [12, 12], t: 7 }, b: { std: 1, t: 3 }, c: { std: 1, t: 1 }, junk: 5 };
  assert.deepStrictEqual(watch.merge(mine, theirs), { a: theirs.a, b: mine.b, c: theirs.c, d: mine.d });
  assert.deepStrictEqual(watch.merge(mine, null), mine);
  assert.strictEqual(watch.server(), '');
  store['online_mod_lampac_server'] = ' 192.168.1.50:9118/ ';
  assert.strictEqual(watch.server(), 'http://192.168.1.50:9118');
  delete store['online_mod_lampac_server'];
  // no server: nothing is requested, the caller goes on
  let went = 0;
  watch.sync(() => { went++; });
  assert.strictEqual(went, 1);
}

// dialog: a manual pick writes an anchor for this balancer season; Back writes nothing
{
  for (const k in store) delete store[k];
  watch.alts = null; watch.splits = null; watch.cached = undefined;
  const own = { Lang: Lampa.Lang, Controller: Lampa.Controller, Select: Lampa.Select };
  Lampa.Lang = { translate: (k) => k };
  const shown = [];
  Lampa.Controller = { enabled: () => ({ name: 'content' }), toggle: () => {} };
  Lampa.Select = { show: (p) => { shown.push(p); } };
  const card = { id: 91, original_title: 'D', anime: true, seasons: [{ season_number: 1, episode_count: 24 }, { season_number: 2, episode_count: 12 }] };
  const a = { card: card, element: { watch_q: { src: '', balancer: 'alloha', season: 2, episode: 3, min: 1, max: 12, seasons: 3 } } };
  let done = 0;
  watch.dialog(a, 'content', () => { done++; });
  shown[0].onBack();
  assert.strictEqual(done, 0);
  assert.strictEqual(store['online_mod_watch_map'], undefined);
  shown[0].onSelect(shown[0].items.filter((o) => o.manual)[0]);
  shown[1].onSelect(shown[1].items[0]);
  shown[2].onSelect(shown[2].items[14]);
  assert.strictEqual(done, 1);
  assert.deepStrictEqual(store['online_mod_watch_map'].tmdb_91['alloha:2'], [3, 1, 15]);
  assert.deepStrictEqual(watch.place(watch.map(card), watch.counts(card), true, a.element.watch_q), { season: 1, episode: 15 });
  Object.assign(Lampa, own);
}

// ask before playback: asked once, the answer re-keys first and the playlist
{
  for (const k in viewed) delete viewed[k];
  for (const k in store) delete store[k];
  watch.splits = null; watch.alts = null; watch.cached = undefined; watch.asks = [];
  const own = { Lang: Lampa.Lang, Controller: Lampa.Controller, Select: Lampa.Select, Loading: Lampa.Loading };
  Lampa.Lang = { translate: (k) => k };
  let shown = null;
  Lampa.Loading = { start: () => {}, stop: () => {} };
  Lampa.Controller = { enabled: () => ({ name: 'loading' }), toggle: (n) => { assert.strictEqual(n, 'content'); } };
  Lampa.Select = { show: (p) => { shown = p; } };
  const timer = globalThis.setTimeout;
  globalThis.setTimeout = () => 0;
  const card = { id: 90, original_title: 'Q', anime: true, seasons: [{ season_number: 1, episode_count: 12 }, { season_number: 2, episode_count: 12 }] };
  const items = [{ season: '2', episode: '1' }, { season: '2', episode: '2' }];
  items.forEach((el) => { el.timeline = watch.view(card, 'alloha', el, 'old' + el.episode, items, 2); });
  const first = { timeline: items[0].timeline };
  const playlist = [first, { timeline: items[1].timeline }];
  let played = 0;
  watch.ask(first, playlist, () => { played++; });
  assert.strictEqual(played, 0);
  shown.onSelect(shown.items.filter((o) => o.patch && o.patch.std === 1)[0]);
  assert.strictEqual(played, 1);
  assert.strictEqual(first.timeline.hash, 'h:21Q');
  assert.strictEqual(first.timeline.episode, 1);
  assert.strictEqual(playlist[1].timeline.hash, 'h:22Q');
  assert.strictEqual(store['online_mod_watch_map'].tmdb_90.std, 1);
  // answered: the next start does not ask; a movie item has no element
  shown = null;
  watch.ask({ timeline: items[1].timeline }, [], () => { played++; });
  watch.ask({}, null, () => { played++; });
  assert.strictEqual(played, 3);
  assert.strictEqual(shown, null);
  globalThis.setTimeout = timer;
  Object.assign(Lampa, own);
}

// Kodik: merged parts keep answers per part and get no "as in Lampa" row; its own seasons are not asked before playback
{
  for (const k in viewed) delete viewed[k];
  for (const k in store) delete store[k];
  watch.splits = null; watch.alts = null; watch.cached = undefined; watch.asks = [];
  const own = { Lang: Lampa.Lang, Select: Lampa.Select, Loading: Lampa.Loading, Controller: Lampa.Controller };
  Lampa.Lang = { translate: (k) => k };
  const card = { id: 95, original_title: 'K', anime: true, number_of_seasons: 1, seasons: [{ season_number: 1, episode_count: 63 }] };
  store['online_mod_watch_split'] = { tmdb_95: { 1: 63 } };
  watch.splits = null;
  const part = { index: 2, bounds: [0, 24, 37, 50], first: 1 };
  const opts = watch.options({ card: card, element: { watch_q: { src: 'shiki:7', part: part, balancer: 'kodik', season: 3, episode: 2, min: 1, max: 13 } } });
  assert.ok(opts.every((o) => !o.patch || !('std' in o.patch)));
  assert.strictEqual(opts.filter((o) => o.patch && Array.isArray(o.patch['shiki:7:3'])).length, 0);
  assert.strictEqual(opts[0].manual, 'shiki:7:3');
  assert.deepStrictEqual(watch.place({ 'shiki:7:3': [1, 1, 25] }, { 1: 63 }, true, { src: 'shiki:7', part: part, balancer: 'kodik', season: 3, episode: 2, min: 1, max: 13 }), { season: 1, episode: 26 });
  // a Kodik entry of its own (no part): pending, but not asked
  let shown = 0;
  Lampa.Select = { show: () => { shown++; } };
  Lampa.Loading = { start: () => {}, stop: () => {} };
  Lampa.Controller = { enabled: () => ({ name: 'content' }), toggle: () => {} };
  const el = { season: '1', episode: '3', watch_info: { src: 'shiki:7' } };
  el.timeline = watch.view(card, 'kodik', el, 'k3', [el], 1);
  assert.strictEqual(el.watch_pending, true);
  let played = 0;
  watch.ask({ timeline: el.timeline }, [], () => { played++; });
  assert.strictEqual(played, 1);
  assert.strictEqual(shown, 0);
  Object.assign(Lampa, own);
}

// ask: Back during the wait plays nothing; the late timer does nothing either
{
  for (const k in viewed) delete viewed[k];
  for (const k in store) delete store[k];
  watch.splits = null; watch.alts = null; watch.cached = undefined; watch.asks = [];
  const own = { Lang: Lampa.Lang, Select: Lampa.Select, Loading: Lampa.Loading, Controller: Lampa.Controller, Reguest: Lampa.Reguest };
  Lampa.Lang = { translate: (k) => k };
  let cancel = null, shown = 0, timerFn = null;
  Lampa.Loading = { start: (cb) => { cancel = cb; }, stop: () => {} };
  Lampa.Controller = { enabled: () => ({ name: 'content' }), toggle: () => {} };
  Lampa.Select = { show: () => { shown++; } };
  // the server never answers
  Lampa.Reguest = function () { this.timeout = () => {}; this.silent = () => {}; };
  store['online_mod_lampac_server'] = 'http://x';
  watch.uid = 'u';
  const timer = globalThis.setTimeout;
  globalThis.setTimeout = (fn) => { timerFn = fn; return 0; };
  const card = { id: 96, original_title: 'W', anime: true, number_of_seasons: 2, seasons: [{ season_number: 1, episode_count: 12 }, { season_number: 2, episode_count: 12 }] };
  const items = [{ season: '2', episode: '1' }];
  items[0].timeline = watch.view(card, 'alloha', items[0], 'w1', items, 3);
  let played = 0;
  watch.ask({ timeline: items[0].timeline }, [], () => { played++; });
  cancel();
  timerFn();
  assert.strictEqual(played, 0);
  assert.strictEqual(shown, 0);
  globalThis.setTimeout = timer;
  watch.uid = '';
  Object.assign(Lampa, own);
}

// sync: the server's answers are merged in; a POST only when the server lacks something
{
  for (const k in store) delete store[k];
  const own = { Reguest: Lampa.Reguest };
  const posts = [];
  const ownDollar = globalThis.$;
  globalThis.$ = { ajax: (o) => posts.push(o) };
  let reply = { success: true, data: JSON.stringify({ tmdb_1: { std: 1, t: 5 } }) };
  Lampa.Reguest = function () { this.timeout = () => {}; this.silent = (url, ok) => ok(reply); };
  store['online_mod_lampac_server'] = 'http://x';
  watch.uid = 'u';
  let done = 0;
  watch.sync(() => { done++; });
  assert.strictEqual(done, 1);
  assert.deepStrictEqual(store['online_mod_watch_map'], { tmdb_1: { std: 1, t: 5 } });
  assert.strictEqual(posts.length, 0);
  store['online_mod_watch_map'] = { tmdb_1: { std: 1, t: 5 }, tmdb_2: { std: 1, t: 9 } };
  watch.sync();
  assert.strictEqual(posts.length, 1);
  assert.ok(posts[0].url.indexOf('/storage/set?path=onlinemod&pathfile=watchmap&uid=u') > 0);
  assert.deepStrictEqual(JSON.parse(posts[0].data), store['online_mod_watch_map']);
  // a server that hands out no identity: the TimeCode plugin's own id, and timecode.js is fetched once
  watch.uid = '';
  let fetched = 0;
  Lampa.Reguest = function () { this.timeout = () => {}; this.silent = (url, ok) => { if (/timecode\.js/.test(url)) { fetched++; ok("var server_uid = '';"); } else ok(reply); }; };
  store['lampac_unic_id'] = 'abc';
  watch.sync();
  assert.strictEqual(watch.uid, 'abc');
  delete store['lampac_unic_id'];
  watch.uid = '';
  watch.sync(); watch.sync();
  assert.strictEqual(fetched, 2);
  watch.uid = '';
  delete store['online_mod_lampac_server'];
  globalThis.$ = ownDollar;
  Object.assign(Lampa, own);
}

// Kodik entries placed by YummyAnime: the TV part with the entry's shikimori id
{
  const alt = { y: [24, 13, 13, 13], ys: ['100', '200', '300', '400'] };
  const k = (extra) => Object.assign({ src: 'shiki:200', balancer: 'kodik', season: 1, episode: 5, min: 1, max: 13, seasons: 1 }, extra);
  // Lampa's split of a single TMDB season
  assert.deepStrictEqual(watch.place({}, { 1: 24, 2: 13, 3: 13, 4: 13 }, true, k(), alt), { season: 2, episode: 5 });
  // a single TMDB season Lampa does not split: the part's place inside it needs TMDB's "Seasons" group to confirm the order
  assert.strictEqual(watch.place({}, { 1: 63 }, true, k(), alt), null);
  assert.deepStrictEqual(watch.place({}, { 1: 63 }, true, k(), { y: alt.y, ys: alt.ys, g: [24, 13, 13, 13] }), { season: 1, episode: 29 });
  // a Kodik entry with a season of its own other than 1
  assert.strictEqual(watch.place({}, { 1: 24, 2: 13, 3: 13, 4: 13 }, true, k({ season: 2 }), alt), null);
  // YummyAnime's watch order puts a prequel first that aired last: its parts do not meet TMDB's season ends
  assert.strictEqual(watch.place({}, { 1: 24, 2: 13, 3: 12 }, true, k({ src: 'shiki:2', max: 24 }), { y: [12, 24, 13], ys: ['1', '2', '3'] }), null);
  // the entry lists other episodes than its part
  assert.strictEqual(watch.place({}, { 1: 63 }, true, k({ max: 12 }), alt), null);
  // an entry YummyAnime does not list as a TV part
  assert.strictEqual(watch.place({}, { 1: 63 }, true, k({ src: 'shiki:999' }), alt), null);
  // TMDB's "Seasons" group counts other parts
  assert.strictEqual(watch.place({}, { 1: 63 }, true, k(), { y: alt.y, ys: alt.ys, g: [24, 26, 13] }), null);
  // a saved answer still wins
  assert.strictEqual(watch.place({ 'shiki:200': 0 }, { 1: 63 }, true, k(), alt), false);
  // the YummyAnime fetch keeps the parts' shikimori ids
  for (const s in store) delete store[s];
  watch.alts = null;
  const ownGet = animeSkip.get, ownG = watch.groups;
  watch.groups = (c, call) => call(0);
  const eps = { '/anime/p1?need_videos=false': [24, 100], '/anime/p2?need_videos=false': [13, 200] };
  animeSkip.get = (path, ok, fail) => {
    if (path === '/anime?limit=1&kp_ids=88') return ok([{ anime_id: 1, anime_url: 'p1' }]);
    if (!(path in eps)) return fail();
    ok({ episodes: { count: eps[path][0], aired: eps[path][0] }, remote_ids: { shikimori_id: eps[path][1] }, viewing_order: [
      { anime_id: 1, anime_url: 'p1', type: { alias: 'tv' } }, { anime_id: 2, anime_url: 'p2', type: { alias: 'tv' } }] });
  };
  const card = { id: 97, original_name: 'S', original_title: 'S', kinopoisk_id: 88, seasons: [{ season_number: 1, episode_count: 37 }] };
  watch.alt(card);
  assert.deepStrictEqual(watch.altOf(card).y, [24, 13]);
  assert.deepStrictEqual(watch.altOf(card).ys, ['100', '200']);
  animeSkip.get = ownGet; watch.groups = ownG;
}

// "По сериям": seasons and episodes as Lampa numbers them, each with its progress; the pinned row and season
{
  for (const k in viewed) delete viewed[k];
  for (const k in store) delete store[k];
  watch.splits = null; watch.cached = undefined;
  const ownLang = Lampa.Lang;
  Lampa.Lang = { translate: (k) => k };
  const card = { id: 105009, original_name: 'T', original_title: 'T', number_of_seasons: 1, seasons: [{ season_number: 0, episode_count: 44 }, { season_number: 1, episode_count: 63 }] };
  store['online_mod_watch_split'] = { tmdb_105009: { 1: 24, 2: 13, 3: 13, 4: 13 } };
  watch.splits = null;
  const seasons = watch.seasonItems(card);
  assert.deepStrictEqual(seasons.map((s) => s.season), [1, 2, 3, 4]);
  assert.strictEqual(seasons[1].title, 'online_mod_season 2');
  assert.strictEqual(seasons[1].subtitle, '13online_mod_episodes_short');
  viewed['h:29T'] = { percent: 42, time: 595, duration: 1423 };
  const eps = watch.episodeItems(card, 2);
  assert.strictEqual(eps.length, 13);
  assert.strictEqual(eps[8].title, 'online_mod_season 2, online_mod_episode 9');
  assert.strictEqual(eps[8].subtitle, '42%');
  assert.strictEqual(eps[0].subtitle, '');
  assert.deepStrictEqual([eps[8].season, eps[8].episode], [2, 9]);
  const rows = [{ item: 'a', element: { watch_place: { season: 2, episode: 8 } } }, { item: 'b', element: {} }, { item: 'c', element: { watch_place: { season: 2, episode: 9 } } }];
  assert.strictEqual(watch.pinRow({ season: 2, episode: 9 }, rows), 'c');
  assert.strictEqual(watch.pinRow({ season: 3, episode: 1 }, rows), null);
  // an episode whose place is not proven is found by its own numbers; a proven one wins
  assert.strictEqual(watch.pinRow({ season: 3, episode: 1 }, rows.concat([{ item: 'd', element: { season: '3', episode: '1' } }])), 'd');
  assert.strictEqual(watch.pinRow({ season: 2, episode: 9 }, [{ item: 'e', element: { season: '2', episode: '9' } }].concat(rows)), 'c');
  assert.strictEqual(watch.pinSeason({ season: 2, episode: 9 }, ['Сезон 1', 'Сезон 2']), 1);
  assert.strictEqual(watch.pinSeason({ season: 5, episode: 1 }, ['Сезон 1', 'Сезон 2']), -1);
  assert.strictEqual(watch.pinSeason({ season: 2, episode: 1 }, null), -1);
  // per voice the proven row wins; a voice without the episode gives no row
  const vrows = [
    { season: 0, voice: 'A', element: { season: '1', episode: 9 } },
    { season: 1, voice: 'A', element: { season: '2', episode: 9, watch_place: { season: 2, episode: 9 } } },
    { season: 1, voice: 'B', element: { season: '2', episode: 9 } },
    { season: 1, voice: 'C', element: { season: '2', episode: 3, watch_place: { season: 2, episode: 3 } } }
  ];
  const picked = watch.pinVariants({ season: 2, episode: 9 }, vrows);
  assert.deepStrictEqual(picked.map((r) => [r.voice, r.season]), [['A', 1], ['B', 1]]);
  assert.deepStrictEqual(watch.pinVariants({ season: 2, episode: 9 }, null), []);
  Lampa.Lang = ownLang;
}

// a forced prefetch on a fresh start (the card page opened first): the cache is loaded before the callback writes
{
  for (const k in store) delete store[k];
  watch.splits = null;
  const ownApi = Lampa.Api, ownSplit = Lampa.Utils.splitEpisodesIntoSeasons;
  Lampa.Api = { seasons: (c, list, cb) => cb({ 1: { episodes_original: new Array(37).fill({}) } }) };
  Lampa.Utils.splitEpisodesIntoSeasons = (eps) => ({ 1: eps.slice(0, 24), 2: eps.slice(24) });
  const card = { id: 98, original_name: 'F', original_title: 'F', number_of_seasons: 1, seasons: [{ season_number: 1, episode_count: 37 }] };
  watch.prefetch(card, true);
  assert.deepStrictEqual(watch.splitOf(card), { 1: 24, 2: 13 });
  Lampa.Api = ownApi; Lampa.Utils.splitEpisodesIntoSeasons = ownSplit;
}

// a corrupted cache in localStorage is started over, not written into
{
  for (const k in store) delete store[k];
  store['online_mod_watch_split'] = 'garbage';
  store['online_mod_watch_alt'] = 'garbage';
  watch.splits = null; watch.alts = null;
  assert.strictEqual(watch.splitOf({ id: 1, original_title: 'Z', number_of_seasons: 1, seasons: [{ season_number: 1, episode_count: 5 }] }), null);
  assert.deepStrictEqual(watch.splits, {});
  assert.strictEqual(watch.altOf({ id: 1 }), null);
  assert.deepStrictEqual(watch.alts, {});
}

// plugin URL parameters (ultra?lampac=…&alloha=…), also when Lampa appends its own query after them
{
  const src = 'https://edembey.github.io/lampa-torbox/ultra?lampac=192.168.1.50:9118&alloha=x.trycloudflare.com?email=a&logged=true';
  assert.strictEqual(watch.param(src, 'lampac'), '192.168.1.50:9118');
  assert.strictEqual(watch.param(src, 'alloha'), 'x.trycloudflare.com');
  assert.strictEqual(watch.param('https://h/ultra?email=a&lampac=http%3A%2F%2F10.0.0.2%3A9118', 'lampac'), 'http://10.0.0.2:9118');
  assert.strictEqual(watch.param('https://h/ultra?email=a', 'lampac'), '');
  assert.strictEqual(watch.param('', 'lampac'), '');
}

// the menu offers the reset only for a title that has answers
{
  for (const k in store) delete store[k];
  store['online_mod_watch_map'] = { tmdb_92: { t: 1, c: [12] }, tmdb_93: { std: 1, t: 1 } };
  assert.strictEqual(watch.answered({ id: 92 }), false);
  assert.strictEqual(watch.answered({ id: 93 }), true);
  assert.strictEqual(watch.answered({ id: 94 }), false);
}

console.log('watch-map OK');
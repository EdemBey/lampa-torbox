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
    get: (k, d) => (k === 'fv' ? viewed : (store[k] !== undefined ? store[k] : d)),
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

const animeSkip = { isAnime: (card) => !!card.anime };
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
  assert.strictEqual(src.split('component.watchView(element, hash, items)').length - 1, 17);
  assert.strictEqual(src.split('var view = Lampa.Timeline.view(hash);').length - 1, 6);
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

console.log('watch-map OK');
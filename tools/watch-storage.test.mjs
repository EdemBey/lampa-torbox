// What watch keeps in Lampa's storage, written out literally: users' answers, marks and «Продолжить» records live
// under these keys in these shapes, and Lampa's timeline under watch.key(). A refactor must not change any of it.
import assert from 'node:assert';
import { read, slice } from './_slice.mjs';
import { makeWatch } from './_watch.mjs';

const code = slice(read('online_mod.js'), 'watch');
const card = { id: 101, original_title: 'Anime', original_name: 'Anime', anime: true, seasons: [{ season_number: 1, episode_count: 12 }, { season_number: 2, episode_count: 13 }], number_of_seasons: 2 };
// t is the moment of writing: checked to be one, then left out of the comparison
const stamped = (entry) => {
  assert.ok(Math.abs(Date.now() - entry.t) < 5000, 't is a timestamp');
  const { t, ...rest } = entry;
  return rest;
};
// a Lampa.Reguest that answers from a table of [url part, answer]; no match fails the request
const net = (m, table) => {
  const asked = [];
  m.Lampa.TMDB = { api: (p) => 'tmdb/' + p, key: () => 'k' };
  m.Lampa.Reguest = function () {
    this.timeout = () => {};
    this['native'] = () => {};
    this.silent = (url, ok, fail) => {
      asked.push(url);
      const hit = table.filter((r) => url.indexOf(r[0]) >= 0)[0];
      if (hit) ok(hit[1]); else fail();
    };
  };
  return asked;
};

// Lampa's timeline key: season, ':' after season 10, episode, original title
{
  const { watch } = makeWatch(code);
  assert.strictEqual(watch.key(card, 2, 5), '25Anime');
  assert.strictEqual(watch.key(card, 10, 5), '105Anime');
  assert.strictEqual(watch.key(card, 11, 5), '11:5Anime');
  assert.strictEqual(watch.key(card, 22, 1112), '22:1112Anime');
  assert.strictEqual(watch.id(card), 'tmdb_101');
  assert.strictEqual(watch.id({ id: 7, source: 'cub' }), 'tmdb_7');
  assert.strictEqual(watch.id({ id: 7, source: 'yani' }), 'yani_7');
}

// online_mod_watch_map: answers of the match menu, with the season sizes they were given for
{
  const m = makeWatch(code);
  m.watch.save(card, { 'alloha:2': [1, 2, 1], std: 1 });
  m.watch.save(card, { 'shiki:5:3': 0, parts: [12, 13], std: null });
  assert.deepStrictEqual(Object.keys(m.store.online_mod_watch_map), ['tmdb_101']);
  assert.deepStrictEqual(stamped(m.store.online_mod_watch_map.tmdb_101), { 'alloha:2': [1, 2, 1], 'shiki:5:3': 0, parts: [12, 13], c: [12, 13] });
  m.watch.save(card, null);
  assert.deepStrictEqual(stamped(m.store.online_mod_watch_map.tmdb_101), { c: [12, 13] });
}

// online_mod_resume: the last played episode; the place only when it was proven
{
  const m = makeWatch(code);
  m.watch.remember(card, 'alloha', 'Voice', 1, { season: 2, episode: 3, watch_place: { season: 2, episode: 3 } });
  assert.deepStrictEqual(stamped(m.store.online_mod_resume.tmdb_101), { b: 'alloha', v: 'Voice', s: 1, p: { season: 2, episode: 3 } });
  m.watch.remember({ id: 102, original_title: 'B' }, 'kodik', '', 0, { season: 1, episode: 1, watch_place: null });
  assert.deepStrictEqual(stamped(m.store.online_mod_resume.tmdb_102), { b: 'kodik', v: '', s: 0 });
}

// online_mod_watch_arm: an answer, no TMDB mapping, a failed request
{
  const m = makeWatch(code);
  const asked = net(m, [['id=5', { themoviedb: 101, 'themoviedb-season': 2 }], ['id=6', { themoviedb: null }]]);
  m.watch.arm(card, [{ shiki: '5' }, { shiki: '6' }, { shiki: '7' }]);
  assert.deepStrictEqual(asked, ['5', '6', '7'].map((id) => 'https://arm.haglund.dev/api/v2/ids?source=myanimelist&id=' + id));
  const arm = m.store.online_mod_watch_arm;
  assert.deepStrictEqual(Object.keys(arm), ['m5', 'm6', 'm7']);
  assert.deepStrictEqual(stamped(arm.m5), { d: 101, s: 2 });
  assert.deepStrictEqual(stamped(arm.m6), { e: 1, u: 1, d: 0, s: 0 });
  assert.deepStrictEqual(stamped(arm.m7), { e: 1, d: 0, s: 0 });
}
// read back: an answer lives 7 days, a failure 10 minutes
{
  const t = Date.now();
  const m = makeWatch(code, { online_mod_watch_arm: { m1: { t: t - 6 * 86400000, d: 1, s: 1 }, m2: { t: t - 8 * 86400000, d: 1, s: 1 }, m3: { t: t - 5 * 60000, e: 1, d: 0, s: 0 }, m4: { t: t - 11 * 60000, e: 1, d: 0, s: 0 } } });
  assert.deepStrictEqual(['1', '2', '3', '4'].map((mal) => !!m.watch.armOf(mal)), [true, false, true, false]);
}

// online_mod_watch_alt: the other sources' season lists of a card
{
  const m = makeWatch(code);
  const eps = [];
  for (let e = 1; e <= 12; e++) eps.push({ season_number: 1, episode_number: e, order: eps.length });
  for (let e = 1; e <= 13; e++) eps.push({ season_number: 2, episode_number: e, order: eps.length });
  const asked = net(m, [['/episode_groups', { results: [{ id: 'abs', type: 2, episode_count: 25 }] }], ['episode_group/abs', { groups: [{ episodes: eps }] }]]);
  m.watch.alt(card);
  assert.deepStrictEqual(asked, ['tmdb/tv/101/episode_groups?api_key=k', 'tmdb/tv/episode_group/abs?api_key=k']);
  assert.deepStrictEqual(stamped(m.store.online_mod_watch_alt.tmdb_101), { k: 0, ys: 0, y: 0, g: 0, a: [[1, 1, 1, 12], [13, 2, 1, 13]] });
  // kept 12 h: not asked again
  m.watch.alt(card);
  assert.strictEqual(asked.length, 2);
}
// an entry written before the Absolute runs existed (no `a`) is fetched again; what a failed refetch lacks is kept
{
  const m = makeWatch(code, { online_mod_watch_alt: { tmdb_101: { t: Date.now(), k: 0, y: [12, 13], ys: ['5', '6'], g: [12, 13] } } });
  const asked = net(m, []);
  m.watch.alt(card);
  assert.strictEqual(asked.length, 1);
  assert.deepStrictEqual(stamped(m.store.online_mod_watch_alt.tmdb_101), { k: 0, ys: ['5', '6'], y: [12, 13], g: [12, 13], a: 0 });
}

// online_mod_watch_split: the sizes of Lampa's own split of a single TMDB season
{
  const one = { id: 80, original_title: 'Split', original_name: 'Split', seasons: [{ season_number: 1, episode_count: 37 }], number_of_seasons: 1 };
  const m = makeWatch(code);
  m.Lampa.Api.seasons = (c, list, cb) => cb({ 1: { episodes: new Array(37).fill({}) } });
  m.Lampa.Utils.splitEpisodesIntoSeasons = (list) => ({ 1: list.slice(0, 24), 2: list.slice(24) });
  m.watch.prefetch(one);
  assert.deepStrictEqual(m.store.online_mod_watch_split, { tmdb_80: { 1: 24, 2: 13 } });
  assert.deepStrictEqual(m.watch.splitOf(one), { 1: 24, 2: 13 });
  assert.deepStrictEqual(m.watch.counts(one), { 1: 24, 2: 13 });
}

// a «Продолжить» record of an older version counts the season's episodes from 1: read as TMDB numbers them
{
  const op = { id: 37854, original_title: 'One Piece', original_name: 'One Piece', seasons: [{ season_number: 1, episode_count: 61 }, { season_number: 2, episode_count: 16 }], number_of_seasons: 2 };
  const m = makeWatch(code, { online_mod_watch_alt: { tmdb_37854: { t: Date.now(), k: 0, y: 0, ys: 0, g: 0, a: [[1, 1, 1, 61], [62, 2, 62, 16]] } } });
  const rec = { b: 'alloha', v: 'V', s: 0, t: 5, p: { season: 2, episode: 5 } };
  assert.deepStrictEqual(m.watch.recOf(op, rec), { b: 'alloha', v: 'V', s: 0, t: 5, p: { season: 2, episode: 66 } });
  assert.deepStrictEqual(m.watch.recOf(op, Object.assign({}, rec, { p: { season: 2, episode: 66 } })).p, { season: 2, episode: 66 });
  assert.deepStrictEqual(m.watch.recOf(op, Object.assign({}, rec, { p: { season: '1', episode: '7' } })).p, { season: 1, episode: 7 });
  // the stored record itself is not rewritten
  assert.deepStrictEqual(rec.p, { season: 2, episode: 5 });
}
console.log('watch-storage OK');

import assert from 'node:assert';
import { read, slice } from './_slice.mjs';

const src = read('seasons.js');
const gFrom = src.indexOf('    function getSeasonProgress(');
const gTo = src.indexOf('    function createBadge(');
assert(gFrom > 0 && gTo > gFrom, 'getSeasonProgress not found in plugin/seasons.js');
const m = new Function(slice(src, 'seasons-cache') + '\nreturn {compactSeason, seasonOf, pruneSeasonCache};')();
const progress = (win) => new Function('window', src.slice(gFrom, gTo) + '\nreturn getSeasonProgress;')(win);

// Lampa.Utils.countSeasons (lampa.mx app.js), what online_mod_watch.splitOf asks of a card
const countSeasons = (movie) => {
  const seasons = movie.seasons || [];
  let count = 0;
  for (let i = 0; i < seasons.length; i++) if (seasons[i].episode_count > 0) count++;
  if (count > movie.number_of_seasons) count = movie.number_of_seasons;
  return count;
};
const fakeWatch = (stored) => ({
  splitOf: (card) => countSeasons(card) === 1 && stored['tmdb_' + card.id] || null,
  lampaOf(card, season, number) {
    const split = this.splitOf(card);
    if (!split || Object.keys(split).length < 2 || season != 1) return { season, episode: number };
    const last = Object.keys(split).length;
    let n = number, s;
    for (s = 1; s < last && n > (split[s] || 0); s++) n -= split[s] || 0;
    return { season: s, episode: n };
  }
});

const junk = { backdrop_path: '/x.jpg', overview: 'o'.repeat(600), genres: [{ id: 1, name: 'Drama' }], networks: [{ id: 2, name: 'N', logo_path: '/l.png' }], status: 'Returning Series', vote_average: 8.1 };
const ep = (s, e) => ({ id: 9, name: 'E', season_number: s, episode_number: e, overview: 'x'.repeat(300), air_date: '2026-01-01' });
const sn = (n, c) => ({ id: n * 11, season_number: n, episode_count: c, name: 'S' + n, overview: 'y'.repeat(200), air_date: '2020-01-01', poster_path: '/p.jpg' });
const shows = {
  running: { ...junk, id: 1, number_of_seasons: 3, seasons: [sn(0, 4), sn(1, 10), sn(2, 10), sn(3, 12)], last_episode_to_air: ep(3, 5), next_episode_to_air: ep(3, 6) },
  ended: { ...junk, id: 2, status: 'Ended', number_of_seasons: 2, seasons: [sn(1, 8), sn(2, 8)], last_episode_to_air: ep(2, 8), next_episode_to_air: null },
  single: { ...junk, id: 117465, number_of_seasons: 1, seasons: [sn(1, 25)], last_episode_to_air: ep(1, 20) },
  noDates: { ...junk, id: 4, number_of_seasons: 1, seasons: [sn(1, 0)], last_episode_to_air: null },
  future: { ...junk, id: 5, number_of_seasons: 3, seasons: [sn(1, 10), sn(2, 10), sn(3, 0)], last_episode_to_air: ep(2, 10) },
  specialsOnly: { ...junk, id: 6, number_of_seasons: 1, seasons: [sn(0, 3)], last_episode_to_air: ep(0, 1) },
  noCount: { ...junk, id: 7, seasons: [sn(1, 6), sn(2, 6)], last_episode_to_air: ep(1, 6) }
};

// 1. the badge from a record is the badge from the full answer, with and without a Lampa split
const watches = [{}, { online_mod_watch: fakeWatch({ tmdb_117465: { 1: 13, 2: 12 }, tmdb_1: { 1: 6, 2: 6 } }) }];
for (const name in shows) {
  const full = shows[name];
  const rec = m.compactSeason(full);
  assert(JSON.stringify(rec).length <= 100, name + ' record is ' + JSON.stringify(rec).length + ' bytes');
  for (const w of watches) assert.deepStrictEqual(progress(w)(m.seasonOf(rec)), progress(w)(full), name);
  const back = m.seasonOf(rec);
  if (!rec.x) assert.strictEqual(countSeasons(back), countSeasons(full), name + ' countSeasons');
}
assert.deepStrictEqual(progress({})(m.seasonOf(m.compactSeason(shows.running))), { seasonNumber: 3, airedEpisodes: 5, totalEpisodes: 12, isComplete: false });
assert.deepStrictEqual(progress({})(m.seasonOf(m.compactSeason(shows.ended))), { seasonNumber: 2, airedEpisodes: 8, totalEpisodes: 8, isComplete: true });
assert.strictEqual(progress({})(m.seasonOf(m.compactSeason(shows.noDates))), false);
assert.strictEqual(progress({})(m.seasonOf(m.compactSeason(shows.specialsOnly))), false);

// 2. an old cache ({data, timestamp}) turns into records of the same badges and shrinks
const NOW = 1e12, DAY = 24 * 3600 * 1000;
{
  const old = {};
  for (const name in shows) old[shows[name].id] = { data: shows[name], timestamp: NOW - 1000 };
  const out = m.pruneSeasonCache(old, NOW, DAY, 500);
  assert.strictEqual(Object.keys(out).length, Object.keys(shows).length);
  assert(JSON.stringify(out).length * 10 < JSON.stringify(old).length);
  for (const name in shows) {
    const r = out[shows[name].id];
    assert.strictEqual(r.t, NOW - 1000);
    assert.strictEqual(r.data, undefined);
    assert.deepStrictEqual(progress({})(m.seasonOf(r)), progress({})(shows[name]), name);
  }
  // a pruned cache is a fixed point (the migration writes once)
  assert.strictEqual(JSON.stringify(m.pruneSeasonCache(out, NOW, DAY, 500)), JSON.stringify(out));
}

// 3. TTL: older than 24 h goes (old and new format), younger stays; junk is dropped
{
  const raw = {
    a: { t: NOW - DAY + 1, k: 1, s: 1, e: 1, c: 1 },
    b: { t: NOW - DAY, k: 1, s: 1, e: 1, c: 1 },
    c: { data: shows.ended, timestamp: NOW - DAY - 1 },
    d: { data: shows.ended, timestamp: NOW - 5 },
    e: null, f: 'x', g: {}, h: { data: shows.ended }
  };
  assert.deepStrictEqual(Object.keys(m.pruneSeasonCache(raw, NOW, DAY, 500)).sort(), ['a', 'd']);
  assert.deepStrictEqual(m.pruneSeasonCache(null, NOW, DAY, 500), {});
  assert.deepStrictEqual(m.pruneSeasonCache('[1]', NOW, DAY, 500), {});
}

// 4. size limit: the newest `max` stay, and 500 records fit in 50 KB
{
  const raw = {};
  for (let i = 0; i < 700; i++) raw[100000 + i] = Object.assign(m.compactSeason(shows.running), { i: 100000 + i, t: NOW - i * 1000 });
  const out = m.pruneSeasonCache(raw, NOW, DAY, 500);
  const keys = Object.keys(out);
  assert.strictEqual(keys.length, 500);
  assert(out[100000] && out[100499] && !out[100500] && !out[100699]);
  assert(JSON.stringify(out).length < 50 * 1024, 'cache is ' + JSON.stringify(out).length + ' bytes');
}
console.log('seasons-cache: ok');

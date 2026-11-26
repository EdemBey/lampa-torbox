import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('../plugin/seasons.js', import.meta.url)), 'utf8');
const from = src.indexOf('    function getSeasonProgress(');
const to = src.indexOf('    function createBadge(');
assert(from > 0 && to > from, 'getSeasonProgress not found in plugin/seasons.js');
const code = src.slice(from, to);

const build = (win) => new Function('window', code + '\nreturn getSeasonProgress;')(win);

const tmdb = {
  id: 117465,
  seasons: [{ season_number: 1, episode_count: 25 }],
  last_episode_to_air: { season_number: 1, episode_number: 25 }
};

// online_mod_watch with the same splitOf/lampaOf logic as plugin/online_mod.js (lines 402-463)
// stored: the online_mod_watch_split cache, keyed by 'tmdb_<id>'
function fakeWatch(stored) {
  return {
    splitOf: function splitOf(card) {
      return stored['tmdb_' + card.id] || null;
    },
    lampaOf: function lampaOf(card, season, number) {
      var split = this.splitOf(card);
      if (!split || Object.keys(split).length < 2 || season != 1) return { season: season, episode: number };
      var last = Object.keys(split).length;
      var n = number;
      for (var s = 1; s < last && n > (split[s] || 0); s++) n -= split[s] || 0;
      return { season: s, episode: n };
    }
  };
}

// 1. no watch map: TMDB's single season as is
{
  assert.deepStrictEqual(build({})(tmdb), { seasonNumber: 1, airedEpisodes: 25, totalEpisodes: 25, isComplete: true });
}

// 2. split 13 + 12 for tmdb_117465: the same TMDB data shows Lampa's season 2
{
  const getSeasonProgress = build({ online_mod_watch: fakeWatch({ tmdb_117465: { 1: 13, 2: 12 } }) });
  assert.deepStrictEqual(getSeasonProgress(tmdb), { seasonNumber: 2, airedEpisodes: 12, totalEpisodes: 12, isComplete: true });
  const partial = Object.assign({}, tmdb, { last_episode_to_air: { season_number: 1, episode_number: 20 } });
  assert.deepStrictEqual(getSeasonProgress(partial), { seasonNumber: 2, airedEpisodes: 7, totalEpisodes: 12, isComplete: false });
}

// 2b. the split is keyed by TMDB id: another show keeps TMDB numbering
{
  const getSeasonProgress = build({ online_mod_watch: fakeWatch({ tmdb_117465: { 1: 13, 2: 12 } }) });
  assert.deepStrictEqual(getSeasonProgress(Object.assign({}, tmdb, { id: 1 })), { seasonNumber: 1, airedEpisodes: 25, totalEpisodes: 25, isComplete: true });
}

// 3. a split with one part is not a split: TMDB result unchanged
{
  const getSeasonProgress = build({ online_mod_watch: fakeWatch({ tmdb_117465: { 1: 25 } }) });
  assert.deepStrictEqual(getSeasonProgress(tmdb), { seasonNumber: 1, airedEpisodes: 25, totalEpisodes: 25, isComplete: true });
}

// 4. the last part is still airing: TMDB's live count (26) overrides the cached split's 12 for season 2
{
  const getSeasonProgress = build({ online_mod_watch: fakeWatch({ tmdb_117465: { 1: 13, 2: 12 } }) });
  const airing = { id: 117465, seasons: [{ season_number: 1, episode_count: 26 }], last_episode_to_air: { season_number: 1, episode_number: 25 } };
  assert.deepStrictEqual(getSeasonProgress(airing), { seasonNumber: 2, airedEpisodes: 12, totalEpisodes: 13, isComplete: false });
}

// 5. split 13 + 10, TMDB 26 episodes, last aired S1E24: season 2 is 11 of 13
{
  const getSeasonProgress = build({ online_mod_watch: fakeWatch({ tmdb_117465: { 1: 13, 2: 10 } }) });
  const cut = { id: 117465, seasons: [{ season_number: 1, episode_count: 26 }], last_episode_to_air: { season_number: 1, episode_number: 24 } };
  assert.deepStrictEqual(getSeasonProgress(cut), { seasonNumber: 2, airedEpisodes: 11, totalEpisodes: 13, isComplete: false });
}

console.log('seasons-badge OK');

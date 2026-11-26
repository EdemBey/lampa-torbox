// Test helper (not a test): a `watch` built from a slice of the plugin over a small Lampa mock.
// Each call is a fresh instance with its own storage, so cases cannot leak into each other.
export function makeWatch(code, store) {
  store = store || {};
  const viewed = store.fv || (store.fv = {});
  const Lampa = {
    Utils: {
      hash: (s) => 'h:' + s,
      countSeasons: (c) => {
        const n = (c.seasons || []).filter((s) => s.episode_count > 0).length;
        return c.number_of_seasons ? Math.min(n, c.number_of_seasons) : n;
      },
      splitEpisodesIntoSeasons: () => ({})
    },
    Storage: {
      get: (k, d) => (store[k] !== undefined ? store[k] : d === '{}' ? {} : d),
      set: (k, v) => { store[k] = v; }
    },
    Api: { seasons: () => {} },
    Lang: { translate: (s) => s },
    Timeline: {
      filename: () => 'fv',
      listener: { follow: () => {} },
      link: (card, s, e) => ({ card: 'tv_' + card.id, season: s, episode: e }),
      view: (hash, meta) => {
        const v = viewed[hash] || { percent: 0, time: 0, duration: 0 };
        const out = { hash: hash, percent: v.percent, time: v.time, duration: v.duration, updated: v.updated };
        if (meta) { out.card = meta.card; out.season = meta.season; out.episode = meta.episode; }
        return out;
      },
      update: (p) => { viewed[p.hash] = Object.assign({}, viewed[p.hash], p); }
    },
    Listener: { follow: () => {} },
    // the network never answers: a case holds everything it needs in its storage
    Reguest: function () { this.timeout = () => {}; this.silent = () => {}; this['native'] = () => {}; }
  };
  const animeSkip = { isAnime: (card) => !!card.anime, get: () => {} };
  const watch = new Function('Lampa', 'animeSkip', 'skipOf', 'window', '$', code + '\nreturn watch;')(Lampa, animeSkip, () => null, {}, { ajax: () => {} });
  return { watch, store, Lampa, animeSkip };
}

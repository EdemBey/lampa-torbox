//25.10.2026 - Fix
//08.11.2026 - Added Naruto Based balancer (anime.home.kopenkin.tech)
//08.11.2026 - Forward URL qualities to DDD for all balancers
//08.11.2026 - DDD quality transport via X-DDD-Quality header
//21.11.2026 - Alloha via onomovie.ru + helper server (server/), search by kp/imdb id
//08.11.2026 - Lazy playlist resolution, HDrezka mirror
//08.11.2026 - Prefer fast source providers, revert direct CDN
//08.11.2026 - DDD quality list keeps 1080p and real lower qualities
//08.11.2026 - Per-episode quality maps in Lampa player and DDD
//08.11.2026 - Keep every signed quality URL (Dzen variants)
//08.11.2026 - Solve Anubis proof-of-work for HDrezka mirrors
//08.11.2026 - HDrezka login through native bridge (no CORS)
//08.11.2026 - Keep Anubis cookie when saving login cookies
//08.11.2026 - HDrezka uses OkHttp user agent (Anubis whitelist)
//09.11.2026 - Show our balancers in MODS's (modss.tv) source list
//09.11.2026 - Keep MODS sources visible in our source list
//09.11.2026 - Switch MODS sources through its own component, lock VIP items
//12.11.2026 - HDrezka: robust voice list parsing (CRLF, alternate markup)
//12.11.2026 - Unwrap the Android bridge JSON envelope (HDrezka voices)
//12.11.2026 - HDrezka: strip HTML from quality labels (1080p Ultra)
//12.11.2026 - HDrezka: drop Premium placeholder qualities, refuse premium-only voices
//12.11.2026 - HDrezka: hide b-prem_translator voices (setting to show them)
//12.11.2026 - DDD: inline per-episode qualities for resolved playlists (HDrezka)
//12.11.2026 - DDD: stable item keys and Lampa positions for per-episode resume
//22.11.2026 - Alloha: real quality list per episode, 4K by default when Alloha has it
//23.11.2026 - Alloha: inner audio tracks of a voice (e.g. Украинский: 1+1 / HDREZKA / English) in a separate "Дорожка" filter
//23.11.2026 - Alloha: subtitles (all tracks Alloha lists for the file) in the player
//23.11.2026 - Alloha: switch the voice's inner tracks from the player's audio track menu
//23.11.2026 - Alloha: tracks and subtitles are listed per episode (later episodes can be another file)
//23.11.2026 - External Android player: playlist entries keep their subtitles
//23.11.2026 - Alloha: voiceovers for the DDD player (X-DDD-Voiceover-Path)
//23.11.2026 - Alloha: 4K mark and episode range next to each voice (4K, 1-12 эп.); range shared with Kodik and Turbo
//23.11.2026 - HDrezka in a browser: login and pages through the Alloha helper (rezka has no CORS and lets only app user agents past its bot check)
//23.11.2026 - HDrezka in a browser without a server: Tampermonkey bridge (plugin/rezka-bridge.user.js)
//23.11.2026 - Server address field also in the Turbo and HDrezka settings (same value as in Alloha)
//23.11.2026 - HDrezka: seasons first (every season any voice has), voices follow the season with an episode range (one request per voice when a series opens)
//23.11.2026 - Filter: the season row comes before the voice row in every balancer
//24.11.2026 - Anime openings/endings for DDD's Skip button (X-DDD-Segments): YummyAnime timings, AniSkip fallback
//24.11.2026 - Skip button: AniSkip first when the MAL id is known, YummyAnime timings only without it; Naruto Based gets the site's own skip-times url
//24.11.2026 - Skip button: YummyAnime timings and the AniSkip url together for every balancer (Naruto Based included); DDD merges them
//24.11.2026 - Skip button for regular series: TheIntroDB and IntroDB urls for DDD (intro, recap, credits)
//24.11.2026 - Skip button in Lampa's own player: own button and timeline marks, AniSkip matched by the loaded video's length
//24.11.2026 - Skip button for anime: AniSkip for the episode and its neighbours, DDD keeps results matching the video length; YummyAnime only for the Kodik upload with the chosen voiceover
//25.11.2026 - Skip button on Alloha: the player's own opening/ending marks (bnsi skipTime) via the helper's /skips
//25.11.2026 - One "watched" across balancers and TorBox: TMDB season/episode key with Timeline.link (TimeCode server sync); unproven numbering keeps its own key
//25.11.2026 - Watched: single-TMDB-season anime use Lampa's own air-date split (as its episode list); old marks get the card link once (TimeCode only, not CUB)
//25.11.2026 - Watched: unproven anime seasons are cross-checked with YummyAnime and TMDB's "Seasons" group, else asked once before playback (Kodik entries: from the item menu); answers sync through Lampac Storage
//25.11.2026 - Watched: KinoPub joins the shared key; AniLibria, AniLiberty and AnimeLib releases are matched from the item menu
//25.11.2026 - Watched: Kodik entries are placed by YummyAnime (the franchise TV part with the entry's shikimori id)
//25.11.2026 - «По сериям» button: season → episode (Lampa's numbering, with progress) → source; the source opens on that episode
//25.11.2026 - Plugin URL parameters ?lampac=…&alloha=… fill empty server address settings at start
//25.11.2026 - Setting «Адрес Lampac»: loads its timecode.js (server-side "watched" sync), off when empty
//22.11.2026 - Naruto Based: Steel Ball Run ending music replacement, like the site player

(function () {
    'use strict';

    /**
     * Start playback without Lampa's CUB preroll.
     * Lampa skips preroll for playlist continuations, so mark the item as
     * `continue_play` and put it into PlayerPlaylist before Player.play().
     */
    function isExternalAndroidPlayer() {
      return Boolean(
        window.Lampa &&
        Lampa.Platform &&
        typeof Lampa.Platform.is === 'function' &&
        Lampa.Platform.is('android') &&
        Lampa.Storage &&
        typeof Lampa.Storage.field === 'function' &&
        Lampa.Storage.field('player') === 'android'
      );
    }

    /**
     * Attach Lampa's quality map to the Android intent so DDD can show
     * URL-based quality options. Only plain URL entries are usable there;
     * `call`-based tracks stay inside Lampa.
     */
    function attachQualityHeader(first) {
      if (!first || !first.ddd_quality) return;

      var headers = {};
      var existing = first.headers;

      if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
        headers = Object.assign({}, existing);
      } else if (Array.isArray(existing)) {
        for (var i = 0; i + 1 < existing.length; i += 2) {
          headers[existing[i]] = existing[i + 1];
        }
      }

      headers['X-DDD-Quality'] = first.ddd_quality;
      first.headers = headers;
    }

    /**
     * Lampa quality map of one item -> DDD list [{name, url}], `Auto` being
     * the item's own URL when the map does not contain it.
     */
    function buildQualityList(item) {
      if (!item || !item.quality) return [];

      var list = [];
      var seen = {};

      function normalize(url) {
        if (!url) return '';
        url = String(url).trim();

        if (url.indexOf('//') === 0) return 'https:' + url;
        if (url.indexOf('http') !== 0) return '';

        return url;
      }

      function add(name, url) {
        url = normalize(url);
        if (!url || seen[url]) return;

        seen[url] = true;
        list.push({
          name: String(name || 'Quality').replace(/\u200B/g, ''),
          url: url
        });
      }

      if (Array.isArray(item.quality)) {
        item.quality.forEach(function (entry, index) {
          if (typeof entry === 'string') add('Quality ' + (index + 1), entry);
          else if (entry) add(entry.label || entry.name || 'Quality ' + (index + 1), entry.url || entry.file);
        });
      } else {
        for (var key in item.quality) {
          if (!Object.prototype.hasOwnProperty.call(item.quality, key)) continue;

          var value = item.quality[key];
          var url = typeof value === 'string' ? value : value && (value.url || value.file);
          var name = value && typeof value === 'object' && value.label ? value.label : key;

          add(name, url);
        }
      }

      var currentUrl = normalize(typeof item.url === 'string' ? item.url : '');
      if (!list.length) return list;

      var hasCurrent = list.some(function (entry) {
        return entry.url === currentUrl;
      });

      if (!hasCurrent && currentUrl) {
        list.unshift({ name: 'Auto', url: currentUrl });
      }

      return list;
    }

    function attachExternalQualities(first) {
      if (!first || first.ddd_quality || !first.quality) return;
      if (!isExternalAndroidPlayer()) return;

      var list = buildQualityList(first);

      if (list.length > 1) {
        first.ddd_quality = JSON.stringify(list);
        attachQualityHeader(first);
      }
    }

    function sanitizePlaylist(first, playlist) {
      var list = playlist.map(function (item) {
        var out = { url: item.url, title: item.title, timeline: item.timeline };
        // Lampa Android takes each entry's subtitles from this list (video_list.subtitles), not from
        // the item that starts playback, so dropping them here loses them for the external player.
        // Its parser throws on an entry without url or label and then drops the whole playlist.
        var subs = Array.isArray(item.subtitles) ? item.subtitles.filter(function (s) {
          return s && typeof s.url === 'string' && s.url && s.label != null;
        }).map(function (s) {
          return { label: String(s.label), url: s.url };
        }) : [];
        if (subs.length) {
          out.subs = subs;
          // Lampa Android reads video_list.subtitles (optJSONArray "subtitles"), the same field the built-in player uses
          out.subtitles = subs;
        }
        return out;
      }).filter(function (item) {
        return item.url;
      });
      // Android hands the playlist over in one intent of about 1 MB at most, and past that the player
      // does not start at all. A very long season keeps subtitles only for the episode that starts.
      var size = 0;
      list.forEach(function (item) {
        if (item.subs) size += JSON.stringify(item.subs).length;
      });
      if (size > 200000) list.forEach(function (item) {
        if (item.url !== first.url) delete item.subtitles;
      });
      return list;
    }

    function resolveLazyPlaylist(playlist, callback) {
      var lazy = [];

      playlist.forEach(function (item) {
        if (item && typeof item.url === 'function') lazy.push(item);
      });

      if (!lazy.length) {
        callback(playlist);
        return;
      }

      var limit = Math.min(lazy.length, 120);
      var index = 0;
      var done = 0;
      var cancelled = false;
      var finished = false;

      function update() {
        try {
          $('.loading-layer .loading-layer__text').text(Lampa.Lang.translate('online_mod_playlist_prepare') + done + ' / ' + limit);
        } catch (e) {}
      }

      function doneLoading() {
        try {
          Lampa.Loading.stop();
        } catch (e) {}
      }

      function finish() {
        if (finished) return;

        finished = true;
        doneLoading();

        callback(playlist.filter(function (item) {
          return item && typeof item.url === 'string' && item.url;
        }));
      }

      function next() {
        if (cancelled || index >= limit) {
          finish();
          return;
        }

        var item = lazy[index++];
        var called = false;
        var timer = setTimeout(function () {
          if (called) return;

          called = true;
          item.url = '';
          done++;
          update();
          next();
        }, 15000);

        update();

        try {
          item.url(function () {
            if (called) return;

            called = true;
            clearTimeout(timer);
            done++;
            update();
            next();
          });
        } catch (e) {
          if (!called) {
            called = true;
            clearTimeout(timer);
            item.url = '';
            done++;
            next();
          }
        }
      }

      try {
        Lampa.Loading.start(function () {
          cancelled = true;
        });
      } catch (e) {}

      update();
      next();
    }

    /**
     * Per-episode source descriptors for the external player. Lampa's Android
     * bridge forwards only URLs in `video_list`, so this is the only channel
     * that can carry quality data for every playlist item. A value is either
     * a descriptor URL or an inline [{name, url}] list.
     */
    function attachQualitySources(first, playlist) {
      if (!first || !playlist || !playlist.length) return;

      var sources = {};
      var count = 0;

      playlist.forEach(function (item, index) {
        if (!item) return;

        if (item.qualitySourceUrl) {
          sources[String(index)] = item.qualitySourceUrl;
          count++;
          return;
        }

        // Already resolved items (e.g. HDrezka) carry their quality map:
        // send it inline instead of a descriptor URL.
        var list = buildQualityList(item);

        if (list.length > 1) {
          sources[String(index)] = list;
          count++;
        }
      });

      if (!count) return;

      var headers = {};
      var existing = first.headers;

      if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
        headers = Object.assign({}, existing);
      } else if (Array.isArray(existing)) {
        for (var i = 0; i + 1 < existing.length; i += 2) {
          headers[existing[i]] = existing[i + 1];
        }
      }

      headers['X-DDD-Quality-Sources'] = JSON.stringify(sources);
      first.headers = headers;
    }

    function setDddHeader(first, name, value) {
      var headers = {};
      var existing = first.headers;

      if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
        headers = Object.assign({}, existing);
      } else if (Array.isArray(existing)) {
        for (var i = 0; i + 1 < existing.length; i += 2) {
          headers[existing[i]] = existing[i + 1];
        }
      }

      headers[name] = value;
      first.headers = headers;
    }

    /**
     * Resume data for DDD: a stable key per item (signed CDN links change on
     * every request, so DDD cannot remember positions by URL) and the
     * position Lampa's timeline already knows.
     */
    function attachResumeData(first, playlist) {
      var keys = {};
      var positions = {};
      var have_keys = false;
      var have_positions = false;

      playlist.forEach(function (item, index) {
        if (!item) return;

        if (item.ddd_key) {
          keys[String(index)] = item.ddd_key;
          have_keys = true;
        }

        var view = item.timeline;

        if (view && view.time > 5 && !(view.percent >= 95)) {
          positions[String(index)] = Math.round(view.time * 1000);
          have_positions = true;
        }
      });

      if (have_keys) setDddHeader(first, 'X-DDD-Item-Keys', JSON.stringify(keys));
      if (have_positions) setDddHeader(first, 'X-DDD-Positions', JSON.stringify(positions));
    }

    /**
     * One "watched" for every source. The canonical episode is the card's TMDB season/episode: the key
     * Lampa's own card uses, with Timeline.link so the TimeCode server can tell the episode. A source whose
     * numbering is not proven to match keeps its own key, so a guessed mark is never written.
     */
    var watch = {
      store: 'online_mod_watch_map',
      links: {},
      asks: [],
      // Single-TMDB-season cards: episode counts of Lampa's own air-date split (what its episode list shows)
      splits: null,
      splitOf: function splitOf(card) {
        // a stored value that is not an object (corrupted) is started over
        if (!this.splits) this.splits = Lampa.Storage.get('online_mod_watch_split', '{}');
        if (!this.splits || typeof this.splits != 'object') this.splits = {};
        // TMDB may later split the show into real seasons: then Lampa shows those, not its air-date split
        return card && Lampa.Utils.countSeasons && Lampa.Utils.countSeasons(card) === 1 && this.splits[this.id(card)] || null;
      },
      prefetch: function prefetch(card, force) {
        var self = this;
        if (!card || !card.id || !card.original_name || !Lampa.Api || !Lampa.Api.seasons || !Lampa.Utils.splitEpisodesIntoSeasons) return;
        // splitOf() also loads the cache the callback writes into, so it runs even when forced
        var known = this.splitOf(card);
        if (Lampa.Utils.countSeasons(card) !== 1 || !force && known) return;
        Lampa.Api.seasons(card, [1], function (v) {
          var s = v && v[1];
          var eps = s && (s.episodes_original || s.episodes);
          if (!eps || !eps.length) return;
          var parts = Lampa.Utils.splitEpisodesIntoSeasons(eps);
          var out = {};
          Object.keys(parts).forEach(function (k) {
            out[k] = parts[k].length;
          });
          self.splits[self.id(card)] = out;
          var keys = Object.keys(self.splits);
          // shortcut: keeps the 200 newest cards; an evicted card is fetched again when opened
          if (keys.length > 200) delete self.splits[keys[0]];
          Lampa.Storage.set('online_mod_watch_split', self.splits);
        });
      },
      // TMDB season number -> episode count
      counts: function counts(card) {
        var split = this.splitOf(card);
        if (split && Object.keys(split).length >= 2) {
          var out = {};
          Object.keys(split).forEach(function (k) {
            out[+k] = split[k];
          });
          return out;
        }
        var out2 = {};
        (card && card.seasons || []).forEach(function (s) {
          if (s && s.season_number > 0 && s.episode_count > 0) out2[s.season_number] = s.episode_count;
        });
        return out2;
      },
      // Lampa's episode as TMDB numbers it: a single TMDB season Lampa splits by air date is counted back
      tmdbOf: function tmdbOf(card, season, episode) {
        var split = this.splitOf(card);
        if (!split || Object.keys(split).length < 2) return { season: season, number: episode };
        var n = episode;
        for (var s = 1; s < season; s++) n += split[s] || 0;
        return { season: 1, number: n };
      },
      // and back: TMDB's numbers as Lampa's episode (the last part keeps the overflow of a running season)
      lampaOf: function lampaOf(card, season, number) {
        var split = this.splitOf(card);
        if (!split || Object.keys(split).length < 2 || season != 1) return { season: season, episode: number };
        var last = Object.keys(split).length;
        var n = number;
        for (var s = 1; s < last && n > (split[s] || 0); s++) n -= split[s] || 0;
        return { season: s, episode: n };
      },
      // Lampa's own timeline key of a card episode
      key: function key(card, season, episode) {
        return [season, season > 10 ? ':' : '', episode, card.original_title].join('');
      },
      // anchor [e0, S, E]: source episode e0 is canonical S:E, the rest run on into the next seasons.
      // The last season keeps the overflow: TMDB lags behind a running season.
      canon: function canon(anchor, episode, counts) {
        var s = anchor[1];
        var e = anchor[2] + (episode - anchor[0]);
        if (!(e >= 1)) return null;
        while (counts[s] && counts[s + 1] && e > counts[s]) {
          e -= counts[s];
          s++;
        }
        return counts[s] ? { season: s, episode: e } : null;
      },
      // n episodes are exactly whole TMDB seasons counted from the first
      whole: function whole(n, counts) {
        for (var s = 1, sum = 0; counts[s]; s++) {
          sum += counts[s];
          if (sum === n) return true;
        }
        return false;
      },
      // map answers (std, '<balancer>:<season>', 'shiki:<id>', 0) are written by the phase-2 "match episodes" menu
      // {season, episode} = proven or answered; false = never linked; null = not proven, ask
      rule: function rule(map, counts, anime, q) {
        var own = map[q.balancer + ':' + q.season];
        // a merged Kodik franchise answers per part (one shikimori entry can hold several of its seasons)
        var saved = q.src ? map[q.part ? q.src + ':' + q.season : q.src] : own !== undefined ? own : map['std:' + q.season];
        if (saved === 0) return false;
        if (saved) return this.canon(saved, q.episode, counts) || false;
        // the title's season list picked in the match menu
        var listed = this.byParts(map.parts, counts, q);
        if (listed) return listed;
        if (q.part) return this.stacked(q.part, q.episode, counts);
        if (q.src) return null;
        var same = { season: q.season, episode: q.episode };
        // no TMDB list to check against: today's behaviour
        if (!counts[1]) return same;
        if (!counts[q.season]) return anime ? null : same;
        var before = 0;
        for (var s = 1; s < q.season; s++) before += counts[s] || 0;
        var last = !counts[q.season + 1];
        // numbers run on from the earlier seasons (season 2 starts at 13)
        if (before && q.min > before) return q.max > counts[q.season] && (last || q.max <= before + counts[q.season]) ? this.canon([1, 1, 1], q.episode, counts) : null;
        if (q.max > counts[q.season] && !last) return q.season == 1 && this.whole(q.max, counts) ? this.canon([1, 1, 1], q.episode, counts) : null;
        // anime seasons after the first are split differently too often: one answer per title (map.std)
        // Lampa's own split of a single TMDB season: a season that lists exactly its episodes is that season
        // std was answered for balancers that have TMDB's number of seasons
        var alike = !q.seasons || q.seasons === Object.keys(counts).length;
        return !anime || q.season == 1 || map.std && alike || q.split && q.seasons === Object.keys(counts).length && q.min === 1 && q.max === counts[q.season] ? same : null;
      },
      // Kodik franchise part, placed by the episodes of the TV parts before it. Proven when the franchise and
      // TMDB count the same at some end after the part, or (first TMDB season of the part only) at its start.
      stacked: function stacked(part, episode, counts) {
        if (part.index === -2) return null;
        if (part.index < 0 || episode < 1) return false;
        var from = part.bounds[part.index];
        var ends = { 0: true };
        var hi = false;
        var s, i, sum;
        for (s = 1, sum = 0; counts[s]; s++) {
          sum += counts[s];
          ends[sum] = true;
        }
        for (i = part.index + 1; i < part.bounds.length; i++) {
          if (ends[part.bounds[i]]) hi = true;
        }
        if (!hi && !ends[from]) return null;
        if (part.first > 1 && part.first !== from + 1) return null;
        var at = this.canon([1, 1, 1], part.first > 1 ? episode : from + episode, counts);
        var start = this.canon([1, 1, 1], from + 1, counts);
        if (!at || !start) return false;
        // a part that starts past TMDB's last known episode cannot be placed (it would land in the overflow)
        if (start.episode > counts[start.season]) return null;
        return hi || at.season === start.season ? at : null;
      },
      // Where a merged Kodik season sits among the franchise's TV parts: {index, bounds, first} for stacked().
      // Which parts are TV is told by YummyAnime's TV parts (tv = alt.ys); without them an ONA or a special
      // (Chibi Revengers) would count as one. -2: not known yet (asked again once the parts come); -1: not a TV part
      kodikPart: function kodikPart(seasons, items, tv, season_id) {
        var bounds = [0];
        var index = -1;
        var first = 0;
        if (!tv) return { index: -2, bounds: bounds, first: first };
        seasons.forEach(function (season) {
          // Kodik's season "0" is the part's specials, never a TV season
          if (season.single || season.kodik_key === '0') return;
          var seen = {};
          var shiki = '';
          items.forEach(function (c) {
            var s = c.seasons && c.seasons[season.id];
            if (!s) return;
            if (!shiki && c.shikimori_id) shiki = String(c.shikimori_id);
            if (s.episodes) Object.keys(s.episodes).forEach(function (e) {
              if (e >= 1) seen[e] = true;
            });
          });
          if (!shiki || tv.indexOf(shiki) < 0) return;
          var keys = Object.keys(seen).map(Number);
          if (season.id == season_id) {
            index = bounds.length - 1;
            first = keys.length ? Math.min.apply(null, keys) : 0;
          }
          bounds.push(bounds[bounds.length - 1] + keys.length);
        });
        return { index: index, bounds: bounds, first: first };
      },
      // rule() first; what it cannot prove is checked against the other sources' season lists (alt)
      place: function place(map, counts, anime, q, alt) {
        var r = this.rule(map, counts, anime, q);
        if (r !== null || !alt) return r;
        return q.src ? this.kodik(alt, counts, q) : this.agree(alt, counts, q);
      },
      // A source's season list proves this season when the balancer has as many seasons, lists exactly this
      // season's episodes, and the list meets TMDB's seasons at an end (stacked). Every list that fits must
      // give the same episode, and so must TMDB's own seasons if the balancer fits them too.
      agree: function agree(alt, counts, q) {
        var self = this;
        var out = null;
        var clash = false;
        var take = function take(p) {
          if (!p) return;
          if (out && (out.season !== p.season || out.episode !== p.episode)) clash = true;
          out = out || p;
        };
        var ends = { 0: true };
        for (var s = 1, sum = 0; counts[s]; s++) {
          sum += counts[s];
          ends[sum] = true;
        }
        // a running last season legitimately differs (aired vs planned): every element but the last must match
        var confirmed = alt.g && alt.y && alt.g.length > 1 && alt.g.length === alt.y.length && alt.g.slice(0, -1).join() === alt.y.slice(0, -1).join();
        // the two sources count this balancer's seasons differently: nothing is proven
        if (alt.g && alt.y && !confirmed && alt.g.length === q.seasons && alt.y.length === q.seasons) return null;
        [alt.y, alt.g].forEach(function (parts) {
          var n = parts && parts.length === q.seasons && parts[q.season - 1];
          if (!n) return;
          var bounds = [0];
          parts.forEach(function (c) {
            bounds.push(bounds[bounds.length - 1] + c);
          });
          var from = bounds[q.season - 1];
          var run = q.min > 1;
          if (q.min !== (run ? from + 1 : 1) || q.max !== (run ? from : 0) + n) return;
          // YummyAnime's viewing order is a watch order: a season counted from 1 needs TMDB's group to confirm it,
          // or must sit exactly between two of Lampa's season ends (run-on numbers do not depend on the order)
          if (parts === alt.y && !run && !confirmed && !(ends[from] && ends[from + n])) return;
          take(self.stacked({ index: q.season - 1, bounds: bounds, first: q.min }, q.episode, counts));
        });
        if (out && q.seasons === Object.keys(counts).length && q.min === 1 && q.max === counts[q.season]) take({ season: q.season, episode: q.episode });
        return out && !clash ? out : null;
      },
      // Other sources' season lists per card: {t, k: Kinopoisk id used, y: YummyAnime TV parts | 0, g: TMDB "Seasons" groups | 0}
      alts: null,
      waits: {},
      altOf: function altOf(card) {
        if (!this.alts) this.alts = Lampa.Storage.get('online_mod_watch_alt', '{}');
        if (!this.alts || typeof this.alts != 'object') this.alts = {};
        return card && card.id && this.alts[this.id(card)] || null;
      },
      alt: function alt(card, call) {
        var self = this;
        var id = card && card.id && card.original_name ? this.id(card) : '';
        var kp = id && (card.kinopoisk_id || card.kp_id) || 0;
        var have = id && this.altOf(card);
        // shortcut: refetched after 12 h (a running season grows), or once the Kinopoisk id turns up
        // a card whose YummyAnime parts were not found yet but now can be (its viewing order came): asked again after 10 min
        var urls = card && card.yani_order_urls && card.yani_order_urls.length;
        if (!id || have && Date.now() - have.t < 43200000 && (have.k || !kp) && (have.y || kp || !urls || Date.now() - have.t < 600000)) return call && call();
        if (this.waits[id]) return call && this.waits[id].push(call);
        var waiting = this.waits[id] = call ? [call] : [];
        var out = { t: Date.now(), k: kp };
        var left = 2;
        var settle = function settle(key, parts) {
          if (key in out) return;
          // a failed refetch keeps what was known
          out[key] = parts || have && have[key] || 0;
          if (--left) return;
          self.alts[id] = out;
          var ids = Object.keys(self.alts);
          // shortcut: keeps the 200 newest cards, like the splits
          if (ids.length > 200) delete self.alts[ids[0]];
          Lampa.Storage.set('online_mod_watch_alt', self.alts);
          // «По сериям» rows of this card were placed without these lists (a refetch that brought the same keeps them)
          var same = have && JSON.stringify([out.y, out.ys, out.g]) === JSON.stringify([have.y, have.ys, have.g]);
          if (!same && typeof episodeVariants != 'undefined') episodeVariants.forgetCard(id);
          delete self.waits[id];
          waiting.forEach(function (cb) {
            cb();
          });
        };
        this.yummy(card, function (parts, ids) {
          // the TV parts' shikimori ids place Kodik's entries
          if (!('ys' in out)) out.ys = parts && ids || have && have.ys || 0;
          settle('y', parts);
        });
        this.groups(card, function (parts) {
          settle('g', parts);
        });
      },
      // TMDB's episode group "Seasons" (type 6): episode counts of its groups when they are whole runs of
      // TMDB's regular episodes in order; anything else (story arcs, a special inside) is 0
      groups: function groups(card, call) {
        var fail = function fail() {
          call(0);
        };
        if (this.id(card).indexOf('tmdb_') !== 0 || !Lampa.TMDB || !Lampa.TMDB.api) return fail();
        var before = {};
        var sum = 0;
        (card.seasons || []).slice().sort(function (a, b) {
          return a.season_number - b.season_number;
        }).forEach(function (s) {
          if (!(s.season_number > 0)) return;
          before[s.season_number] = sum;
          sum += s.episode_count || 0;
        });
        var get = function get(path, ok) {
          var net = new Lampa.Reguest();
          net.timeout(5000);
          net.silent(Lampa.TMDB.api(path + '?api_key=' + Lampa.TMDB.key()), ok, fail);
        };
        get('tv/' + card.id + '/episode_groups', function (json) {
          var list = (json && json.results || []).filter(function (g) {
            return g.type == 6;
          });
          // shortcut: a title with several such groups gets none; rank them if that turns up
          if (list.length !== 1) return fail();
          get('tv/episode_group/' + list[0].id, function (full) {
            var runs = [];
            var whole = (full && full.groups || []).every(function (g) {
              var abs = (g.episodes || []).map(function (e) {
                return e.season_number > 0 && before[e.season_number] !== undefined ? before[e.season_number] + e.episode_number : 0;
              }).sort(function (a, b) {
                return a - b;
              });
              var last = abs[abs.length - 1];
              // specials only: not a season
              if (!last) return true;
              runs.push([abs[0], abs.length]);
              return abs[0] > 0 && last - abs[0] === abs.length - 1 && abs.every(function (v, i) { return !i || v !== abs[i - 1]; });
            });
            runs.sort(function (a, b) {
              return a[0] - b[0];
            });
            var next = 1;
            whole = whole && runs.length > 0 && runs.every(function (r) {
              var fits = r[0] === next;
              next += r[1];
              return fits;
            });
            call(whole ? runs.map(function (r) {
              return r[1];
            }) : 0);
          });
        });
      },
      // Episodes of the franchise's TV parts in viewing order, found by the card's Kinopoisk id
      yummy: function yummy(card, call) {
        var kp = card.kinopoisk_id || card.kp_id;
        var fail = function fail() {
          call(0);
        };
        var one = function one(v, ok) {
          animeSkip.get('/anime/' + (v.anime_url || v.anime_id) + '?need_videos=false', ok, fail);
        };
        var walk = function walk(first, full) {
          var tv = (full.viewing_order || []).filter(function (v) {
            return v.type && v.type.alias == 'tv';
          });
          if (!tv.length) tv = [first];
          var parts = [];
          var ids = [];
          var left = tv.length;
          tv.forEach(function (v, i) {
            one(v, function (part) {
              var eps = part.episodes || {};
              // an announced part (aired: 0) is not a season yet
              parts[i] = eps.aired === 0 ? 0 : eps.aired || eps.count || 0;
              ids[i] = String(part.remote_ids && (part.remote_ids.shikimori_id || part.remote_ids.myanimelist_id) || '');
              if (--left) return;
              while (parts.length && !parts[parts.length - 1]) parts.pop();
              call(parts.length && parts.every(Boolean) ? parts : 0, ids.slice(0, parts.length));
            });
          });
        };
        // without a Kinopoisk id: the YummyAnime page the card was matched to (its viewing order) tells the same
        var url = card.yani_order_urls && card.yani_order_urls[0];
        if (!kp) {
          if (!url) return fail();
          var page = { anime_url: url };
          return one(page, function (full) {
            walk(page, full);
          });
        }
        animeSkip.get('/anime?limit=1&kp_ids=' + kp, function (list) {
          if (!list[0]) return fail();
          one(list[0], function (full) {
            walk(list[0], full);
          });
        }, fail);
      },
      // A season list (the answer map.parts, or a source's for the menu) applied to this season: the balancer
      // must have as many seasons and the listed numbers must fit (the last season may run on: still airing)
      byParts: function byParts(parts, counts, q) {
        if (!parts || q.src || parts.length !== q.seasons || !parts[q.season - 1]) return null;
        var from = 0;
        for (var i = 0; i < q.season - 1; i++) from += parts[i];
        var n = parts[q.season - 1];
        var run = q.season > 1 && q.min > from;
        var top = q.season < parts.length ? (run ? from : 0) + n : Infinity;
        // run-on numbers that would also fit a season counted from 1 are not told apart
        if (q.max > top || run && q.max <= n) return null;
        return this.canon([1, 1, 1], run ? q.episode : from + q.episode, counts);
      },
      // answers hold canonical numbers: they stand while the seasons known then are the same (the last may grow)
      stands: function stands(c, counts) {
        for (var i = 0; i < c.length; i++) {
          if (i < c.length - 1 ? counts[i + 1] !== c[i] : !(counts[i + 1] >= c[i])) return false;
        }
        return true;
      },
      // An answer of the match menu: a null value deletes the key, patch null forgets the title's answers.
      // t orders the devices' copies, c are the season sizes the answer was given for.
      save: function save(card, patch) {
        var all = Lampa.Storage.get(this.store, '{}') || {};
        var id = this.id(card);
        var counts = this.counts(card);
        var cur = patch && all[id] || {};
        if (cur.c && !this.stands(cur.c, counts)) cur = {};
        Object.keys(patch || {}).forEach(function (k) {
          if (patch[k] === null) delete cur[k];else cur[k] = patch[k];
        });
        cur.t = Date.now();
        cur.c = [];
        for (var s = 1; counts[s]; s++) cur.c.push(counts[s]);
        all[id] = cur;
        Lampa.Storage.set(this.store, all);
        this.cached = null;
        // «По сериям» rows carry the places of the old answers
        if (typeof episodeVariants != 'undefined') episodeVariants.clear();
        this.sync();
      },
      title: function title(p) {
        return Lampa.Lang.translate('online_mod_season') + ' ' + p.season + ', ' + Lampa.Lang.translate('online_mod_episode').toLowerCase() + ' ' + p.episode;
      },
      // The match menu: what the sources' lists make of this episode first, then Lampa's own numbers,
      // a manual pick, no link. patch is what save() writes.
      options: function options(a) {
        var self = this;
        var q = a.element.watch_q;
        var counts = this.counts(a.card);
        var alt = this.altOf(a.card) || {};
        var key = q.src ? (q.part ? q.src + ':' + q.season : q.src) : q.balancer + ':' + q.season;
        var L = Lampa.Lang.translate;
        var out = [];
        var add = function add(title, subtitle, patch, value) {
          patch[key] = value;
          out.push({ title: title, subtitle: subtitle, patch: patch });
        };
        [['y', 'YummyAnime'], ['g', 'TMDB']].forEach(function (s) {
          var parts = alt[s[0]];
          var place = self.byParts(parts, counts, q);
          if (!place) return;
          if (out[0] && out[0].patch.parts.join() === parts.join()) out[0].subtitle = out[0].subtitle.replace(':', ' + ' + s[1] + ':');else add(self.title(place), L('online_mod_watch_by') + ' ' + s[1] + ': ' + parts.join(' / '), { parts: parts, std: null }, null);
        });
        var same = counts[q.season] && this.canon([1, q.season, 1], q.episode, counts);
        // std is for the whole title; the anchor settles this season whatever the list's numbers
        // Kodik's season is its own part number, not TMDB's: no "as in Lampa" row for it
        if (same && !q.src) add(this.title(same), L('online_mod_watch_same'), !q.src && (!q.seasons || q.seasons === Object.keys(counts).length) ? { std: 1, parts: null } : {}, [1, q.season, 1]);
        if (counts[1]) out.push({ title: L('online_mod_watch_manual'), manual: key });
        add(L('online_mod_watch_none'), '', {}, 0);
        return out;
      },
      uid: '',
      // the address of the user's Lampac, '' when not set
      server: function server() {
        var s = ((Lampa.Storage.get('online_mod_lampac_server', '') || '') + '').replace(/^\s+|\s+$/g, '').replace(/\/+$/, '');
        return !s || /^https?:\/\//i.test(s) ? s : 'http://' + s;
      },
      // the newest answer of a title wins (t); a title only one side has is kept
      merge: function merge(mine, theirs) {
        var out = {};
        [theirs || {}, mine || {}].forEach(function (side) {
          Object.keys(side).forEach(function (id) {
            var v = side[id];
            if (v && typeof v == 'object' && (!out[id] || (v.t || 0) >= (out[id].t || 0))) out[id] = v;
          });
        });
        return out;
      },
      // Answers are shared through Lampac's Storage module under the uid its TimeCode plugin uses:
      // read, merge, write back what the server lacks. Without the server everything stays local.
      sync: function sync(call) {
        var self = this;
        var s = this.server();
        var done = function done() {
          if (call) call();
        };
        if (!s) return done();
        var net = new Lampa.Reguest();
        net.timeout(3000);
        var run = function run() {
          var url = s + '/storage/get?path=onlinemod&pathfile=watchmap&uid=' + encodeURIComponent(self.uid);
          net.silent(url, function (json) {
            var theirs = {};
            try {
              var parsed = json && json.success && json.data ? JSON.parse(json.data) : null;
              if (parsed && typeof parsed == 'object') theirs = parsed;
            } catch (e) {}
            var mine = Lampa.Storage.get(self.store, '{}') || {};
            var both = self.merge(mine, theirs);
            var text = JSON.stringify(both);
            if (text !== JSON.stringify(mine)) {
              Lampa.Storage.set(self.store, both);
              self.cached = null;
            }
            // shortcut: every answered title is kept (~100 bytes each); prune by t if the file nears Lampac's 10 MiB
            if (text !== JSON.stringify(theirs)) $.ajax({ url: url.replace('/storage/get?', '/storage/set?'), type: 'POST', data: text, contentType: false, processData: false, timeout: 3000 });
            done();
          }, done);
        };
        if (this.uid) return run();
        if (this.uid === false) return done();
        net.silent(s + '/timecode.js', function (js) {
          // a server that hands out no identity: the TimeCode plugin's own id; nothing at all is not asked again
          self.uid = (/server_uid\s*=\s*['"]([^'"]+)['"]/.exec(js || '') || [])[1] || Lampa.Storage.get('lampac_unic_id', '') || false;
          if (self.uid) run();else done();
        }, done, false, { dataType: 'text' });
      },
      // the title has answers of the match menu (t and c are bookkeeping)
      answered: function answered(card) {
        var map = this.map(card);
        // answers TMDB's renumbering voided are not offered for reset
        if (map.c && !this.stands(map.c, this.counts(card))) return false;
        return Object.keys(map).some(function (k) {
          return k !== 't' && k !== 'c';
        });
      },
      // A Kodik entry (one shikimori id each) is the franchise's TV part with that id in YummyAnime's viewing
      // order: proven when it lists exactly that part and the parts meet Lampa's seasons (stacked); TMDB's
      // "Seasons" group, when known, must count the same parts
      kodik: function kodik(alt, counts, q) {
        var m = /^shiki:(\d+)$/.exec(q.src || '');
        var k = m && alt.ys ? alt.ys.indexOf(m[1]) : -1;
        // an entry's own seasons other than 1 are not told apart here
        if (k < 0 || q.part || q.season != 1 || !alt.y || q.min !== 1 || q.max !== alt.y[k]) return null;
        if (alt.g && alt.g.join() !== alt.y.join()) return null;
        var bounds = [0];
        alt.y.forEach(function (c) {
          bounds.push(bounds[bounds.length - 1] + c);
        });
        // YummyAnime's viewing order is a watch order: without TMDB's group to confirm it, the part must sit
        // exactly between two of Lampa's season ends
        var ends = { 0: true };
        for (var s = 1, sum = 0; counts[s]; s++) {
          sum += counts[s];
          ends[sum] = true;
        }
        if (!alt.g && !(ends[bounds[k]] && ends[bounds[k + 1]])) return null;
        var r = this.stacked({ index: k, bounds: bounds, first: 1 }, q.episode, counts);
        // only the user settles "never link"
        return r === false ? null : r;
      },
      // the list row of the pinned episode (rows: the item menu's entries, {item, element})
      pinRow: function pinRow(pin, rows) {
        var raw = null;
        for (var i = 0; i < (rows || []).length; i++) {
          var el = rows[i].element || {};
          var w = el.watch_place;
          if (w && w.season == pin.season && w.episode == pin.episode) return rows[i].item;
          // an episode whose place is not proven: its own numbers only move the focus; a source numbering by its own
          // releases (Kodik's parts with an OVA as a season, AniLibria) is never taken by its numbers
          if (!w && !raw && el.season == pin.season && el.episode == pin.episode && !(el.watch_info && el.watch_info.src)) raw = rows[i].item;
        }
        return raw;
      },
      // «Продолжить»: the episode last played, or the next one when it is finished (percent >= 90); s: the source's season index guess
      resumeTarget: function resumeTarget(rec, counts, percent) {
        var p = rec.p;
        if (!(percent >= 90)) return { pin: { season: p.season, episode: p.episode }, s: rec.s };
        if (counts[p.season] > p.episode) return { pin: { season: p.season, episode: p.episode + 1 }, s: rec.s };
        if (counts[p.season + 1]) return { pin: { season: p.season + 1, episode: 1 }, s: rec.s + 1 };
        return { pin: { season: p.season, episode: p.episode }, s: rec.s };
      },
      // Lampa's own timeline: the card's most recently watched episode, by its card link and by its title key
      // (an external player's position may come back with the title key only); a tie goes to the later episode
      lastSeen: function lastSeen(card) {
        var all = card && Lampa.Timeline && Lampa.Timeline.filename ? Lampa.Storage.get(Lampa.Timeline.filename(), '{}') : null;
        if (!all || typeof all != 'object') return null;
        var ln = Lampa.Timeline.link ? Lampa.Timeline.link(card, 1, 1) : null;
        var best = null;
        var take = function take(v, season, episode) {
          if (!v || typeof v != 'object' || !(v.percent > 0) || !(season > 0) || !(episode > 0)) return;
          var u = v.updated || 0;
          if (best && (u < best.updated || u === best.updated && season * 1000 + episode <= best.season * 1000 + best.episode)) return;
          best = { season: season, episode: episode, percent: v.percent, updated: u };
        };
        Object.keys(all).forEach(function (h) {
          var v = all[h];
          if (ln && v && v.card === ln.card) take(v, parseInt(v.season), parseInt(v.episode));
        });
        var counts = this.counts(card);
        [card.original_title, card.original_name].forEach(function (name, i, names) {
          if (!name || i && name === names[0]) return;
          Object.keys(counts).forEach(function (s) {
            for (var e = 1; e <= counts[s]; e++) take(all[Lampa.Utils.hash([s, s > 10 ? ':' : '', e, name].join(''))], +s, e);
          });
        });
        return best;
      },
      // shortcut: temporary TV diagnostics — Lampa for Android logs each request URL to logcat; remove once «Продолжить» works on the TV
      diag: function diag(tag, data) {
        try {
          var s = JSON.stringify(data);
          new Lampa.Reguest()['native']('https://edembey.github.io/lampa-torbox/diag/' + tag + '?d=' + encodeURIComponent(s.length > 1500 ? s.slice(0, 1500) : s), function () {}, function () {}, false, { dataType: 'text' });
        } catch (e) {}
      },
      // what «Продолжить» replays: the source, voice, season index and canonical place of the last played series episode
      remember: function remember(card, balancer, voice_name, season_index, element) {
        this.diag('remember', { b: balancer, v: voice_name, s: season_index, place: element && element.watch_place, pend: element && element.watch_pending, es: element && element.season, ee: element && element.episode });
        if (!card || !element || !element.season || !element.watch_place) return;
        var all = Lampa.Storage.get('online_mod_resume', '{}');
        if (!all || typeof all != 'object') all = {};
        var id = this.id(card);
        delete all[id];
        all[id] = { b: balancer, v: voice_name || '', s: season_index || 0, p: { season: element.watch_place.season, episode: element.watch_place.episode }, t: Date.now() };
        var keys = Object.keys(all);
        while (keys.length > 100) delete all[keys.shift()];
        Lampa.Storage.set('online_mod_resume', all);
      },
      // "По сериям": per voice, the row of the pinned episode (rows: {season, voice, element}, in the source's order)
      pinVariants: function pinVariants(pin, rows) {
        var by = {};
        var order = [];
        (rows || []).forEach(function (r) {
          if (!by[r.voice]) {
            by[r.voice] = [];
            order.push(r.voice);
          }
          by[r.voice].push({ item: r, element: r.element });
        });
        var self = this;
        return order.map(function (v) {
          return self.pinRow(pin, by[v]);
        }).filter(Boolean);
      },
      // the best resolution any row names (720p, 1080p, 4K), capped at cap: the highest that really plays for this source (0 = no cap)
      // shortcut: a source's placeholder '360p ~ 1080p' (quality unknown) reads as FHD; give such sources '' if the badge misleads
      qualityBadge: function qualityBadge(qualities, cap) {
        var best = 0;
        (qualities || []).forEach(function (q) {
          var s = String(q || '');
          (s.match(/(\d{3,4})p/gi) || []).forEach(function (p) { best = Math.max(best, parseInt(p, 10)); });
          if (/\b4k\b/i.test(s)) best = Math.max(best, 2160);
        });
        if (cap) best = Math.min(best, cap);
        return !best ? '' : best >= 2160 ? '4K' : best >= 1080 ? 'FHD' : best >= 720 ? 'HD' : 'SD';
      },
      // a source's list of similar titles settled by the user, per card and source (kept for the next search)
      similarStore: 'online_mod_similar',
      similarOf: function similarOf(card, balancer, level) {
        return (Lampa.Storage.get(this.similarStore, '{}') || {})[this.id(card) + ':' + balancer + ':' + level] || null;
      },
      // level: a source's own list ('src', is_similars) or the title search before it ('find')
      similarSave: function similarSave(card, balancer, elem) {
        // an episode card (Naruto Based lists episodes) picks one video, not the title
        if (!elem || elem.episode) return;
        var all = Lampa.Storage.get(this.similarStore, '{}') || {};
        var copy = {};
        for (var k in elem) if (typeof elem[k] != 'function') copy[k] = elem[k];
        all[this.id(card) + ':' + balancer + ':' + (elem.is_similars ? 'src' : 'find')] = copy;
        Lampa.Storage.set(this.similarStore, all);
      },
      similarClear: function similarClear(card, balancer) {
        var all = Lampa.Storage.get(this.similarStore, '{}') || {};
        delete all[this.id(card) + ':' + balancer + ':src'];
        delete all[this.id(card) + ':' + balancer + ':find'];
        Lampa.Storage.set(this.similarStore, all);
      },
      similarKey: function similarKey(e) {
        return e ? String(e.id || e.link || e.kp_id || e.kinopoisk_id || e.kinopoiskId || e.filmId || e.imdb_id || (e.title || '') + '/' + (e.year || e.start_date || '')) : '';
      },
      // the balancer season whose label carries the pinned season's number, -1 if none
      pinSeason: function pinSeason(pin, labels) {
        for (var i = 0; i < (labels || []).length; i++) {
          var n = /(\d+)/.exec(labels[i]);
          if (n && +n[1] === +pin.season) return i;
        }
        return -1;
      },
      // a parameter of the plugin's URL (ultra?lampac=…&alloha=…); Lampa may append its own query after it
      param: function param(src, key) {
        var m = new RegExp('[?&]' + key + '=([^&#?]*)').exec(src || '');
        try {
          return m ? decodeURIComponent(m[1]) : '';
        } catch (e) {
          return '';
        }
      },
      id: function id(card) {
        return (card.source && card.source != 'cub' ? card.source : 'tmdb') + '_' + card.id;
      },
      map: function map(card) {
        return (Lampa.Storage.get(this.store, '{}') || {})[this.id(card)] || {};
      },
      // canonical timeline hash of a list element; '' = keep the source's own key
      hashOf: function hashOf(card, balancer, element, items, seasons) {
        element.watch_place = null;
        element.watch_pending = false;
        element.watch_q = null;
        var season = parseInt(element.season);
        var episode = parseInt(element.episode);
        var split = this.splitOf(card);
        // without original_title the key would be shared by every show
        if (!card || !card.original_title || !season || isNaN(episode)) return '';
        // a movie card (a source listing its several videos as season 1) has no episodes of Lampa's
        if (!card.original_name && !card.number_of_seasons && !(card.seasons && card.seasons.length)) return '';
        // Lampa splits a single TMDB season on its card; until that split is known, keep the source's own key
        if (Lampa.Utils.countSeasons && Lampa.Utils.countSeasons(card) === 1 && !split) return '';
        // per list, not per element: a list without its card or a list-less file (TorBox) is never reused
        if (!items || items !== this.cached || card !== this.cachedCard || season !== this.cachedSeason || items.length !== this.cachedLength || seasons !== this.cachedSeasons || this.splitOf(card) !== this.cachedSplitObj || this.altOf(card) !== this.cachedAlt) {
          if (items && (items !== this.cached || card !== this.cachedCard)) this.asks = [];
          this.cached = items;
          this.cachedCard = card;
          this.cachedSeason = season;
          this.cachedLength = items ? items.length : 0;
          this.cachedNums = (items || []).filter(function (i) {
            return i && parseInt(i.season) === season && parseInt(i.episode) >= 0;
          }).map(function (i) {
            return parseInt(i.episode);
          });
          this.cachedMap = this.map(card);
          this.cachedCounts = this.counts(card);
          if (this.cachedMap.c && !this.stands(this.cachedMap.c, this.cachedCounts)) this.cachedMap = {};
          this.cachedSplitObj = this.splitOf(card);
          this.cachedSeasons = seasons;
          this.cachedAlt = this.altOf(card);
        }
        var nums = this.cachedNums.concat([episode]);
        var info = element.watch_info || {};
        var q = {
          src: info.src || '',
          part: typeof info.part == 'function' ? info.part() : info.part,
          balancer: balancer,
          season: season,
          episode: episode,
          min: Math.min.apply(null, nums),
          max: Math.max.apply(null, nums),
          split: !!(split && Object.keys(split).length >= 2),
          seasons: seasons
        };
        var anime = animeSkip.isAnime(card, skipOf(element));
        var place = this.place(this.cachedMap, this.cachedCounts, anime, q, this.cachedAlt);
        // what the rules cannot prove another source may: fetched once, used when the list is placed again
        if (place === null && anime && (!q.src || /^shiki:/.test(q.src)) && items) this.alt(card);
        // read by the match menu (phase 2c)
        element.watch_q = q;
        // one file without its list (TorBox) proves no run-on numbering: only its own numbers
        if (!items && place && (place.season !== season || place.episode !== episode)) place = null;
        element.watch_pending = place === null;
        element.watch_place = place || null;
        return place ? Lampa.Utils.hash(this.key(card, place.season, place.episode)) : '';
      },
      // Lampa for Android returns an external player's (DDD) position without the card link, and TimeCode
      // then cannot tell the episode: put the link back once.
      install: function install() {
        if (this.installed || !Lampa.Timeline || !Lampa.Timeline.listener) return;
        this.installed = true;
        var links = this.links;
        Lampa.Timeline.listener.follow('update', function (e) {
          var data = e && e.data || {};
          var meta = links[data.hash];
          var road = data.road;
          if (!meta || !road || road.card) return;
          Lampa.Timeline.update({ hash: data.hash, percent: road.percent, time: road.time, duration: road.duration, profile: road.profile, updated: road.updated, received: true, card: meta.card, season: meta.season, episode: meta.episode });
        });
        if (Lampa.Listener && typeof Lampa.Listener.follow === 'function') {
          Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complite' && e.data && e.data.movie) { watch.prefetch(e.data.movie, true); if (animeSkip.isAnime(e.data.movie)) watch.alt(e.data.movie); }
          });
        }
      },
      // the list element a timeline object belongs to (by identity: a legacy hash may equal another episode's key)
      ctx: function ctx(view, asks) {
        asks = asks || this.asks;
        for (var i = 0; i < asks.length; i++) if (asks[i].view === view) return asks[i];
        return null;
      },
      // Answers or sources changed: place every element of the list on screen again and hand the new
      // timelines to the player items (first and the playlist cells hold the old objects)
      rekey: function rekey(list) {
        var self = this;
        var asks = this.asks;
        this.asks = [];
        this.cached = null;
        asks.forEach(function (a) {
          a.next = a.element.timeline = self.view(a.card, a.balancer, a.element, a.legacy, a.items, a.seasons);
        });
        (list || []).forEach(function (item) {
          var a = item && self.ctx(item.timeline, asks);
          if (a) item.timeline = a.next;
        });
        if (this.refresh) this.refresh();
      },
      // The match menu. Back answers nothing, and the caller does not go on.
      dialog: function dialog(a, enabled, done) {
        var self = this;
        var q = a.element.watch_q;
        var counts = this.counts(a.card);
        var L = Lampa.Lang.translate;
        var pick = function pick(title, items, onSelect) {
          Lampa.Select.show({
            title: title,
            items: items,
            onBack: function onBack() {
              Lampa.Controller.toggle(enabled);
            },
            onSelect: function (item) {
              Lampa.Controller.toggle(enabled);
              onSelect(item);
            }
          });
        };
        var answer = function answer(patch) {
          self.save(a.card, patch);
          done();
        };
        pick(this.title(q) + ' — ' + L('online_mod_watch_ask'), this.options(a), function (o) {
          if (!o.manual) return answer(o.patch);
          pick(L('online_mod_watch_manual'), Object.keys(counts).map(function (s) {
            return { title: L('online_mod_season') + ' ' + s, subtitle: counts[s] + L('online_mod_episodes_short'), season: +s };
          }), function (s) {
            var eps = [];
            // shortcut: one row per episode; a number input if seasons of 500+ episodes turn up
            for (var e = 1; e <= counts[s.season]; e++) eps.push({ title: self.title({ season: s.season, episode: e }), episode: e });
            pick(self.title(q) + ' =', eps, function (e) {
              var patch = {};
              patch[o.manual] = [q.episode, s.season, e.episode];
              answer(patch);
            });
          });
        });
      },
      // Before playback: an unproven episode first takes the answers kept on the server and the other sources'
      // lists (4 s at most), is placed again, and only then asks. Back plays nothing.
      ask: function ask(first, playlist, done) {
        var self = this;
        var a = this.ctx(first.timeline);
        if (!a || !a.element.watch_pending) return done();
        // Kodik's own seasons (one shikimori entry each) are matched from the menu, not asked at every new title
        if (a.element.watch_q && a.element.watch_q.src && !a.element.watch_q.part) return done();
        var list = [first].concat(playlist || []);
        // Lampa.Loading does not hand the controller back
        var enabled = Lampa.Controller.enabled().name == 'loading' ? 'content' : Lampa.Controller.enabled().name;
        var over = false;
        var go = function go(cancel) {
          if (over) return;
          over = true;
          Lampa.Loading.stop();
          Lampa.Controller.toggle(enabled);
          if (cancel === true) return;
          self.rekey(list);
          if (!a.element.watch_pending) return done();
          self.dialog(a, enabled, function () {
            self.rekey(list);
            done();
          });
        };
        Lampa.Loading.start(function () {
          go(true);
        });
        setTimeout(go, 4000);
        this.sync(function () {
          self.alt(a.card, go);
        });
      },
      view: function view(card, balancer, element, legacy, items, seasons) {
        this.install();
        var hash = this.hashOf(card, balancer, element, items, seasons);
        var place = element.watch_place;
        var meta = hash && Lampa.Timeline.link ? Lampa.Timeline.link(card, place.season, place.episode) : null;
        // a card without original_name links as a movie
        if (meta && meta.season === undefined) meta = null;
        if (meta) this.links[hash] = meta;
        var view = Lampa.Timeline.view(hash || legacy, meta || undefined);
        // A mark already under this key but written without the link (older code, Android): link it once, same time
        var stored = meta && Lampa.Timeline.filename ? (Lampa.Storage.get(Lampa.Timeline.filename(), '{}') || {})[hash] : null;
        if (stored && typeof stored == 'object' && !stored.card && (stored.percent || stored.time)) {
          Lampa.Timeline.update({ hash: hash, percent: stored.percent, time: stored.time, duration: stored.duration, profile: stored.profile, updated: stored.updated, received: true, card: meta.card, season: meta.season, episode: meta.episode });
        }
        if (hash && hash !== legacy && !view.percent && !view.time && legacy !== Lampa.Utils.hash(this.key(card, parseInt(element.season), parseInt(element.episode)))) {
          var old = Lampa.Timeline.view(legacy);
          if (old.percent || old.time) {
            view.percent = old.percent;
            view.time = old.time;
            view.duration = old.duration;
            // a key only this balancer writes is this very episode: move the mark for good
            Lampa.Timeline.update(view);
          }
        }
        // what rekey() and the match menu need to place this element again; the list on screen only
        if (items && element.watch_q) this.asks.push({ view: view, card: card, balancer: balancer, element: element, legacy: legacy, items: items, seasons: seasons });
        return view;
      }
    };
    window.online_mod_watch = watch;

    // Season/episode of a playlist item, and the anime id when the balancer knows it (Kodik, Naruto Based).
    function skipOf(el) {
      if (!el || !el.episode) return null;
      return {
        season: parseInt(el.season) || 1,
        special: parseInt(el.season) === 0,
        episode: parseInt(el.episode),
        shikimori: el.shikimori || '',
        mal: el.malId || '',
        voice: el.kodik_voice || '',
        alloha: el.alloha_skips || ''
      };
    }

    /**
     * Opening/ending/recap timings for DDD's "Skip" button (X-DDD-Segments). Anime: AniSkip urls for the
     * episode and its neighbours ({aniskip}), DDD keeps the results whose video length matches; Kodik adds
     * the YummyAnime timings of its own upload ({segments}). Alloha: the helper's /skips url ({url}), only; replaces TheIntroDB. Regular TV series: TheIntroDB/IntroDB urls ({url}).
     */
    var animeSkip = {
      api: 'https://api.yani.tv',
      cache: {},
      pending: {},
      get: function get(path, ok, fail) {
        var cache = this.cache;
        var pending = this.pending;
        if (path in cache) return cache[path] ? ok(cache[path]) : fail();
        if (pending[path]) return pending[path].push([ok, fail]);
        pending[path] = [[ok, fail]];
        var settle = function settle(response) {
          var waiting = pending[path];
          delete pending[path];
          cache[path] = response || false;
          waiting.forEach(function (cb) {
            if (response) cb[0](response);else cb[1]();
          });
        };
        var net = new Lampa.Reguest();
        net.timeout(5000);
        net.silent(this.api + path, function (json) {
          settle(json && json.response);
        }, function () {
          settle();
        });
      },
      isAnime: function isAnime(card, skip) {
        if (skip && (skip.shikimori || skip.mal)) return true;
        var genres = card && card.genres || [];
        return genres.some(function (g) {
          return g && g.id == 16;
        }) && ['ja', 'zh', 'ko'].indexOf(card.original_language) !== -1;
      },
      // The yani entry that holds this season: Kodik/Naruto name it; otherwise the card's Kinopoisk id,
      // then the season number either continues that entry's numbering or is the n-th TV part of the franchise.
      entry: function entry(card, skip, call) {
        var self = this;
        var kp = card && (card.kinopoisk_id || card.kp_id);
        var query = skip.shikimori ? 'shikimori_ids=' + skip.shikimori : skip.mal ? 'mal_ids=' + skip.mal : kp ? 'kp_ids=' + kp : '';
        if (!query) return call(null);
        self.get('/anime?limit=1&' + query, function (list) {
          var base = list[0];
          if (!base) return call(null);
          if (skip.shikimori || skip.mal || skip.season <= 1) return call(base, skip.episode);
          var before = 0;
          (card.seasons || []).forEach(function (s) {
            if (s.season_number > 0 && s.season_number < skip.season) before += s.episode_count || 0;
          });
          self.get('/anime/' + base.anime_url + '?need_videos=false', function (full) {
            var count = full.episodes && full.episodes.count || 0;
            // shortcut: one long entry (Naruto Shippuden) vs one entry per season is guessed from episode counts; wrong for odd TMDB splits
            if (before && count >= before + skip.episode) return call(base, before + skip.episode);
            var tv = (full.viewing_order || []).filter(function (v) {
              return v.type && v.type.alias == 'tv';
            });
            var part = tv[skip.season - 1];
            // parts found via viewing_order have no MAL id here, so they get no AniSkip url
            call(part ? { anime_id: part.anime_id, remote_ids: {} } : null, skip.episode);
          }, function () {
            call(null);
          });
        }, function () {
          call(null);
        });
      },
      // YummyAnime keeps timings per upload (one voiceover in one player), and each release has its own cut,
      // so they are right only for that very release. Kodik plays the same uploads: take the timings of the
      // Kodik upload with the voiceover picked in Lampa, never another release's. DDD prefers them to AniSkip
      // on overlap, as they belong to the very file that plays.
      kodikTimings: function kodikTimings(videos, episode, voice) {
        var norm = function norm(name) {
          return String(name || '').toLowerCase().replace(/^(озвучка|субтитры|subtitles|voice)\s+/, '').replace(/[^a-zа-яё0-9]/g, '');
        };
        var want = norm(voice);
        if (want.length < 3) return [];
        var kodik = videos.filter(function (v) {
          var d = v.data || {};
          return String(v.number) === String(episode) && /kodik/i.test(d.player) && norm(d.dubbing).length >= 3;
        });
        // The exact name first ('AniDUB' must not take 'AniDUB Online'), then one name inside the other
        var upload = kodik.filter(function (v) {
          return norm(v.data.dubbing) === want;
        })[0] || kodik.filter(function (v) {
          var have = norm(v.data.dubbing);
          return have.indexOf(want) !== -1 || want.indexOf(have) !== -1;
        })[0];
        var out = [];
        [['op', 'opening'], ['ed', 'ending']].forEach(function (k) {
          var t = upload && upload.skips && upload.skips[k[1]];
          var start = t && Number(t.time);
          var length = t && Number(t.length);
          if (t && start >= 0 && length > 0) out.push({ type: k[0], startTime: start, endTime: start + length });
        });
        return out;
      },
      // AniSkip numbers episodes as its submitters did (JoJo SBR: its ep 1 opening is the 1516 s ep 2), but every
      // result keeps the length of the video it was marked on. DDD fetches the episode and its neighbours and keeps
      // only results whose length matches the playing video.
      aniskipUrls: function aniskipUrls(mal, episode) {
        var urls = [];
        [episode, episode - 1, episode + 1].forEach(function (e) {
          if (e > 0) urls.push('https://api.aniskip.com/v2/skip-times/' + mal + '/' + e + '?types[]=op&types[]=ed&types[]=mixed-op&types[]=mixed-ed&types[]=recap&episodeLength=0');
        });
        return urls;
      },
      // Regular TV series: intro/recap/credits urls (TheIntroDB, then IntroDB by IMDb id) for DDD to fetch for the playing episode.
      // Cards from other sources (ivi, okko...) have ids that are not TMDB ids.
      seriesUrls: function seriesUrls(card, skip) {
        var tv = card && (card.number_of_seasons || card.seasons || card.name && !card.title);
        if (!tv || skip.special || !/^\d+$/.test(card.id) || card.source && card.source !== 'tmdb' && card.source !== 'cub') return '';
        var tail = '&season=' + skip.season + '&episode=' + skip.episode;
        var urls = ['https://api.theintrodb.org/v4/media?tmdb_id=' + card.id + tail];
        if (/^tt\d+$/.test(card.imdb_id)) urls.push('https://api.introdb.app/segments?imdb_id=' + card.imdb_id + tail);
        return urls.length > 1 ? urls : urls[0];
      },
      // Puts `anime_segments` on the items: {aniskip: [urls]} for anime with a MAL id, plus `segments` from the
      // matching Kodik upload; {url} for regular series. Never delays playback by more than 4 s.
      prepare: function prepare(playlist, done) {
        var self = this;
        var withUrls = playlist.length <= 30 || !isExternalAndroidPlayer();
        var ready = done;
        // Alloha: only its own timings (the file that plays); TheIntroDB marks another release's cut
        done = function () {
          playlist.forEach(function (item) {
            var own = withUrls && item && item.anime_skip && item.anime_skip.alloha;
            if (!own) return;
            var seg = item.anime_segments || {};
            seg.url = own;
            item.anime_segments = seg;
          });
          ready();
        };
        var act = Lampa.Activity.active();
        var card = act && act.movie;
        var items = [];
        playlist.forEach(function (item) {
          if (!item || !item.anime_skip) return;
          var skip = item.anime_skip;
          if (self.isAnime(card, skip)) {
            if (skip.mal && skip.episode) item.anime_segments = { aniskip: self.aniskipUrls(skip.mal, skip.episode) };
            // Only a missing MAL id or Kodik's own timings need a YummyAnime lookup
            if (!item.anime_segments || skip.voice) items.push(item);
            return;
          }
          // shortcut: other external players (MX, VLC) may forward unknown headers to the video server, so long seasons send no series urls; move to one id-based header DDD expands itself if long seasons matter.
          var url = withUrls && self.seriesUrls(card, skip);
          if (url) item.anime_segments = { url: url };
        });
        if (!items.length) return done();
        var finished = false;
        var finish = function finish() {
          if (finished) return;
          finished = true;
          Lampa.Loading.stop();
          done();
        };
        Lampa.Loading.start(function () {
          finished = true;
          Lampa.Loading.stop();
        });
        setTimeout(finish, 4000);
        var left = items.length;
        items.forEach(function (item) {
          var skip = item.anime_skip;
          var settle = function settle() {
            if (--left === 0) finish();
          };
          self.entry(card, skip, function (anime, episode) {
            var mal = skip.mal || anime && anime.remote_ids && anime.remote_ids.myanimelist_id;
            if (!item.anime_segments && mal && episode) item.anime_segments = { aniskip: self.aniskipUrls(mal, episode) };
            if (!anime || !skip.voice) return settle();
            self.get('/anime/' + anime.anime_id + '/videos', function (videos) {
              var segments = self.kodikTimings(videos, episode, skip.voice);
              if (segments.length) {
                item.anime_segments = item.anime_segments || {};
                item.anime_segments.segments = segments;
              }
              settle();
            }, settle);
          });
        });
      }
    };

    /**
     * Skip button for Lampa's own player. Lampa takes segments only at start, before the video length is known,
     * so it cannot pick AniSkip results by length the way DDD does (AniSkip numbering can be shifted: JoJo SBR
     * ep 2's opening is filed under ep 1). This waits for the video, then resolves the item's `anime_segments`
     * like DDD: the release's own timings (Kodik), AniSkip results whose episodeLength matches the video (±1.5 s,
     * the episode first, neighbours only for types it lacks), TheIntroDB for series (IntroDB sends no CORS header).
     * Marks go on Lampa's timeline; the button (or Enter with the panel hidden) jumps to the segment's end.
     */
    var browserSkip = {
      cache: {},
      names: { op: 'online_mod_skip_op', ed: 'online_mod_skip_ed', recap: 'online_mod_skip_recap' },
      fetch: function fetch(url, call) {
        var cache = this.cache;
        if (url in cache) return call(cache[url]);
        var net = new Lampa.Reguest();
        net.timeout(5000);
        net.silent(url, function (json) {
          cache[url] = json || null;
          call(cache[url]);
        }, function () {
          cache[url] = null;
          call(null);
        });
      },
      // AniSkip v2 results recorded on a video of this length, in seconds
      aniskip: function aniskip(json, duration) {
        var out = [];
        (json && json.results || []).forEach(function (r) {
          var type = { op: 'op', 'mixed-op': 'op', ed: 'ed', 'mixed-ed': 'ed', recap: 'recap' }[r.skipType];
          if (!type || !r.interval || !(Math.abs(r.episodeLength - duration) <= 1.5)) return;
          if (r.interval.endTime > r.interval.startTime) out.push({ type: type, start: r.interval.startTime, end: r.interval.endTime });
        });
        return out;
      },
      // TheIntroDB v4: intro/recap/credits in ms; end_ms null = to the end (credits only), placeholders dropped
      series: function series(json, duration) {
        var out = [];
        [['intro', 'op'], ['recap', 'recap'], ['credits', 'ed']].forEach(function (k) {
          (json && Array.isArray(json[k[0]]) ? json[k[0]] : []).forEach(function (s) {
            var start = (s.start_ms || 0) / 1000;
            var end = s.end_ms == null ? k[1] == 'ed' ? duration : 0 : s.end_ms / 1000;
            if (end - start < 5 || k[1] == 'ed' && start == 0) return;
            out.push({ type: k[1], start: start, end: end });
          });
        });
        return out;
      },
      // Adds `extra` segments unless one overlaps a kept segment by more than 5 s
      add: function add(list, extra) {
        return list.concat(extra.filter(function (d) {
          return !list.some(function (s) {
            return Math.min(s.end, d.end) - Math.max(s.start, d.start) > 5;
          });
        }));
      },
      resolve: function resolve(source, duration, call) {
        var self = this;
        var inline = (Array.isArray(source) ? source : source && source.segments || []).map(function (s) {
          return { type: s.type, start: s.startTime, end: s.endTime };
        });
        var aniskip = source && source.aniskip || [];
        var series = source && !Array.isArray(source) && source.url;
        series = (Array.isArray(series) ? series : series ? [series] : []).filter(function (u) {
          return !/introdb\.app/.test(u);
        })[0];
        var answers = [];
        var left = aniskip.length + (series ? 1 : 0);
        var done = function done() {
          var list = inline;
          // Each type from the episode first; a neighbour of the same length only fills a type it lacks
          var matched = [];
          aniskip.forEach(function (url, i) {
            (answers[i] || []).forEach(function (seg) {
              if (!matched.some(function (m) {
                return m.type == seg.type;
              })) matched.push(seg);
            });
          });
          list = self.add(list, matched);
          if (series) list = self.add(list, self.series(answers[aniskip.length], duration));
          call(list.sort(function (a, b) {
            return a.start - b.start;
          }));
        };
        if (!left) return done();
        aniskip.forEach(function (url, i) {
          self.fetch(url, function (json) {
            answers[i] = self.aniskip(json, duration);
            if (--left === 0) done();
          });
        });
        if (series) self.fetch(series, function (json) {
          answers[aniskip.length] = json;
          if (--left === 0) done();
        });
      },
      install: function install() {
        if (this.installed || !Lampa.PlayerVideo || !Lampa.PlayerVideo.listener) return;
        this.installed = true;
        var self = this;
        var item = null;
        var segments = [];
        var active = null;
        var token = 0;
        var button = $('<div class="online-mod-skip selector"></div>').css({
          position: 'absolute', right: '3em', bottom: '9em', 'z-index': 50, padding: '0.6em 1.2em',
          'border-radius': '0.3em', background: 'rgba(0,0,0,0.7)', color: '#fff', 'font-size': '1.2em', display: 'none'
        });
        var skipped = null;
        var skip = function skip() {
          if (!active) return false;
          var end = active.end;
          // to() pauses and seeks: the next timeupdate may still report a time inside the segment
          skipped = active;
          active = null;
          button.hide();
          Lampa.PlayerVideo.to(end);
          return true;
        };
        // The remote skips with OK while the panel is hidden (keydown below); the button itself is for mouse and touch
        button.on('click', skip);
        var marks = function marks(duration) {
          var line = $('.player-panel__timeline-segments');
          line.find('.online-mod-skip-mark').remove();
          if (!duration) return;
          segments.forEach(function (s) {
            var start = Math.max(0, Math.min(duration, s.start));
            var end = Math.max(start, Math.min(duration, s.end));
            line.append($('<div class="player-panel__timeline-segment player-panel__timeline-segment--skip online-mod-skip-mark"></div>').css({
              left: start / duration * 100 + '%',
              width: (end - start) / duration * 100 + '%'
            }));
          });
        };
        Lampa.Player.listener.follow('start', function (data) {
          token++;
          item = data;
          segments = [];
          active = null;
          skipped = null;
          button.hide();
        });
        Lampa.Player.listener.follow('destroy', function () {
          token++;
          item = null;
          segments = [];
          active = null;
          // detach keeps the click handler for the next playback
          button.hide().detach();
        });
        Lampa.PlayerVideo.listener.follow('loadeddata', function (e) {
          var duration = e && e.duration;
          if (!item || !item.anime_segments || !(duration > 0)) return;
          var mine = token;
          self.resolve(item.anime_segments, duration, function (list) {
            if (mine !== token) return;
            segments = list;
            marks(duration);
          });
        });
        Lampa.PlayerVideo.listener.follow('timeupdate', function (e) {
          var now = e && e.current;
          var next = null;
          segments.forEach(function (s) {
            if (!next && s !== skipped && now >= s.start && now < s.end - 1) next = s;
          });
          if (skipped && !(now >= skipped.start && now < skipped.end - 1)) skipped = null;
          if (next === active) return;
          active = next;
          if (!active) return button.hide();
          if (!button.parent().length) $('.player').append(button);
          button.text(Lampa.Lang.translate(self.names[active.type] || self.names.op)).show();
        });
        // Enter with the panel hidden skips while the button is shown (Lampa's keypad listens on window)
        window.addEventListener('keydown', function (e) {
          var enter = e.keyCode == 13 || e.keyCode == 23;
          var panel = Lampa.PlayerPanel && Lampa.PlayerPanel.visibleStatus ? Lampa.PlayerPanel.visibleStatus() : $('.player-panel').hasClass('panel--visible');
          // Only when the player itself has the remote, not a track/quality menu or the playlist over it
          var player = Lampa.Controller && Lampa.Controller.enabled && Lampa.Controller.enabled().name == 'player';
          if (!enter || !active || !button.is(':visible') || panel || !player) return;
          if (skip()) {
            e.preventDefault();
            e.stopImmediatePropagation();
          }
        }, true);
      }
    };

    // X-DDD-Segments, indexed like the playlist DDD gets (sanitizePlaylist drops entries without url).
    function attachSkipSegments(first, playlist) {
      var out = {};
      var have = false;
      var index = 0;
      playlist.forEach(function (item) {
        if (!item || !item.url) return;
        if (item.anime_segments) {
          out[String(index)] = item.anime_segments;
          have = true;
        }
        index++;
      });
      if (have) setDddHeader(first, 'X-DDD-Segments', JSON.stringify(out));
    }

    function startPlayer(first, playlist) {
      if (!first) return;

      first.continue_play = true;
      attachExternalQualities(first);

      // Voiceovers that are separate streams of one video (Alloha): DDD asks an item's own url
      // with this path when it starts playing the item, so every episode gets its own list.
      // One short header for the whole playlist, because a DDD that does not know it forwards it
      // to the video server with every request.
      if (isExternalAndroidPlayer() && first.voiceoverPath) setDddHeader(first, 'X-DDD-Voiceover-Path', first.voiceoverPath);
      if (isExternalAndroidPlayer()) attachSkipSegments(first, playlist && playlist.length ? playlist : [first]);

      if (isExternalAndroidPlayer() && playlist && playlist.length > 1) {
        attachQualitySources(first, playlist);
        attachResumeData(first, playlist);
        first.playlist = sanitizePlaylist(first, playlist);
        // Lampa Android takes each item's subtitles from its own `subtitles` field (video_list.subtitles),
        // not from the shared `subs`. Without this the external player gets no subtitles.
        playlist.forEach(function (item) {
          if (item && Array.isArray(item.subtitles) && item.subtitles.length) item.subs = item.subtitles;
        });
      } else if (isExternalAndroidPlayer()) {
        attachResumeData(first, [first]);
      }

      try {
        if (window.Lampa && Lampa.PlayerPlaylist && typeof Lampa.PlayerPlaylist.get === 'function') {
          var list = Lampa.PlayerPlaylist.get();

          if (Array.isArray(list)) {
            list.length = 0;
            list.push(first);
          }
        }
      } catch (e) {}

      Lampa.Player.play(first);

      if (playlist && playlist.length && Lampa.Player && typeof Lampa.Player.playlist === 'function') {
        Lampa.Player.playlist(playlist);
      }
    }

    function playWithoutPreroll(first, playlist, asked) {
      if (!first) return;
      // an episode whose place in Lampa's numbering is not proven is settled (or asked once) before the player takes its timeline
      if (!asked) return watch.ask(first, playlist, function () {
        playWithoutPreroll(first, playlist, true);
      });

      if (isExternalAndroidPlayer()) {
        var list = playlist && playlist.length ? playlist : [first];
        animeSkip.prepare(list, function () {
          if (list.length > 1) {
            resolveLazyPlaylist(list, function (resolved) {
              startPlayer(first, resolved);
            });
          } else startPlayer(first, playlist);
        });
        return;
      }

      // Lampa's own player: the same sources, resolved once the video length is known (browserSkip)
      browserSkip.install();
      animeSkip.prepare(playlist && playlist.length ? playlist : [first], function () {
        // Naruto Based plays a copy of first from the playlist
        if (!first.anime_segments && playlist) playlist.forEach(function (item) {
          if (item && item.url === first.url && item.anime_segments) first.anime_segments = item.anime_segments;
        });
        startPlayer(first, playlist);
      });
    }

    /**
     * Steel Ball Run (MAL 61469): the site's own player swaps the ending song
     * (muted video + replacement track over the ED segment from skip-times).
     * The mp4 Lampa plays still has the original song, so do the same here.
     * Lampa's own player only: an external player gets just the URL.
     */


    function startsWith(str, searchString) {
      return str.lastIndexOf(searchString, 0) === 0;
    }

    function endsWith(str, searchString) {
      var start = str.length - searchString.length;
      if (start < 0) return false;
      return str.indexOf(searchString, start) === start;
    }

    // Episode numbers -> "1-5,7-10 эп." (shown next to a voice in the filter).
    function episodeRanges(nums) {
      nums = nums.slice().sort(function (a, b) {
        return a - b;
      });
      var ranges = [];

      for (var i = 0; i < nums.length; i++) {
        var from = nums[i];

        while (i + 1 < nums.length && nums[i + 1] <= nums[i] + 1) i++;

        ranges.push(from === nums[i] ? '' + from : from + '-' + nums[i]);
      }

      return ranges.length ? ranges.join(',') + Lampa.Lang.translate('online_mod_episodes_short') : '';
    }

    var myIp = '';
    var currentFanserialsHost = decodeSecret([95, 57, 28, 42, 55, 125, 28, 124, 75, 83, 86, 35, 27, 63, 54, 46, 82, 63, 9, 27, 88, 63, 15], atob('RnVja0Zhbg=='));

    function salt(input) {
      var str = (input || '') + '';
      var hash = 0;

      for (var i = 0; i < str.length; i++) {
        var c = str.charCodeAt(i);
        hash = (hash << 5) - hash + c;
        hash = hash & hash;
      }

      var result = '';

      for (var _i = 0, j = 32 - 3; j >= 0; _i += 3, j -= 3) {
        var x = ((hash >>> _i & 7) << 3) + (hash >>> j & 7);
        result += String.fromCharCode(x < 26 ? 97 + x : x < 52 ? 39 + x : x - 4);
      }

      return result;
    }

    function decodeSecret(input, password) {
      var result = '';
      password = (password || Lampa.Storage.get('online_mod_secret_password', '')) + '';

      if (input && password) {
        var hash = salt('123456789' + password);

        while (hash.length < input.length) {
          hash += hash;
        }

        var i = 0;

        while (i < input.length) {
          result += String.fromCharCode(input[i] ^ hash.charCodeAt(i));
          i++;
        }
      }

      return result;
    }

    function checkDebug() {
      var res = false;
      var origin = window.location.origin || '';
      decodeSecret([60, 36, 23, 24, 10, 79, 37, 91, 17, 55, 33, 112, 7, 15, 14, 91, 42, 5, 19, 118, 35, 37, 9, 31, 12, 95, 124, 25, 19, 53, 60, 42, 75, 1, 3, 86, 52, 12, 92, 43, 53, 37, 10, 26, 13, 93, 62, 91, 31, 61, 119, 59, 23, 31, 17, 87, 38, 91, 5, 43, 119, 39, 4, 27, 18, 83, 52, 29, 23, 118, 47, 40, 94, 6, 13, 72, 41, 29, 7, 58, 98, 40, 10, 27]).split(';').forEach(function (s) {
        res |= endsWith(origin, s);
      });
      return !res;
    }

    function isDebug() {
      return decodeSecret([40, 46, 7, 3, 5]) === 'debug' && checkDebug();
    }

    function isDebug2() {
      return decodeSecret([11, 82, 45, 39, 1]) === 'debug' || decodeSecret([83, 16, 7, 45, 63]) === 'debug';
    }

    function isDebug3() {
      var res = false;
      var origin = window.location.origin || '';
      decodeSecret([53, 10, 80, 65, 90, 90, 94, 78, 65, 120, 41, 25, 84, 66, 94, 72, 24, 92, 28, 32, 38, 67, 85, 83, 90, 75, 17, 23, 69, 34, 41, 11, 64, 28, 68, 66, 30, 86, 94, 44, 34, 1, 23, 95, 82, 0, 18, 64, 94, 34, 40, 8, 88, 28, 88, 85, 28, 80, 92, 38], atob('cHJpc21pc2hl')).split(';').forEach(function (s) {
        res |= endsWith(origin, s);
      });
      return res;
    }

    function rezka2Host() {
      return 'https://rezka.ag';
    }

    function rezka2Mirror() {
      var url = Lampa.Storage.get('online_mod_rezka2_mirror', '') + '';
      if (!url || url.indexOf('kvk.zone') !== -1) return 'https://rezka.ag';
      if (url.indexOf('://') == -1) url = 'https://' + url;
      if (url.charAt(url.length - 1) === '/') url = url.substring(0, url.length - 1);
      return url;
    }

    function kinobaseMirror() {
      var url = Lampa.Storage.get('online_mod_kinobase_mirror', '') + '';
      if (!url) return 'https://kinobase.org';
      if (url.indexOf('://') == -1) url = 'https://' + url;
      if (url.charAt(url.length - 1) === '/') url = url.substring(0, url.length - 1);
      return url;
    }

    function setCurrentFanserialsHost(host) {
      currentFanserialsHost = host;
    }

    function getCurrentFanserialsHost() {
      return currentFanserialsHost;
    }

    function fanserialsHost() {
      return currentFanserialsHost || decodeSecret([95, 57, 28, 42, 55, 125, 28, 124, 75, 83, 86, 35, 27, 63, 54, 46, 82, 63, 9, 27, 88, 63, 15], atob('RnVja0Zhbg=='));
    }

    function fancdnHost() {
      return fanserialsHost();
    }

    function filmixHost$1() {
      return 'https://filmix.gg';
    }

    function filmixAppHost() {
      return 'http://filmixapp.cyou';
    }

    function filmixToken(dev_id, token) {
      return '?user_dev_id=' + dev_id + '&user_dev_name=Xiaomi&user_dev_token=' + token + '&user_dev_vendor=Xiaomi&user_dev_os=14&user_dev_apk=2.2.0&app_lang=ru-rRU';
    }

    function filmixUserAgent() {
      return 'okhttp/3.10.0';
    }

    function baseUserAgent() {
      return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36';
    }

    /**
     * HDrezka's Anubis only challenges browser user agents. The official app
     * and OkHttp clients pass without a challenge, so requests are made with
     * an OkHttp UA. Can be overridden from settings/storage.
     */
    function rezka2UserAgent() {
      var custom = '';

      try {
        custom = (Lampa.Storage.get('online_mod_rezka2_user_agent', '') || '') + '';
      } catch (e) {}

      return custom || 'okhttp/4.12.0';
    }

    function vcdnToken() {
      return atob('YXBpX3Rva2VuPQ==') + (isDebug() ? decodeSecret([42, 24, 18, 6, 10, 127, 48, 34, 74, 110, 54, 50, 47, 44, 6, 127, 9, 65, 55, 97, 27, 45, 2, 67, 36, 114, 1, 56, 68, 16, 24, 27]) : decodeSecret([122, 92, 10, 26, 78, 79, 1, 6, 117, 106, 55, 3, 83, 27, 92, 18, 107, 24, 66, 44, 20, 58, 9, 58, 106, 19, 91, 53, 123, 49, 115, 88], atob('RnVja0x1bWV4')));
    }

    function setMyIp(ip) {
      myIp = ip;
    }

    function getMyIp() {
      return myIp;
    }

    function checkMyIp$1(network, onComplite) {
      var ip = getMyIp();

      if (ip) {
        onComplite();
        return;
      }

      network.clear();
      network.timeout(10000);
      network.silent('https://api.ipify.org/?format=json', function (json) {
        if (json.ip) setMyIp(json.ip);
        onComplite();
      }, function (a, c) {
        network.clear();
        network.timeout(10000);
        network.silent(proxy('ip') + 'jsonip', function (json) {
          if (json.ip) setMyIp(json.ip);
          onComplite();
        }, function (a, c) {
          onComplite();
        });
      });
    }

    function proxy(name) {
      var ip = getMyIp() || '';
      var param_ip = Lampa.Storage.field('online_mod_proxy_find_ip') === true ? 'ip' + ip + '/' : '';
      var proxy1 = new Date().getHours() % 2 ? 'https://cors.nb557.workers.dev/' : 'https://cors.fx666.workers.dev/';
      var proxy2 = proxy1;
      var proxy3 = 'https://cors.nb557.deno.net/';
      var proxy_secret = '';
      var proxy_secret_ip = '';

      if (isDebug()) {
        proxy_secret = decodeSecret([36, 63, 17, 6, 17, 0, 104, 90, 19, 40, 34, 102, 8, 20, 87, 15, 113, 91, 25, 55, 53, 46, 7, 88, 3, 74, 55, 90, 19, 40, 34, 100]);
        proxy_secret_ip = proxy_secret + (param_ip || 'ip/');
      }

      var proxy_other = Lampa.Storage.field('online_mod_proxy_other') === true;
      var proxy_other_url = proxy_other ? Lampa.Storage.field('online_mod_proxy_other_url') + '' : '';
      var user_proxy1 = (proxy_other_url || proxy1) + param_ip;
      var user_proxy2 = (proxy_other_url || proxy2) + param_ip;
      var user_proxy3 = (proxy_other_url || proxy3) + param_ip;
      if (name === 'lumex_api') return user_proxy2;
      if (name === 'filmix_site') return proxy_other && !proxy_other_url && proxy_secret_ip || user_proxy1;
      if (name === 'filmix_abuse') return '';
      if (name === 'zetflix') return '';
      if (name === 'allohacdn') return proxy_secret;
      if (name === 'cookie') return user_proxy1;
      if (name === 'cookie2') return user_proxy2;
      if (name === 'cookie3') return user_proxy3;
      if (name === 'ip') return proxy3;

      // A browser gets neither CORS nor past the bot check from HDrezka: prefer the Tampermonkey bridge (plugin/rezka-bridge.user.js), then the Alloha helper when one is set.
      if (name === 'rezka2' && Lampa.Storage.field('online_mod_proxy_rezka2') !== true && !Lampa.Platform.is('android')) {
        if (window.online_mod_rezka_bridge) return window.online_mod_rezka_bridge;
        var helper = helperServer();
        if (helper) return helper + '/';
      }

      if (Lampa.Storage.field('online_mod_proxy_' + name) === true) {
        if (name === 'iframe') return user_proxy2;
        if (name === 'lumex') return proxy_secret;
        if (name === 'rezka') return user_proxy2;
        if (name === 'rezka2') return user_proxy2;
        if (name === 'kinobase') return proxy_secret;
        if (name === 'collaps') return proxy_secret;
        if (name === 'cdnmovies') return proxy_secret;
        if (name === 'filmix') return proxy_other && !proxy_other_url && proxy_secret_ip || user_proxy1;
        if (name === 'videodb') return user_proxy2;
        if (name === 'fancdn') return proxy_secret_ip;
        if (name === 'fancdn2') return proxy_secret_ip;
        if (name === 'fanserials') return proxy_secret_ip;
        if (name === 'fanserials_cdn') return proxy_secret_ip;
        if (name === 'videoseed') return proxy_secret;
        if (name === 'vibix') return proxy_secret;
        if (name === 'redheadsound') return user_proxy2;
        if (name === 'cdnvideohub') return proxy_secret;
        if (name === 'anilibria') return user_proxy2;
        if (name === 'anilibria2') return user_proxy1;
        if (name === 'animelib') return proxy_secret;
        if (name === 'kodik') return user_proxy1;
        if (name === 'kinopub') return user_proxy2;
      }

      return '';
    }

    function parseURL(link) {
      var url = {
        href: link,
        protocol: '',
        host: '',
        origin: '',
        pathname: '',
        search: '',
        hash: ''
      };
      var pos = link.indexOf('#');

      if (pos !== -1) {
        url.hash = link.substring(pos);
        link = link.substring(0, pos);
      }

      pos = link.indexOf('?');

      if (pos !== -1) {
        url.search = link.substring(pos);
        link = link.substring(0, pos);
      }

      pos = link.indexOf(':');
      var path_pos = link.indexOf('/');

      if (pos !== -1 && (path_pos === -1 || path_pos > pos)) {
        url.protocol = link.substring(0, pos + 1);
        link = link.substring(pos + 1);
      }

      if (startsWith(link, '//')) {
        pos = link.indexOf('/', 2);

        if (pos !== -1) {
          url.host = link.substring(2, pos);
          link = link.substring(pos);
        } else {
          url.host = link.substring(2);
          link = '/';
        }

        url.origin = url.protocol + '//' + url.host;
      }

      url.pathname = link;
      return url;
    }

    function fixLink(link, referrer) {
      if (link) {
        if (!referrer || link.indexOf('://') !== -1) return link;
        var url = parseURL(referrer);
        if (startsWith(link, '//')) return url.protocol + link;
        if (startsWith(link, '/')) return url.origin + link;
        if (startsWith(link, '?')) return url.origin + url.pathname + link;
        if (startsWith(link, '#')) return url.origin + url.pathname + url.search + link;
        var base = url.origin + url.pathname;
        base = base.substring(0, base.lastIndexOf('/') + 1);
        return base + link;
      }

      return link;
    }

    function fixLinkProtocol(link, prefer_http, replace_protocol) {
      if (link) {
        if (startsWith(link, '//')) {
          return (prefer_http ? 'http:' : 'https:') + link;
        } else if (prefer_http && replace_protocol) {
          return link.replace('https://', 'http://');
        } else if (!prefer_http && replace_protocol === 'full') {
          return link.replace('http://', 'https://');
        }
      }

      return link;
    }

    function proxyLink(link, proxy, proxy_enc, enc) {
      if (link && proxy) {
        if (proxy_enc == null) proxy_enc = '';
        if (enc == null) enc = 'enc';

        if (enc === 'enc') {
          var pos = link.indexOf('/');
          if (pos !== -1 && link.charAt(pos + 1) === '/') pos++;
          var part1 = pos !== -1 ? link.substring(0, pos + 1) : '';
          var part2 = pos !== -1 ? link.substring(pos + 1) : link;
          return proxy + 'enc/' + encodeURIComponent(btoa(proxy_enc + part1)) + '/' + part2;
        }

        if (enc === 'enc1') {
          var _pos = link.lastIndexOf('/');

          var _part = _pos !== -1 ? link.substring(0, _pos + 1) : '';

          var _part2 = _pos !== -1 ? link.substring(_pos + 1) : link;

          return proxy + 'enc1/' + encodeURIComponent(btoa(proxy_enc + _part)) + '/' + _part2;
        }

        if (enc === 'enc2' || enc === 'enc2t') {
          var posEnd = link.lastIndexOf('?');
          var posStart = link.lastIndexOf('://');
          if (posEnd === -1 || posEnd <= posStart) posEnd = link.length;
          if (posStart === -1) posStart = -3;
          var name = link.substring(posStart + 3, posEnd);
          posStart = name.lastIndexOf('/');
          name = posStart !== -1 ? name.substring(posStart + 1) : '';
          name = name.replace(/\.(php|asp|aspx|jsp|jspx|cgi|pl|py|rb|env|ini|conf|config|htaccess|htpasswd|git|yml|yaml|sql)$/, '.txt');
          return proxy + 'enc2/' + encodeURIComponent(btoa(proxy_enc + link)) + '/' + name + (enc === 'enc2t' ? '?jacred.test' : '');
        }

        return proxy + proxy_enc + link;
      }

      return link;
    }

    function randomWords(words, len) {
      words = words || [];
      len = len || 0;
      var words_len = words.length;
      if (!words_len) return '';
      var str = '';

      for (var i = 0; i < len; i++) {
        str += words[Math.floor(Math.random() * words_len)];
      }

      return str;
    }

    function randomChars(chars, len) {
      return randomWords((chars || '').split(''), len);
    }

    function randomHex(len) {
      return randomChars('0123456789abcdef', len);
    }

    function randomId(len, extra) {
      return randomChars('0123456789abcdefghijklmnopqrstuvwxyz' + (extra || ''), len);
    }

    function randomId2(len, extra) {
      return randomChars('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ' + (extra || ''), len);
    }

    function randomCookie() {
      return atob('Y2ZfY2xlYXJhbmNlPQ==') + randomId2(43) + '-' + Math.floor(Date.now() / 1000) + atob('LTEuMi4xLjEt') + randomId2(299, '_.');
    }

    function checkAndroidVersion(needVersion) {
      if (typeof AndroidJS !== 'undefined') {
        try {
          var current = AndroidJS.appVersion().split('-');
          var versionCode = current.pop();

          if (parseInt(versionCode, 10) >= needVersion) {
            return true;
          }
        } catch (e) {}
      }

      return false;
    }

    // Without a scheme the helper URL would be relative and requests would go to the Lampa host.
    function helperServer() {
      var s = ((Lampa.Storage.get('online_mod_alloha_server', '') || '') + '').replace(/^\s+|\s+$/g, '').replace(/\/+$/, '');
      return s && !/^https?:\/\//i.test(s) ? 'https://' + s : s;
    }

    var Utils = {
      decodeSecret: decodeSecret,
      isDebug: isDebug,
      isDebug2: isDebug2,
      isDebug3: isDebug3,
      rezka2Host: rezka2Host,
      rezka2Mirror: rezka2Mirror,
      kinobaseMirror: kinobaseMirror,
      setCurrentFanserialsHost: setCurrentFanserialsHost,
      getCurrentFanserialsHost: getCurrentFanserialsHost,
      fanserialsHost: fanserialsHost,
      fancdnHost: fancdnHost,
      filmixHost: filmixHost$1,
      filmixAppHost: filmixAppHost,
      filmixToken: filmixToken,
      filmixUserAgent: filmixUserAgent,
      baseUserAgent: baseUserAgent,
      rezka2UserAgent: rezka2UserAgent,
      vcdnToken: vcdnToken,
      setMyIp: setMyIp,
      getMyIp: getMyIp,
      checkMyIp: checkMyIp$1,
      proxy: proxy,
      parseURL: parseURL,
      fixLink: fixLink,
      fixLinkProtocol: fixLinkProtocol,
      proxyLink: proxyLink,
      randomWords: randomWords,
      randomChars: randomChars,
      randomHex: randomHex,
      randomId: randomId,
      randomId2: randomId2,
      randomCookie: randomCookie,
      checkAndroidVersion: checkAndroidVersion,
      helperServer: helperServer
    };

    var network$4 = new Lampa.Reguest();
    var cache = {};
    var total_cnt = 0;
    var proxy_cnt = 0;
    var good_cnt = 0;
    var CACHE_SIZE = 100;
    var CACHE_TIME = 1000 * 60 * 60;

    // net: a request of the caller's own (the «По сериям» probes run side by side; the shared one is cleared by each screen)
    function get(method, oncomplite, onerror, net) {
      var request = net || network$4;
      var use_proxy = total_cnt >= 10 && good_cnt > total_cnt / 2;
      if (!use_proxy) total_cnt++;
      var kp_prox = 'https://cors.kp556.workers.dev/';
      var url = 'https://kinopoiskapiunofficial.tech/';
      url += method;
      request.timeout(15000);
      request.silent((use_proxy ? kp_prox : '') + url, function (json) {
        oncomplite(json);
      }, function (a, c) {
        use_proxy = !use_proxy && (proxy_cnt < 10 || good_cnt > proxy_cnt / 2);

        if (use_proxy && (a.status == 429 || a.status == 451 || a.status == 0 && a.statusText !== 'timeout')) {
          proxy_cnt++;
          request.timeout(15000);
          request.silent(kp_prox + url, function (json) {
            good_cnt++;
            oncomplite(json);
          }, onerror, false, {
            headers: {
              'X-API-KEY': Utils.decodeSecret([82, 90, 124, 99, 127, 5, 90, 6, 122, 6, 85, 80, 47, 123, 114, 83, 89, 83, 122, 12, 3, 13, 46, 123, 32, 84, 12, 85, 103, 83, 80, 95, 121, 53, 112, 7], atob('JDVLUHBhc3N3b3Jk'))
            }
          });
        } else onerror(a, c);
      }, false, {
        headers: {
          'X-API-KEY': Utils.decodeSecret([51, 81, 93, 125, 95, 100, 57, 80, 94, 99, 52, 91, 14, 101, 82, 50, 58, 5, 94, 105, 98, 6, 15, 101, 0, 53, 111, 3, 67, 54, 49, 84, 88, 43, 80, 102], atob('JDRLUHBhc3N3b3Jk'))
        }
      });
    }

    function getComplite(method, oncomplite) {
      get(method, oncomplite, function () {
        oncomplite(null);
      });
    }

    function getCompliteIf(condition, method, oncomplite) {
      if (condition) getComplite(method, oncomplite);else {
        setTimeout(function () {
          oncomplite(null);
        }, 10);
      }
    }

    function getCache(key) {
      var res = cache[key];

      if (res) {
        var cache_timestamp = new Date().getTime() - CACHE_TIME;
        if (res.timestamp > cache_timestamp) return res.value;

        for (var ID in cache) {
          var node = cache[ID];
          if (!(node && node.timestamp > cache_timestamp)) delete cache[ID];
        }
      }

      return null;
    }

    function setCache(key, value) {
      var timestamp = new Date().getTime();
      var size = Object.keys(cache).length;

      if (size >= CACHE_SIZE) {
        var cache_timestamp = timestamp - CACHE_TIME;

        for (var ID in cache) {
          var node = cache[ID];
          if (!(node && node.timestamp > cache_timestamp)) delete cache[ID];
        }

        size = Object.keys(cache).length;

        if (size >= CACHE_SIZE) {
          var timestamps = [];

          for (var _ID in cache) {
            var _node = cache[_ID];
            timestamps.push(_node && _node.timestamp || 0);
          }

          timestamps.sort(function (a, b) {
            return a - b;
          });
          cache_timestamp = timestamps[Math.floor(timestamps.length / 2)];

          for (var _ID2 in cache) {
            var _node2 = cache[_ID2];
            if (!(_node2 && _node2.timestamp > cache_timestamp)) delete cache[_ID2];
          }
        }
      }

      cache[key] = {
        timestamp: timestamp,
        value: value
      };
    }

    function getFromCache(method, oncomplite, onerror, net) {
      var json = getCache(method);

      if (json) {
        setTimeout(function () {
          oncomplite(json, true);
        }, 10);
      } else get(method, oncomplite, onerror, net);
    }

    function clear() {
      network$4.clear();
    }

    var KP = {
      get: get,
      getComplite: getComplite,
      getCompliteIf: getCompliteIf,
      getCache: getCache,
      setCache: setCache,
      getFromCache: getFromCache,
      clear: clear
    };

    function lumex(component, _object, config) {
      var network = new Lampa.Reguest();
      var extract = {};
      var object = _object;
      extract.seasons = [];
      extract.season_num = [];
      extract.media = [];
      var select_title = '';
      var prefer_http = Lampa.Storage.field('online_mod_prefer_http') === true;
      var prefer_mp4 = Lampa.Storage.field('online_mod_prefer_mp4') === true;
      var prox = component.proxy('lumex');
      var host = atob('aHR0cHM6Ly9wLmx1bWV4LnNwYWNl');
      var ref = host + '/';
      var user_agent = Utils.baseUserAgent();
      var headers = Lampa.Platform.is('android') ? {
        'Origin': host,
        'Referer': ref,
        'User-Agent': user_agent,
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site'
      } : {};
      var headers2 = Lampa.Platform.is('android') ? {
        'Origin': host,
        'Referer': ref,
        'User-Agent': user_agent,
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site',
        'Cookie': '',
        'x-csrf-token': ''
      } : {};
      var prox_enc = '';

      if (prox) {
        prox_enc += 'param/Origin=' + encodeURIComponent(host) + '/';
        prox_enc += 'param/Referer=' + encodeURIComponent(ref) + '/';
        prox_enc += 'param/User-Agent=' + encodeURIComponent(user_agent) + '/';
        prox_enc += 'param/Sec-Fetch-Dest=empty/';
        prox_enc += 'param/Sec-Fetch-Mode=cors/';
        prox_enc += 'param/Sec-Fetch-Site=same-site/';
      }

      var prox_enc2 = prox_enc;
      var embed = atob('aHR0cHM6Ly9hcGkubHVtZXguc3BhY2Uv');
      var suffix = atob('Y2xpZW50SWQ9Q1dmS1hMYzFhaklkJmRvbWFpbj1tb3ZpZWxhYi5vbmUmdXJsPW1vdmllbGFiLm9uZQ==');
      var no_prox = atob('LmVudG91YWVkb24uY29tLw==');
      var filter_items = {};
      var choice = {
        season: 0,
        voice: 0,
        voice_name: '',
        voice_id: 0
      };

      function lumex_search(api, callback, error) {
        var error_check = function error_check(a, c) {
          if (a.status == 404 || a.status == 0 && a.statusText !== 'timeout') {
            if (callback) callback('');
          } else if (error) error(network.errorDecode(a, c));
        };

        var returnHeaders = true;
        var prox_enc_cookie = prox_enc;

        if (prox) {
          prox_enc_cookie += 'cookie_plus/param/Cookie=/';
          returnHeaders = false;
        }

        var success_check = function success_check(json) {
          var cookie = '';

          if (json && json.headers && json.body) {
            var cookieHeaders = json.headers['set-cookie'] || null;

            if (cookieHeaders && cookieHeaders.forEach) {
              var values = {};
              cookieHeaders.forEach(function (param) {
                var parts = param.split(';')[0].split('=');

                if (parts[0]) {
                  if (parts[1] === 'deleted') delete values[parts[0]];else values[parts[0]] = parts[1] || '';
                }
              });
              var cookies = [];

              for (var name in values) {
                cookies.push(name + '=' + values[name]);
              }

              cookie = cookies.join('; ');
            }

            json = typeof json.body === 'string' ? Lampa.Arrays.decodeJson(json.body, {}) : json.body;
          }

          callback(json, cookie);
        };

        network.clear();
        network.timeout(20000);
        network["native"](component.proxyLink(api, prox, prox_enc_cookie, 'enc2t'), success_check, error_check, false, {
          headers: headers,
          returnHeaders: returnHeaders
        });
      }
      /**
       * Начать поиск
       * @param {Object} _object
       * @param {String} kinopoisk_id
       */


      this.search = function (_object, kinopoisk_id, data) {
        object = _object;
        select_title = object.search || object.movie.title;
        var error = component.empty.bind(component);
        var found = false;
        var src = embed + 'content';

        if (data && data[0] && data[0].content_type && data[0].id) {
          found = true;
          src = Lampa.Utils.addUrlComponent(src, 'contentType=' + encodeURIComponent(data[0].content_type.replace(/_/g, '-')));
          src = Lampa.Utils.addUrlComponent(src, 'contentId=' + encodeURIComponent(data[0].id));
        } else {
          src = Lampa.Utils.addUrlComponent(src, 'contentType=short');
          src = Lampa.Utils.addUrlComponent(src, (+kinopoisk_id ? 'kpId=' : 'imdbId=') + encodeURIComponent(kinopoisk_id));
        }

        src = Lampa.Utils.addUrlComponent(src, suffix);
        lumex_search(src, function (json, cookie) {
          if (json) success(json, cookie);else if (!found && !object.clarification && object.movie.imdb_id && kinopoisk_id != object.movie.imdb_id) {
            var src2 = embed + 'content';
            src2 = Lampa.Utils.addUrlComponent(src2, 'contentType=short');
            src2 = Lampa.Utils.addUrlComponent(src2, 'imdbId=' + encodeURIComponent(object.movie.imdb_id));
            src2 = Lampa.Utils.addUrlComponent(src2, suffix);
            lumex_search(src2, function (json, cookie) {
              if (json) success(json, cookie);else component.emptyForQuery(select_title);
            }, error);
          } else component.emptyForQuery(select_title);
        }, error);
      };

      this.extendChoice = function (saved) {
        Lampa.Arrays.extend(choice, saved, true);
      };
      /**
       * Сброс фильтра
       */


      this.reset = function () {
        component.reset();
        choice = {
          season: 0,
          voice: 0,
          voice_name: '',
          voice_id: 0
        };
        filter();
        append(filtred());
        component.saveChoice(choice);
      };
      /**
       * Применить фильтр
       * @param {*} type
       * @param {*} a
       * @param {*} b
       */


      this.filter = function (type, a, b) {
        choice[a.stype] = b.index;

        if (a.stype == 'voice') {
          choice.voice_name = filter_items.voice[b.index];
          choice.voice_id = filter_items.voice_info[b.index] && filter_items.voice_info[b.index].id;
        }

        component.reset();
        filter();
        append(filtred());
        component.saveChoice(choice);
      };
      /**
       * Уничтожить
       */


      this.destroy = function () {
        network.clear();
        extract = null;
      };

      function success(json, cookie) {
        component.loading(false);

        if (json && json.player && json.player.media && json.player.media.length) {
          prox_enc2 = prox_enc;

          if (prox) {
            prox_enc2 += 'param/Cookie=' + encodeURIComponent(cookie) + '/';
            prox_enc2 += 'param/x-csrf-token=' + encodeURIComponent(json.meta || '') + '/';
          }

          if (Lampa.Platform.is('android')) {
            headers2['Cookie'] = cookie;
            headers2['x-csrf-token'] = json.meta || '';
          }

          var seasons = [];
          var season_num = [];
          var season_count = 0;
          json.player.media.forEach(function (media) {
            if (media.episodes) {
              season_count++;

              if (media.episodes.length) {
                seasons.push(media);
                season_num.push(media.season_id != null ? media.season_id : season_count);
              }
            } else if (media.media && media.episode_id != null && !season_count) {
              season_count++;
              seasons.push({
                season_id: 1,
                season_name: Lampa.Lang.translate('online_mod_season') + ' 1',
                episodes: json.player.media
              });
              season_num.push(1);
            }
          });
          extract = {
            seasons: seasons,
            season_num: season_num,
            media: json.player.media
          };
          filter();
          append(filtred());
        } else component.emptyForQuery(select_title);
      }
      /**
       * Построить фильтр
       */


      function filter() {
        filter_items = {
          season: extract.season_num.map(function (s) {
            return Lampa.Lang.translate('torrent_serial_season') + ' ' + s;
          }),
          season_num: extract.season_num,
          voice: [],
          voice_info: []
        };
        if (!filter_items.season[choice.season]) choice.season = 0;

        if (extract.season_num.length) {
          var season = extract.seasons[choice.season];

          if (season && season.episodes) {
            season.episodes.forEach(function (episode) {
              if (episode.media) {
                episode.media.forEach(function (voice) {
                  if (voice.translation_id != null && voice.translation_name != null) {
                    if (!filter_items.voice_info.some(function (v) {
                      return v.id == voice.translation_id;
                    })) {
                      filter_items.voice.push(voice.translation_name);
                      filter_items.voice_info.push({
                        id: voice.translation_id,
                        name: voice.translation_name
                      });
                    }
                  }
                });
              }
            });
          }
        }

        if (!filter_items.voice[choice.voice]) choice.voice = 0;

        if (choice.voice_name) {
          var inx = -1;

          if (choice.voice_id) {
            var voice = filter_items.voice_info.filter(function (v) {
              return v.id == choice.voice_id;
            })[0];
            if (voice) inx = filter_items.voice_info.indexOf(voice);
          }

          if (inx == -1) inx = filter_items.voice.indexOf(choice.voice_name);
          if (inx == -1) choice.voice = 0;else if (inx !== choice.voice) {
            choice.voice = inx;
          }
        }

        component.filter(filter_items, choice);
      }
      /**
       * Отфильтровать файлы
       * @returns array
       */


      function filtred() {
        var filtred = [];

        if (filter_items.season_num.length) {
          var season = extract.seasons[choice.season];
          var season_num = extract.season_num[choice.season];
          var v = filter_items.voice_info[choice.voice];

          if (season && season.episodes && v) {
            var episode_count = 0;
            season.episodes.forEach(function (episode) {
              episode_count++;

              if (episode.media) {
                episode.media.forEach(function (voice) {
                  if (voice.translation_id == v.id) {
                    var episode_num = episode.episode_id != null ? episode.episode_id : episode_count;
                    filtred.push({
                      title: component.formatEpisodeTitle(season_num, episode_num),
                      quality: voice.max_quality ? voice.max_quality + 'p' : '360p ~ 1080p',
                      info: ' / ' + (voice.translation_name || v.name),
                      season: season_num,
                      episode: episode_count,
                      media: voice
                    });
                  }
                });
              }
            });
          }
        } else {
          extract.media.forEach(function (voice) {
            if (voice.translation_id != null && voice.translation_name != null) {
              filtred.push({
                title: voice.translation_name || select_title,
                quality: voice.max_quality ? voice.max_quality + 'p' : '360p ~ 1080p',
                info: '',
                media: voice
              });
            }
          });
        }

        return filtred;
      }
      /**
       * Получить потоки
       * @param {String} str
       * @returns array
       */


      function extractItems(str, url) {
        if (!str) return [];

        try {
          var items = component.parseM3U(str).map(function (item) {
            var link = item.link || '';
            if (prefer_mp4) link = link.replace(/(\.mp4):hls:manifest\.m3u8$/i, '$1');
            var quality = item.height;
            var alt_quality = link.match(/\b(\d\d\d+)\./);

            if (alt_quality) {
              var alt_height = parseInt(alt_quality[1]);
              if (alt_height > quality && alt_height <= 4320) quality = alt_height;
            }

            link = component.fixLink(link, url);
            var link_prox = link.indexOf(no_prox) !== -1 ? '' : prox;
            return {
              label: quality ? quality + 'p' : '360p ~ 1080p',
              quality: quality,
              file: component.proxyLink(link, link_prox, prox_enc)
            };
          });
          items.sort(function (a, b) {
            if (b.quality > a.quality) return 1;
            if (b.quality < a.quality) return -1;
            if (b.label > a.label) return 1;
            if (b.label < a.label) return -1;
            return 0;
          });
          return items;
        } catch (e) {}

        return [];
      }
      /**
       * Получить поток
       * @param {*} element
       */


      function parseStream(element, call, error, itemsExtractor, str, url) {
        var file = '';
        var quality = false;
        var items = itemsExtractor(str, url);

        if (items && items.length) {
          file = items[0].file;
          quality = {};
          items.forEach(function (item) {
            quality[item.label] = item.file;
          });
        }

        if (file) {
          element.stream = file;
          element.qualitys = quality;
          call(element);
        } else error();
      }
      /**
       * Получить поток
       * @param {*} element
       */


      function getStreamM3U(element, call, error, file) {
        file = file.replace(/\.mp4:hls:manifest/, '');
        var hls_file = file.replace(/\/\d\d\d+([^\/]*\.m3u8)$/, '/hls$1');
        var link_prox = file.indexOf(no_prox) !== -1 ? '' : prox;
        network.clear();
        network.timeout(5000);
        network["native"](component.proxyLink(hls_file, link_prox, prox_enc), function (str) {
          parseStream(element, call, error, extractItems, str, hls_file);
        }, function (a, c) {
          if (file != hls_file) {
            network.clear();
            network.timeout(5000);
            network["native"](component.proxyLink(file, link_prox, prox_enc), function (str) {
              parseStream(element, call, error, extractItems, str, file);
            }, function (a, c) {
              error();
            }, false, {
              dataType: 'text'
            });
          } else error();
        }, false, {
          dataType: 'text'
        });
      }

      function parseSubs(tracks) {
        if (!(tracks && tracks.length)) return false;
        var subtitles = tracks.filter(function (t) {
          return t.kind === 'captions';
        }).map(function (item) {
          var links = item.src || '';
          var link = links.split(' or ').filter(function (link) {
            return link;
          })[0] || '';
          link = component.fixLinkProtocol(link, prefer_http);
          var link_prox = link.indexOf(no_prox) !== -1 ? '' : prox;
          return {
            label: item.label,
            url: component.proxyLink(link, link_prox, prox_enc)
          };
        }).filter(function (s) {
          return s.url;
        });
        return subtitles.length ? subtitles : false;
      }
      /**
       * Получить поток
       * @param {*} element
       */


      function getStream(element, call, error) {
        if (element.stream) return call(element);
        if (!element.media.playlist) return error();
        var url = component.fixLink(element.media.playlist, embed);
        network.clear();
        network.timeout(10000);
        network["native"](component.proxyLink(url, prox, prox_enc2, 'enc2t'), function (json) {
          var url = component.fixLinkProtocol(json && json.url || '', prefer_http);

          if (url) {
            element.subtitles = parseSubs(element.media.tracks);

            if (endsWith(url, '.m3u8')) {
              getStreamM3U(element, call, error, url);
              return;
            }

            var link_prox = url.indexOf(no_prox) !== -1 ? '' : prox;
            element.stream = component.proxyLink(url, link_prox, prox_enc);
            element.qualitys = false;
            call(element);
          } else error();
        }, function (a, c) {
          error();
        }, {}, {
          headers: headers2
        });
      }
      /**
       * Добавить видео
       * @param {Array} items
       */


      function append(items) {
        component.reset();
        var viewed = Lampa.Storage.cache('online_view', 5000, []);
        var last_episode = component.getLastEpisode(items);
        items.forEach(function (element) {
          if (element.season) {
            element.translate_episode_end = last_episode;
            element.translate_voice = filter_items.voice[choice.voice];
          }

          var hash = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title].join('') : object.movie.original_title);
          var view = component.watchView(element, hash, items);
          var item = Lampa.Template.get('online_mod', element);
          var hash_file = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title, filter_items.voice[choice.voice]].join('') : object.movie.original_title + element.title);
          element.timeline = view;
          item.append(Lampa.Timeline.render(view));

          if (Lampa.Timeline.details) {
            item.find('.online__quality').append(Lampa.Timeline.details(view, ' / '));
          }

          if (viewed.indexOf(hash_file) !== -1) item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
          item.on('hover:enter', function () {
            if (element.loading) return;
            if (object.movie.id) Lampa.Favorite.add('history', object.movie, 100);
            element.loading = true;
            getStream(element, function (element) {
              element.loading = false;
              var first = {
                url: component.getDefaultQuality(element.qualitys, element.stream),
                quality: component.renameQualityMap(element.qualitys),
                subtitles: element.subtitles,
                timeline: element.timeline,
                title: element.season ? element.title : select_title + (element.title == select_title ? '' : ' / ' + element.title)
              };

              if (element.season && Lampa.Platform.version) {
                var playlist = [];
                items.forEach(function (elem) {
                  if (elem == element) {
                    playlist.push(first);
                  } else {
                    var cell = {
                      url: function url(call) {
                        getStream(elem, function (elem) {
                          cell.url = component.getDefaultQuality(elem.qualitys, elem.stream);
                          cell.quality = component.renameQualityMap(elem.qualitys);
                          cell.subtitles = elem.subtitles;
                          call();
                        }, function () {
                          cell.url = '';
                          call();
                        });
                      },
                      timeline: elem.timeline,
                      title: elem.title
                    };
                    playlist.push(cell);
                  }
                });
                playWithoutPreroll(first, playlist);
              } else {
                playWithoutPreroll(first, [first]);
              }

              if (viewed.indexOf(hash_file) == -1) {
                viewed.push(hash_file);
                item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
                Lampa.Storage.set('online_view', viewed);
              }
            }, function () {
              element.loading = false;
              Lampa.Noty.show(Lampa.Lang.translate('online_mod_nolink'));
            });
          });
          component.append(item);
          component.contextmenu({
            item: item,
            view: view,
            viewed: viewed,
            hash_file: hash_file,
            element: element,
            file: function file(call) {
              getStream(element, function (element) {
                call({
                  file: element.stream,
                  quality: element.qualitys
                });
              }, function () {
                Lampa.Noty.show(Lampa.Lang.translate('online_mod_nolink'));
              });
            }
          });
        });
        component.start(true);
      }
    }

    lumex.initSettings = function (show_all) {
      var balanser_name = 'Lumex';
      var component_name = 'online_mod_lumex';
      if (Lampa.SettingsApi.getComponent(component_name)) return;

      {
        var icon = "<svg><use xlink:href=\"#sprite-settings\"></use></svg>";
        Lampa.SettingsApi.addComponent({
          component: component_name,
          icon: icon,
          name: balanser_name
        });
        Lampa.SettingsApi.addParam({
          component: 'online_mod',
          param: {
            name: component_name + '_settings',
            type: 'button'
          },
          field: {
            name: "<div class=\"settings-folder\" style=\"padding:0!important\"><div style=\"width:1.8em;height:1.3em;padding-right:.5em\">".concat(icon, "</div><div style=\"font-size:1.3em\">").concat(balanser_name, "</div></div>")
          },
          onChange: function onChange() {
            Lampa.Settings.create(component_name, {
              onBack: function onBack() {
                Lampa.Settings.create('online_mod');
              }
            });
          }
        });
      }

      {
        Lampa.SettingsApi.addParam({
          component: component_name,
          param: {
            name: 'online_mod_proxy_lumex',
            type: 'trigger',
            "default": false
          },
          field: {
            name: Lampa.Lang.translate('online_mod_proxy_balanser') + ' ' + balanser_name
          }
        });
      }
    };

    lumex.hideSettings = function (body) {
      $('[data-component="online_mod_lumex"]', body).hide();
    };

    function lumex2(component, _object, config) {
      var network = new Lampa.Reguest();
      var extract = [];
      var object = _object;
      var select_title = '';
      var is_playlist = false;
      var embed = atob('aHR0cHM6Ly9hcGkubGFtcGEuc3RyZWFtL2x1bWV4Lw==');
      var api_suffix = '/' + encodeURIComponent(btoa(window.location.href));
      var cub_id = encodeURIComponent(btoa(Lampa.Storage.get('account', '{}').email || 'none'));
      var filter_items = {};
      var choice = {
        season: 0,
        voice: 0,
        voice_name: ''
      };

      function lumex_api(api, callback, error) {
        var error_check = function error_check(a, c) {
          if (a.status == 404 || a.status == 500 || a.status == 0 && a.statusText !== 'timeout') {
            if (callback) callback('');
          } else if (error) error(network.errorDecode(a, c));
        };

        var success_check = function success_check(json) {
          callback(json);
        };

        network.clear();
        network.timeout(20000);
        network["native"](api, success_check, error_check);
      }
      /**
       * Начать поиск
       * @param {Object} _object
       * @param {String} kinopoisk_id
       */


      this.search = function (_object, kinopoisk_id, data) {
        object = _object;
        select_title = object.search || object.movie.title;
        var error = component.empty.bind(component);
        var src = embed + 'sId/' + encodeURIComponent(object.movie.id) + '/mod/';

        if (data && data[0] && data[0].content_type && data[0].id) {
          var imdb_id = data[0].imdb_id || 'null';
          var kp_id = data[0].kp_id || 'null';
          src += encodeURIComponent(kp_id) + '/' + encodeURIComponent(imdb_id);
        } else {
          var _imdb_id = (+kinopoisk_id ? !object.clarification && object.movie.imdb_id : kinopoisk_id) || 'null';

          var _kp_id = +kinopoisk_id ? kinopoisk_id : 'null';

          src += encodeURIComponent(_kp_id) + '/' + encodeURIComponent(_imdb_id);
        }

        var original_title = !object.clarification && (object.movie.original_title || object.movie.original_name) || '';
        var search_date = object.search_date || !object.clarification && (object.movie.release_date || object.movie.first_air_date || object.movie.last_air_date) || '0000';
        var search_year = parseInt((search_date + '').slice(0, 4));
        component.checkMyIp(function () {
          var ip = Utils.getMyIp();

          if (!ip) {
            error();
            return;
          }

          var api = src + '/' + cub_id + api_suffix;
          api = Lampa.Utils.addUrlComponent(api, 'ip=' + encodeURIComponent(ip));
          api = Lampa.Utils.addUrlComponent(api, 'search=' + encodeURIComponent(select_title));
          api = Lampa.Utils.addUrlComponent(api, 'original_title=' + encodeURIComponent(original_title));
          api = Lampa.Utils.addUrlComponent(api, 'year=' + search_year);
          lumex_api(api, function (json) {
            if (json) success(json);else component.emptyForQuery(select_title);
          }, error);
        });
      };

      this.extendChoice = function (saved) {
        Lampa.Arrays.extend(choice, saved, true);
      };
      /**
       * Сброс фильтра
       */


      this.reset = function () {
        component.reset();
        choice = {
          season: 0,
          voice: 0,
          voice_name: ''
        };
        filter();
        append(filtred());
        component.saveChoice(choice);
      };
      /**
       * Применить фильтр
       * @param {*} type
       * @param {*} a
       * @param {*} b
       */


      this.filter = function (type, a, b) {
        choice[a.stype] = b.index;
        if (a.stype == 'voice') choice.voice_name = filter_items.voice[b.index];
        component.reset();
        filter();
        append(filtred());
        component.saveChoice(choice);
      };
      /**
       * Уничтожить
       */


      this.destroy = function () {
        network.clear();
        extract = null;
      };

      function success(json, cookie) {
        component.loading(false);

        if (json && json.folder && Lampa.Arrays.getKeys(json.folder).length) {
          if (json.folder.forEach) {
            extract = json.folder;
            is_playlist = false;
          } else {
            extract = [];
            is_playlist = true;

            for (var voice in json.folder) {
              var seasons = json.folder[voice];

              if (!seasons.forEach) {
                var _loop = function _loop(season_id) {
                  var episodes = seasons[season_id];

                  if (episodes.forEach) {
                    var s = extract.filter(function (s) {
                      return s.season_id === season_id;
                    })[0];

                    if (!s) {
                      s = {
                        season_id: season_id,
                        title: Lampa.Lang.translate('torrent_serial_season') + ' ' + season_id,
                        voices: []
                      };
                      extract.push(s);
                    }

                    s.voices.push({
                      title: voice,
                      episodes: episodes
                    });
                  }
                };

                for (var season_id in seasons) {
                  _loop(season_id);
                }
              }
            }

            extract.sort(function (a, b) {
              return a.season_id - b.season_id;
            });
          }

          filter();
          append(filtred());
        } else component.emptyForQuery(select_title);
      }
      /**
       * Построить фильтр
       */


      function filter() {
        filter_items = {
          season: is_playlist ? extract.map(function (s) {
            return s.title;
          }) : [],
          voice: []
        };
        if (!filter_items.season[choice.season]) choice.season = 0;

        if (is_playlist) {
          var season = extract[choice.season];

          if (season && season.voices) {
            season.voices.forEach(function (voice) {
              filter_items.voice.push(voice.title);
            });
          }
        }

        if (!filter_items.voice[choice.voice]) choice.voice = 0;

        if (choice.voice_name) {
          var inx = filter_items.voice.indexOf(choice.voice_name);
          if (inx == -1) choice.voice = 0;else if (inx !== choice.voice) {
            choice.voice = inx;
          }
        }

        component.filter(filter_items, choice);
      }
      /**
       * Отфильтровать файлы
       * @returns array
       */


      function filtred() {
        var filtred = [];

        if (is_playlist) {
          var season = extract[choice.season];

          if (season && season.voices) {
            var voice_title = filter_items.voice[choice.voice];
            season.voices.forEach(function (voice) {
              if (voice.title == voice_title && voice.episodes) {
                voice.episodes.forEach(function (episode) {
                  filtred.push({
                    title: component.formatEpisodeTitle(episode.season, episode.episode),
                    quality: episode.quality || '360p ~ 1080p',
                    info: ' / ' + voice_title,
                    season: episode.season + '',
                    episode: episode.episode,
                    media: episode,
                    subtitles: parseSubs(episode.subtitles),
                    vast_url: episode.vast_url,
                    vast_msg: episode.vast_msg
                  });
                });
              }
            });
          }
        } else {
          extract.forEach(function (voice) {
            if (voice.url) {
              filtred.push({
                title: voice.title || select_title,
                quality: voice.quality || '360p ~ 1080p',
                info: '',
                media: voice,
                subtitles: parseSubs(voice.subtitles),
                vast_url: voice.vast_url,
                vast_msg: voice.vast_msg
              });
            }
          });
        }

        return filtred;
      }

      function parseSubs(tracks) {
        if (!(tracks && tracks.forEach)) return false;
        var subtitles = tracks.map(function (item) {
          return {
            label: item.label,
            url: item.url || ''
          };
        }).filter(function (s) {
          return s.url;
        });
        return subtitles.length ? subtitles : false;
      }
      /**
       * Получить поток
       * @param {*} element
       */


      function getStream(element, call, error) {
        if (element.stream) return call(element);
        var ip = Utils.getMyIp();
        if (!element.media.url || !ip) return error();
        var api = element.media.url + '/' + encodeURIComponent(ip) + api_suffix;
        lumex_api(api, function (json) {
          if (json && json.url) {
            element.stream = json.url;
            element.qualitys = json.qualitys || false;
            call(element);
          } else error();
        }, error);
      }
      /**
       * Добавить видео
       * @param {Array} items
       */


      function append(items) {
        component.reset();
        var viewed = Lampa.Storage.cache('online_view', 5000, []);
        var last_episode = component.getLastEpisode(items);
        items.forEach(function (element) {
          if (element.season) {
            element.translate_episode_end = last_episode;
            element.translate_voice = filter_items.voice[choice.voice];
          }

          var hash = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title].join('') : object.movie.original_title);
          var view = component.watchView(element, hash, items);
          var item = Lampa.Template.get('online_mod', element);
          var hash_file = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title, filter_items.voice[choice.voice]].join('') : object.movie.original_title + element.title);
          element.timeline = view;
          item.append(Lampa.Timeline.render(view));

          if (Lampa.Timeline.details) {
            item.find('.online__quality').append(Lampa.Timeline.details(view, ' / '));
          }

          if (viewed.indexOf(hash_file) !== -1) item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
          item.on('hover:enter', function () {
            if (element.loading) return;
            if (object.movie.id) Lampa.Favorite.add('history', object.movie, 100);
            element.loading = true;
            getStream(element, function (element) {
              element.loading = false;
              var first = {
                url: component.getDefaultQuality(element.qualitys, element.stream),
                quality: component.renameQualityMap(element.qualitys),
                subtitles: element.subtitles,
                vast_url: element.vast_url,
                vast_msg: element.vast_msg,
                timeline: element.timeline,
                title: element.season ? element.title : select_title + (element.title == select_title ? '' : ' / ' + element.title)
              };

              if (element.season && Lampa.Platform.version) {
                var playlist = [];
                items.forEach(function (elem) {
                  if (elem == element) {
                    playlist.push(first);
                  } else {
                    var cell = {
                      url: function url(call) {
                        getStream(elem, function (elem) {
                          cell.url = component.getDefaultQuality(elem.qualitys, elem.stream);
                          cell.quality = component.renameQualityMap(elem.qualitys);
                          cell.subtitles = elem.subtitles;
                          call();
                        }, function () {
                          cell.url = '';
                          call();
                        });
                      },
                      vast_url: elem.vast_url,
                      vast_msg: elem.vast_msg,
                      timeline: elem.timeline,
                      title: elem.title
                    };
                    playlist.push(cell);
                  }
                });
                playWithoutPreroll(first, playlist);
              } else {
                playWithoutPreroll(first, [first]);
              }

              if (viewed.indexOf(hash_file) == -1) {
                viewed.push(hash_file);
                item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
                Lampa.Storage.set('online_view', viewed);
              }
            }, function () {
              element.loading = false;
              Lampa.Noty.show(Lampa.Lang.translate('online_mod_nolink'));
            });
          });
          component.append(item);
          component.contextmenu({
            item: item,
            view: view,
            viewed: viewed,
            hash_file: hash_file,
            element: element,
            file: function file(call) {
              getStream(element, function (element) {
                call({
                  file: element.stream,
                  quality: element.qualitys
                });
              }, function () {
                Lampa.Noty.show(Lampa.Lang.translate('online_mod_nolink'));
              });
            }
          });
        });
        component.start(true);
      }
    }

    // IMDb/Kinopoisk ids of an HDrezka page: its rating links go through /help/<base64 of the URL-encoded address>/
    function rezkaPageIds(str) {
      var ids = { imdb: '', kp: '' };
      // lazy: the link's own trailing slash is not part of the base64
      var re = /\/help\/([A-Za-z0-9+\/=%]+?)\/?["']/g;
      var m;
      while (m = re.exec(str || '')) {
        var target = '';
        try {
          target = decodeURIComponent(atob(decodeURIComponent(m[1])));
        } catch (e) {}
        var i = target.match(/imdb\.com\/title\/(tt\d+)/);
        var k = target.match(/kinopoisk\.ru\/film\/(\d+)/);
        if (i) ids.imdb = i[1];
        if (k) ids.kp = k[1];
      }
      return ids;
    }
    // HDrezka's "watch all parts" list, oldest first: [{num, title, link ('' for the open page), current, rating}]
    function rezkaParts(str) {
      var out = [];
      var re = /<div class="b-post__partcontent_item( current)?"(?: data-url="([^"]*)")?>\s*<div class="td num">(\d+)<\/div>\s*<div class="td title">(?:<a [^>]*>)?([^<]*)((?:(?!<div class="b-post__partcontent_item)[\s\S])*)/g;
      var m;
      while (m = re.exec(str || '')) {
        var rating = /class="td rating">(?:<i[^>]*>)?([\d.]+)/.exec(m[5]);
        out.push({
          num: +m[3],
          title: m[4].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/^\s+|\s+$/g, ''),
          link: m[2] || '',
          current: !!m[1],
          rating: rating ? rating[1] : ''
        });
      }
      out.sort(function (a, b) {
        return a.num - b.num;
      });
      return out;
    }

    // page link -> its ids, for the session (one page is opened once)
    var rezkaIds = {};

    // what this account plays: items are the qualities left after the Premium stubs were dropped, offered counts them before
    // 0 = the title has no premium tiers and nothing was dropped, so it says nothing about the account
    function rezkaBest(items, offered) {
      var best = items.some(function (item) { return item.quality >= 2160; }) ? 2160
        : items.some(function (item) { return item.quality > 1080 || /ultra/i.test(item.label); }) ? 1080 : 720;
      return best === 720 && items.length >= offered ? 0 : best;
    }

    // the best resolution a title offers (stubs included), from the labels HDrezka lists for one stream; 0 = none
    function rezkaOffered(labels) {
      var max = 0;
      (labels || []).forEach(function (label) {
        var text = String(label).replace(/<[^>]*>/g, '');
        var q = /4K/i.test(text) ? 2160 : /2K/i.test(text) ? 1440 : parseInt(text, 10) || 0;
        if (q > max) max = q;
      });
      return max;
    }

    // the best resolution in the helper's /qualities answer (keys like '1080p'); 4K and 2K only where uhd is marked; 0 = nothing
    function allohaBest(map, uhd) {
      var max = 0;
      if (!map || typeof map !== 'object') return 0;
      Object.keys(map).forEach(function (k) {
        var n = parseInt(k, 10);
        if (n > max && (uhd || (n !== 2160 && n !== 1440))) max = n;
      });
      return max;
    }

    // best offered resolution per film id, kept between sessions (the newest 300 titles)
    function rezkaTitleMax(film_id) {
      var all = Lampa.Storage.get('online_mod_rezka2_titles', {});
      return all && +all['t' + film_id] || 0;
    }

    // keys carry a letter: numeric keys would iterate by value, not by age
    function rezkaTitleSave(film_id, best) {
      if (!film_id || !(best > 0) || rezkaTitleMax(film_id) === best) return;
      var all = Lampa.Storage.get('online_mod_rezka2_titles', {});
      if (!all || typeof all !== 'object') all = {};
      delete all['t' + film_id];
      all['t' + film_id] = best;
      var keys = Object.keys(all);
      while (keys.length > 300) delete all[keys.shift()];
      Lampa.Storage.set('online_mod_rezka2_titles', all);
    }

    function rezka2(component, _object, config) {
      var network = new Lampa.Reguest();
      var loaders = [];
      var extract = {};
      var object = _object;
      var select_title = '';
      var prefer_http = Lampa.Storage.field('online_mod_prefer_http') === true;
      var prefer_mp4 = Lampa.Storage.field('online_mod_prefer_mp4') === true;
      var proxy_mirror = Lampa.Storage.field('online_mod_proxy_rezka2_mirror') === true;
      var rezka2_prx_ukr = '//' + (Lampa.Storage.field('online_mod_rezka2_prx_ukr') || 'prx.ukrtelcdn.net') + '/';
      var use_stream_proxy = Lampa.Storage.field('online_mod_use_stream_proxy') === true;
      var rezka2_fix_stream = Lampa.Storage.field('online_mod_rezka2_fix_stream') === true;
      var show_premium = Lampa.Storage.field('online_mod_rezka2_show_premium') === true;
      var prox = component.proxy('rezka2');
      var host = prox && !proxy_mirror ? Utils.rezka2Host() : Utils.rezka2Mirror();
      var ref = host + '/';
      var logged_in = !(prox || Lampa.Platform.is('android'));
      var user_agent = Utils.rezka2UserAgent();
      var headers = Lampa.Platform.is('android') ? {
        'Origin': host,
        'Referer': ref,
        'User-Agent': user_agent
      } : {};
      var prox_enc = '';

      if (prox) {
        prox_enc += 'param/Origin=' + encodeURIComponent(host) + '/';
        prox_enc += 'param/Referer=' + encodeURIComponent(ref) + '/';
        prox_enc += 'param/User-Agent=' + encodeURIComponent(user_agent) + '/';
      }

      var cookie = Lampa.Storage.get('online_mod_rezka2_cookie', '') + '';
      if (cookie.indexOf('PHPSESSID=') == -1) cookie = 'PHPSESSID=' + Utils.randomId(26) + (cookie ? '; ' + cookie : '');

      if (cookie) {
        if (Lampa.Platform.is('android')) {
          headers.Cookie = cookie;
        }

        if (prox) {
          prox_enc += 'param/Cookie=' + encodeURIComponent(cookie) + '/';
        }
      }

      var embed = ref;
      var filter_items = {};
      var choice = {
        season: 0,
        voice: 0,
        voice_name: '',
        season_id: ''
      };
      var error_message = '';

      function checkErrorForm(str) {
        var login_form = str.match(/<form id="check-form" class="check-form" method="post" action="\/ajax\/login\/">/) || str.match(/<form id="loginForm" action="\/ajax\/login\/"/);

        if (login_form) {
          error_message = Lampa.Lang.translate('online_mod_authorization_required') + ' HDrezka';
          return;
        }

        var error_form = str.match(/(<div class="error-code">[^<]*<div>[^<]*<\/div>[^<]*<\/div>)\s*(<div class="error-title">[^<]*<\/div>)/);

        if (error_form) {
          error_message = ($(error_form[1]).text().trim() || '') + ':\n' + ($(error_form[2]).text().trim() || '');
          return;
        }

        var verify_form = str.match(/<span>MIRROR<\/span>.*<button type="submit" onclick="\$\.cookie(\([^)]*\))/);

        if (verify_form) {
          error_message = Lampa.Lang.translate('online_mod_unsupported_mirror') + ' HDrezka';
          return;
        }

        var anubis_form = str.match(/<script id="anubis_challenge"/);

        if (anubis_form) {
          error_message = Lampa.Lang.translate('online_mod_anubis_required');
          return;
        }

        if (startsWith(str, 'Fatal error:')) {
          error_message = str;
          return;
        }
      }
      /**
       * Поиск
       * @param {Object} _object
       */


      this.search = function (_object, kinopoisk_id, data) {
        var _this = this;

        object = _object;
        select_title = object.search || object.movie.title;
        page_chosen = !!(this.wait_similars && data && data[0].is_similars);
        if (page_chosen) return getPage(data[0].link);
        error_message = '';
        // an id check of an older search is dropped
        ids_gen++;
        var search_date = object.search_date || !object.clarification && (object.movie.release_date || object.movie.first_air_date || object.movie.last_air_date) || '0000';
        var search_year = parseInt((search_date + '').slice(0, 4));
        var orig_titles = [];

        if (object.movie.alternative_titles && object.movie.alternative_titles.results) {
          orig_titles = object.movie.alternative_titles.results.map(function (t) {
            return t.title;
          });
        }

        if (object.movie.original_title) orig_titles.push(object.movie.original_title);
        if (object.movie.original_name) orig_titles.push(object.movie.original_name);
        var url = embed + 'engine/ajax/search.php';
        var more_url = embed + 'search/?do=search&subaction=search';

        var query_more = function query_more(query, page, data, callback) {
          var url = more_url + '&q=' + encodeURIComponent(query) + '&page=' + encodeURIComponent(page);
          network.clear();
          network.timeout(10000);
          network["native"](component.proxyLink(url, prox, prox_enc, prox_enc, 'enc2t'), function (str) {
            str = (str || '').replace(/[\r\n]/g, '');
            checkErrorForm(str);
            var links = str.match(/<div class="b-content__inline_item-link">\s*<a [^>]*>[^<]*<\/a>\s*<div>[^<]*<\/div>\s*<\/div>/g);
            var have_more = !!str.match(/<a [^>]*>\s*<span class="b-navigation__next\b/);

            if (links && links.length) {
              var items = links.map(function (l) {
                var li = $(l);
                var link = $('a', li);
                var info_div = $('div', li);
                var titl = link.text().trim() || '';
                var info = info_div.text().trim() || '';
                var orig_title = '';
                var year;
                var found = info.match(/^(\d{4})\b/);

                if (found) {
                  year = parseInt(found[1]);
                }

                return {
                  year: year,
                  title: titl,
                  orig_title: orig_title,
                  link: link.attr('href') || ''
                };
              });
              data = data.concat(items);
            }

            if (callback) callback(data, have_more);
          }, function (a, c) {
            component.empty(network.errorDecode(a, c));
          }, false, {
            dataType: 'text',
            withCredentials: logged_in,
            headers: headers
          });
        };

        var search_more = function search_more(params) {
          var items = params.items || [];
          var query = params.query || '';
          var page = params.page || 1;
          query_more(query, page, items, function (items, have_more) {
            if (items && items.length) {
              _this.wait_similars = true;
              items.forEach(function (c) {
                c.is_similars = true;
              });

              if (have_more) {
                component.similars(items, search_more, {
                  items: [],
                  query: query,
                  page: page + 1
                });
              } else {
                component.similars(items);
              }

              component.loading(false);
            } else if (error_message) component.empty(error_message);else component.emptyForQuery(select_title);
          });
        };

        var display = function display(links, have_more, query) {
          if (links && links.length && links.forEach) {
            var is_sure = false;
            var items = links.map(function (l) {
              var li = $(l);
              var link = $('a', li);
              var enty = $('.enty', link);
              var rating = $('.rating', link);
              var titl = enty.text().trim() || '';
              enty.remove();
              rating.remove();
              var alt_titl = link.text().trim() || '';
              var orig_title = '';
              var year;
              var found = alt_titl.match(/\((.*,\s*)?\b(\d{4})(\s*-\s*[\d.]*)?\)$/);

              if (found) {
                if (found[1]) {
                  var found_alt = found[1].match(/^([^а-яА-ЯёЁ]+),/);
                  if (found_alt) orig_title = found_alt[1].trim();
                }

                year = parseInt(found[2]);
              }

              return {
                year: year,
                title: titl,
                orig_title: orig_title,
                link: link.attr('href') || ''
              };
            });
            var cards = items;

            if (cards.length) {
              if (orig_titles.length) {
                var tmp = cards.filter(function (c) {
                  return component.containsAnyTitle([c.orig_title, c.title], orig_titles);
                });

                if (tmp.length) {
                  cards = tmp;
                  is_sure = true;
                }
              }

              if (select_title) {
                var _tmp = cards.filter(function (c) {
                  return component.containsAnyTitle([c.title, c.orig_title], [select_title]);
                });

                if (_tmp.length) {
                  cards = _tmp;
                  is_sure = true;
                }
              }

              if (cards.length > 1 && search_year) {
                var _tmp2 = cards.filter(function (c) {
                  return c.year == search_year;
                });

                if (!_tmp2.length) _tmp2 = cards.filter(function (c) {
                  return c.year && c.year > search_year - 2 && c.year < search_year + 2;
                });
                if (_tmp2.length) cards = _tmp2;
              }
            }

            if (cards.length == 1 && is_sure) {
              if (search_year && cards[0].year) {
                is_sure = cards[0].year > search_year - 2 && cards[0].year < search_year + 2;
              }

              if (is_sure) {
                is_sure = false;

                if (orig_titles.length) {
                  is_sure |= component.equalAnyTitle([cards[0].orig_title, cards[0].title], orig_titles);
                }

                if (select_title) {
                  is_sure |= component.equalAnyTitle([cards[0].title, cards[0].orig_title], [select_title]);
                }
              }
            }

            if (cards.length == 1 && is_sure) getPage(cards[0].link);else if (items.length) byIds(cards.length ? cards : items, kinopoisk_id, function (hit, matches, body, bodies) {
              if (hit) return body ? gotPage(body, hit.link) : getPage(hit.link);
              // several series pages with the card's ids are an anime's parts: the oldest is opened, the rest join it as seasons
              var first = null;
              matches.forEach(function (c) {
                var f = rezkaIds[c.link];
                if (!f || !f.series) return;
                if (!first || f.part < first.part) first = { card: c, part: f.part };
              });
              if (first) return bodies && bodies[first.card.link] ? gotPage(bodies[first.card.link], first.card.link) : getPage(first.card.link);
              // several pages with the card's ids (an anime's parts): only those are offered
              if (matches.length > 1) {
                items = matches;
                have_more = false;
              }
              _this.wait_similars = true;
              items.forEach(function (c) {
                c.is_similars = true;
              });

              if (have_more) {
                component.similars(items, search_more, {
                  items: [],
                  query: query,
                  page: 1
                });
              } else {
                component.similars(items);
              }

              component.loading(false);
            });else component.emptyForQuery(select_title);
          } else if (error_message) component.empty(error_message);else component.emptyForQuery(select_title);
        };

        var query_search = function query_search(query, data, callback) {
          var postdata = 'q=' + encodeURIComponent(query);
          network.clear();
          network.timeout(10000);
          network["native"](component.proxyLink(url, prox, prox_enc, 'enc2t'), function (str) {
            str = (str || '').replace(/[\r\n]/g, '');
            checkErrorForm(str);
            var links = str.match(/<li><a href=.*?<\/li>/g);
            var have_more = str.indexOf('<a class="b-search__live_all"') !== -1;
            if (links && links.length) data = data.concat(links);
            if (callback) callback(data, have_more, query);
          }, function (a, c) {
            if (prox && a.status == 403 && (!a.responseText || a.responseText.indexOf('<div>105</div>') !== -1)) {
              Lampa.Storage.set('online_mod_proxy_rezka2', 'false');
            }

            if (a.status == 403 && a.responseText) {
              var str = (a.responseText || '').replace(/[\r\n]/g, '');
              checkErrorForm(str);
            }

            if (error_message) component.empty(error_message);else component.empty(network.errorDecode(a, c));
          }, postdata, {
            dataType: 'text',
            withCredentials: logged_in,
            headers: headers
          });
        };

        var query_title_search = function query_title_search() {
          query_search(component.cleanTitle(select_title), [], function (data, have_more, query) {
            if (data && data.length && data.forEach) display(data, have_more, query);else display([]);
          });
        };

        query_title_search();
      };

      this.extendChoice = function (saved) {
        Lampa.Arrays.extend(choice, saved, true);
      };
      /**
       * Сброс фильтра
       */


      this.reset = function () {
        component.reset();
        choice = {
          season: 0,
          voice: 0,
          voice_name: '',
          season_id: ''
        };
        if (parts) usePart(0);
        component.loading(true);
        getEpisodes(success);
        component.saveChoice(choice);
      };
      /**
       * Применить фильтр
       * @param {*} type
       * @param {*} a
       * @param {*} b
       */


      this.filter = function (type, a, b) {
        choice[a.stype] = b.index;
        if (a.stype == 'voice') choice.voice_name = filter_items.voice[b.index];
        if (a.stype == 'season') choice.season_id = filter_items.season_id[b.index];
        // a part is its own page: its voices load when it is chosen
        if (parts && a.stype == 'season') usePart(b.index);
        component.reset();
        component.loading(true);
        getEpisodes(success);
        component.saveChoice(choice);
        setTimeout(component.closeFilter, 10);
      };
      /**
       * Уничтожить
       */


      this.destroy = function () {
        extract = null;
        parts = null;
        network.clear();
        for (var li = 0; li < loaders.length; li++) try { loaders[li].clear(); } catch (e) {}
        loaders = [];
      };

      // The episode list names no qualities: one stream request (not played) teaches the title's best (see getStream)
      this.qualityProbe = function (done) {
        if (!extract || !extract.is_series || rezkaTitleMax(extract.film_id) || !extract.episode || !extract.episode.length) return done();
        var over = false;
        var end = function end() {
          if (over) return;
          over = true;
          clearTimeout(timer);
          done();
        };
        var timer = setTimeout(end, 8000);
        getStream({ media: extract.episode[0] }, end, end);
      };

      // Several titles found: HDrezka's pages carry IMDb/Kinopoisk ids in their rating links (/help/<base64 of the
      // URL-encoded address>/), so up to five candidates are opened and the one with the card's id is taken.
      // call(hit, matches, body): the one match and its page, or null; several matches narrow the list the user picks from.
      var ids_gen = 0;
      function byIds(cards, kinopoisk_id, call) {
        var mine = ++ids_gen;
        // a clarified search is the user's own query: the card's ids do not apply
        var imdb = object.clarification ? '' : object.movie.imdb_id || (/^tt\d+$/.test(kinopoisk_id + '') ? kinopoisk_id + '' : '');
        var kp = object.clarification ? '' : +kinopoisk_id ? kinopoisk_id + '' : +object.movie.kinopoisk_id ? object.movie.kinopoisk_id + '' : '';
        var list = cards.filter(function (c) {
          return c && c.link;
        }).slice(0, 5);
        if (!imdb && !kp || !list.length) return call(null, [], '');
        var matches = [];
        var bodies = {};
        var i = 0;
        var check = function check(card, ids) {
          if (ids && (imdb && ids.imdb === imdb || kp && ids.kp === kp)) matches.push(card);
          next();
        };
        // one page at a time: the first one passes HDrezka's bot check for the rest; a closed screen or a newer
        // search drops the answer
        var next = function next() {
          if (!extract || mine !== ids_gen) return;
          if (i >= list.length) return call(matches.length === 1 ? matches[0] : null, matches, matches.length === 1 ? bodies[matches[0].link] || '' : '', bodies);
          var card = list[i++];
          if (rezkaIds[card.link]) return check(card, rezkaIds[card.link]);
          var net = new Lampa.Reguest();
          loaders.push(net);
          net.timeout(5000);
          anubisFetch(net, component.proxyLink(component.fixLink(card.link, ref), prox, prox_enc, 'enc2t'), false, {
            dataType: 'text',
            withCredentials: logged_in,
            headers: headers
          }, function (res) {
            var body = typeof res.body === 'string' ? res.body : '';
            var ids = rezkaPageIds(body);
            // kept with what the parts choice needs: a series page, the part it is
            ids.series = /\.initCDNSeriesEvents\(/.test(body);
            var me = rezkaParts(body).filter(function (p) {
              return p.current;
            })[0];
            ids.part = me ? me.num : 999;
            // a bot check or an error page has no ids: not kept, asked again next time
            if (ids.imdb || ids.kp) rezkaIds[card.link] = ids;
            bodies[card.link] = body;
            check(card, ids);
          }, function () {
            check(card, null);
          }, !prox && Lampa.Platform.is('android') && Utils.checkAndroidVersion(339));
        };
        next();
      }
      // «Смотреть все части»: an anime's TV parts (each its own page with one season, the page's own ids) become
      // seasons 1..N in the parts' order; a film of the franchise has other ids and stays out. A part's page is
      // its own extract: its voices load when it is chosen.
      var parts = null;
      var part_index = 0;
      var merged_season_id = '';
      var page_chosen = false;

      function mergeParts(str, link, done) {
        var mine = ++ids_gen;
        parts = null;
        var list = rezkaParts(str);
        var own = rezkaPageIds(str);
        // every part is opened and matched by its IMDb/Kinopoisk ids (one request each, kept for the session);
        // shortcut: a list longer than eight (a big franchise of films) is not merged; raise it if a long anime shows up
        if (!extract.is_series || extract.season.length !== 1 || list.length < 2 || list.length > 8 || !own.imdb && !own.kp) return done();

        var keep = [];
        var i = 0;
        // one page at a time; a part that cannot be read (an error, a bot check) leaves the pages as they are,
        // a season missing in the middle would shift every number after it
        var next = function next() {
          if (!extract || mine !== ids_gen) return;
          if (i >= list.length) {
            if (keep.length >= 2) {
              parts = keep;
              part_index = 0;
              keep.forEach(function (p, k) {
                if (p.current) part_index = k;
              });
            }
            return done();
          }
          var p = list[i++];
          if (p.current) {
            p.body = str;
            p.extract = extract;
            p.link = link || '';
            keep.push(p);
            return next();
          }
          if (!p.link) return done();
          // a page already known to be another title is not opened again
          var known = rezkaIds[p.link];
          if (known && !(own.imdb && known.imdb === own.imdb || own.kp && known.kp === own.kp)) return next();

          var net = new Lampa.Reguest();
          loaders.push(net);
          net.timeout(5000);
          anubisFetch(net, component.proxyLink(component.fixLink(p.link, ref), prox, prox_enc, 'enc2t'), false, {
            dataType: 'text',
            withCredentials: logged_in,
            headers: headers
          }, function (res) {
            if (!extract || mine !== ids_gen) return;
            var body = typeof res.body === 'string' ? res.body : '';
            var ids = rezkaPageIds(body);
            // a real page without rating links is another title; anything else (a bot check, an error) stops the merge
            if (!ids.imdb && !ids.kp) return /b-post__partcontent/.test(body) ? next() : done();
            ids.series = /\.initCDNSeriesEvents\(/.test(body);
            ids.part = p.num;
            rezkaIds[p.link] = ids;
            // the same title, a series, one season on its page (a second one would be hidden)
            if ((own.imdb && ids.imdb === own.imdb || own.kp && ids.kp === own.kp) && /\.initCDNSeriesEvents\(/.test(body) && (body.match(/class="b-simple_season__item/g) || []).length <= 1) {
              p.body = body;
              keep.push(p);
            }
            next();
          }, function () {
            if (!extract || mine !== ids_gen) return;
            done();
          }, !prox && Lampa.Platform.is('android') && Utils.checkAndroidVersion(339));
        };
        next();
      }

      function usePart(k) {
        var p = parts && parts[k];
        if (!p) return;
        part_index = k;
        if (!p.extract) {
          extract = {};
          extractData(p.body);
          p.extract = extract;
        }
        extract = p.extract;
      }

      // the part a saved choice names ('p' + its number), else the page that was opened
      function partOfChoice() {
        // a page picked from the list is opened as picked
        if (page_chosen) return part_index;
        var want = /^p(\d+)$/.exec(choice.season_id || '');
        var k = part_index;
        if (want) parts.forEach(function (p, i) {
          if (p.num == want[1]) k = i;
        });
        return k;
      }

      // a page already fetched (by byIds) is used as is, not fetched again
      function gotPage(str, link) {
        parts = null;
        extractData(str);

        if (extract.film_id) {
          mergeParts(str, link, function () {
            if (parts) usePart(partOfChoice());
            getEpisodes(success);
          });
        } else if (error_message) component.empty(error_message);else component.emptyForQuery(select_title);
      }
      function getPage(url) {
        url = component.fixLink(url, ref);
        network.clear();
        network.timeout(10000);
        anubisFetch(network, component.proxyLink(url, prox, prox_enc, 'enc2t'), false, {
          dataType: 'text',
          withCredentials: logged_in,
          headers: headers
        }, function (res) {
          gotPage(typeof res.body === 'string' ? res.body : '', url);
        }, function (a, c) {
          component.empty(network.errorDecode(a, c));
        }, !prox && Lampa.Platform.is('android') && Utils.checkAndroidVersion(339));
      }

      function success() {
        component.loading(false);
        filter();
        append(filtred());
      }
      /**
       * Получить данные о фильме
       * @param {String} str
       */


      function extractData(str) {
        extract.voice = [];
        extract.season = [];
        extract.episode = [];
        extract.voice_data = {};
        extract.all_loaded = false;
        extract.is_series = false;
        extract.film_id = '';
        extract.favs = '';
        str = (str || '').replace(/[\r\n]/g, '');
        checkErrorForm(str);
        var translation = str.match(/<h2>В переводе<\/h2>:<\/td>\s*(<td>.*?<\/td>)/);
        var cdnSeries = str.match(/\.initCDNSeriesEvents\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,/);
        var cdnMovie = str.match(/\.initCDNMoviesEvents\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,/);
        var devVoiceName;

        if (translation) {
          devVoiceName = $(translation[1]).text().trim();
        }

        if (!devVoiceName) devVoiceName = Lampa.Lang.translate('online_mod_original');
        var defVoice, defSeason, defEpisode;

        if (cdnSeries) {
          extract.is_series = true;
          extract.film_id = cdnSeries[1];
          defVoice = {
            name: devVoiceName,
            id: cdnSeries[2]
          };
          defSeason = {
            name: Lampa.Lang.translate('online_mod_season') + ' ' + cdnSeries[3],
            id: cdnSeries[3]
          };
          defEpisode = {
            name: Lampa.Lang.translate('online_mod_episode') + ' ' + cdnSeries[4],
            season_id: cdnSeries[3],
            episode_id: cdnSeries[4]
          };
        } else if (cdnMovie) {
          extract.film_id = cdnMovie[1];
          defVoice = {
            name: devVoiceName,
            id: cdnMovie[2],
            is_camrip: cdnMovie[3],
            is_ads: cdnMovie[4],
            is_director: cdnMovie[5]
          };
        }

        var voices = str.match(/(<ul\b[^>]*\bid=["']translators-list["'].*?<\/ul>)/);
        var voice_ids = {};

        var pushVoice = function pushVoice(el) {
          var id = $(el).attr('data-translator_id');
          if (!id || voice_ids[id]) return;
          voice_ids[id] = true;
          var title = ($(el).attr('title') || $(el).text() || '').trim();
          $('img', el).each(function () {
            var lang = ($(this).attr('title') || $(this).attr('alt') || '').trim();
            if (lang && title.indexOf(lang) == -1) title += ' (' + lang + ')';
          });
          extract.voice.push({
            name: title || devVoiceName,
            id: id,
            is_camrip: $(el).attr('data-camrip'),
            is_ads: $(el).attr('data-ads'),
            is_director: $(el).attr('data-director')
          });
        };

        var voice_els = [];

        if (voices) {
          $('[data-translator_id]', $('<div>' + voices[1] + '</div>')).each(function () {
            voice_els.push(this);
          });
        }

        if (!voice_els.length) {
          // Markup without the usual <ul id="translators-list">: pick any
          // element that carries a translator id.
          var items = str.match(/<(li|a|option|div|span)\b[^>]*\bdata-translator_id=["']?\d+[^>]*>.*?<\/\1>/g) || [];
          items.forEach(function (html) {
            voice_els.push($('<div>' + html + '</div>').children()[0]);
          });
        }

        // Premium-only voices (b-prem_translator) play a placeholder without
        // HDrezka Premium, so they are hidden unless the setting allows them. The list repeats every voice, so collect the marks
        // from all copies before skipping.
        var prem_ids = {};
        if (!show_premium) voice_els.forEach(function (el) {
          if ($(el).hasClass('b-prem_translator') || $(el).parent().hasClass('b-prem_translator')) {
            prem_ids[$(el).attr('data-translator_id')] = true;
          }
        });
        voice_els.forEach(function (el) {
          if (!prem_ids[$(el).attr('data-translator_id')]) pushVoice(el);
        });

        if (!extract.voice.length && defVoice) {
          extract.voice.push(defVoice);
        }

        if (extract.is_series) {
          var seasons = str.match(/(<ul id="simple-seasons-tabs".*?<\/ul>)/);

          if (seasons) {
            var _select = $(seasons[1]);

            $('.b-simple_season__item', _select).each(function () {
              extract.season.push({
                name: $(this).text(),
                id: $(this).attr('data-tab_id')
              });
            });
          }

          if (!extract.season.length && defSeason) {
            extract.season.push(defSeason);
          }

          var episodes = str.match(/(<div id="simple-episodes-tabs".*?<\/div>)/);

          if (episodes) {
            var _select2 = $(episodes[1]);

            $('.b-simple_episode__item', _select2).each(function () {
              extract.episode.push({
                name: $(this).text(),
                season_id: $(this).attr('data-season_id'),
                episode_id: $(this).attr('data-episode_id')
              });
            });
          }

          if (!extract.episode.length && defEpisode) {
            extract.episode.push(defEpisode);
          }
        }

        var favs = str.match(/<input type="hidden" id="ctrl_favs" value="([^"]*)"/);
        if (favs) extract.favs = favs[1];
        var blocked = str.match(/class="b-player__restricted__block_message"/);
        if (blocked) extract.blocked = true;
      }

      function getEpisodes(call) {
        if (!extract.is_series || extract.all_loaded) return call();
        var gen = loaders.gen = (loaders.gen || 0) + 1;
        // answers for a part left meanwhile (an already loaded part does not bump gen) go nowhere
        var ex = extract;
        var last_error = '';
        // HDrezka lists seasons per voice, and voices differ in seasons, so every voice is asked once up front.
        var queue = extract.voice.slice();
        var running = 0;

        var next = function next() {
          if (!queue.length && !running) {
            extract.all_loaded = true;
            var any = extract.voice.some(function (v) {
              return extract.voice_data[v.id] && extract.voice_data[v.id].season.length;
            });
            if (any) call();else component.empty(error_message || last_error || Lampa.Lang.translate('online_mod_nolink'));
            return;
          }

          while (queue.length && running < 4) load(queue.shift());
        };

        var load = function load(voice) {
          var loader = new Lampa.Reguest();
          var url = embed + 'ajax/get_cdn_series/?t=' + Date.now();
          var postdata = 'id=' + encodeURIComponent(extract.film_id);
          postdata += '&translator_id=' + encodeURIComponent(voice.id);
          postdata += '&favs=' + encodeURIComponent(extract.favs);
          postdata += '&action=get_episodes';
          loaders.push(loader);
          running++;
          loader.timeout(10000);
          loader["native"](component.proxyLink(url, prox, prox_enc, 'enc2t'), function (json) {
            if (!extract || extract !== ex || loaders.gen !== gen) return;
            running--;
            extractEpisodes(json, voice.id);
            next();
          }, function (a, c) {
            if (!extract || extract !== ex || loaders.gen !== gen) return;
            running--;
            last_error = loader.errorDecode(a, c);
            next();
          }, postdata, {
            withCredentials: logged_in,
            headers: headers
          });
        };

        next();
      }

      function extractEpisodes(json, translator_id) {
        var data = {
          season: [],
          episode: []
        };

        if (json && json.seasons) {
          var select = $('<ul>' + json.seasons + '</ul>');
          $('.b-simple_season__item', select).each(function () {
            data.season.push({
              name: $(this).text(),
              id: $(this).attr('data-tab_id')
            });
          });
        }

        if (json && json.episodes) {
          var _select3 = $('<div>' + json.episodes + '</div>');

          $('.b-simple_episode__item', _select3).each(function () {
            data.episode.push({
              name: $(this).text(),
              translator_id: translator_id,
              season_id: $(this).attr('data-season_id'),
              episode_id: $(this).attr('data-episode_id')
            });
          });
        }

        extract.voice_data[translator_id] = data;
      }

      /**
       * Построить фильтр
       */

      function filter() {
        filter_items = {
          season: [],
          season_id: [],
          voice: [],
          voice_info: [],
          voice_note: []
        };

        if (extract.is_series) {
          var seen = {};
          extract.season = [];
          extract.voice.forEach(function (v) {
            var data = extract.voice_data[v.id];
            (data && data.season || []).forEach(function (s) {
              if (seen[s.id]) return;
              seen[s.id] = true;
              extract.season.push(s);
            });
          });
          extract.season.sort(function (a, b) {
            return parseInt(a.id) - parseInt(b.id);
          });
          filter_items.season = extract.season.map(function (s) {
            return s.name;
          });
          filter_items.season_id = extract.season.map(function (s) {
            return s.id;
          });
        }

        // merged parts: one season per part, numbered in the parts' order; the page's own season id picks its episodes
        if (parts) {
          merged_season_id = filter_items.season_id[0] || '';
          filter_items.season = parts.map(function (p, k) {
            return Lampa.Lang.translate('torrent_serial_season') + ' ' + (k + 1) + ' — ' + p.title;
          });
          filter_items.season_id = parts.map(function (p) {
            return 'p' + p.num;
          });
          choice.season = part_index;
          choice.season_id = 'p' + parts[part_index].num;
        }

        if (!filter_items.season[choice.season]) choice.season = 0;

        if (choice.season_id) {
          var s_inx = filter_items.season_id.indexOf(choice.season_id);
          if (s_inx == -1) choice.season = 0;else choice.season = s_inx;
        }

        if (extract.is_series) {
          var season_id = parts ? merged_season_id : filter_items.season_id[choice.season];
          extract.voice.forEach(function (v) {
            var data = extract.voice_data[v.id];
            var nums = [];
            (data && data.episode || []).forEach(function (e) {
              if (e.season_id == season_id) nums.push(parseInt(e.episode_id));
            });
            if (!nums.length) return;
            filter_items.voice.push(v.name);
            filter_items.voice_info.push({
              id: v.id
            });
            filter_items.voice_note.push(episodeRanges(nums));
          });
        }

        if (!filter_items.voice[choice.voice]) choice.voice = 0;

        if (choice.voice_name) {
          var v_inx = filter_items.voice.indexOf(choice.voice_name);
          if (v_inx == -1) choice.voice = 0;else choice.voice = v_inx;
        }

        if (extract.is_series) {
          var chosen = filter_items.voice_info[choice.voice];
          var chosen_data = chosen && extract.voice_data[chosen.id];
          extract.episode = chosen_data ? chosen_data.episode : [];
        }

        component.filter(filter_items, choice);
      }

      /**
       * Получить поток
       * @param {*} element
       */


      function getStream(element, call, error) {
        if (element.stream) return call(element);
        var url = embed + 'ajax/get_cdn_series/?t=' + Date.now();
        var postdata = 'id=' + encodeURIComponent(extract.film_id);

        if (extract.is_series) {
          postdata += '&translator_id=' + encodeURIComponent(element.media.translator_id);
          postdata += '&season=' + encodeURIComponent(element.media.season_id);
          postdata += '&episode=' + encodeURIComponent(element.media.episode_id);
          postdata += '&favs=' + encodeURIComponent(extract.favs);
          postdata += '&action=get_stream';
        } else {
          postdata += '&translator_id=' + encodeURIComponent(element.media.id);
          postdata += '&is_camrip=' + encodeURIComponent(element.media.is_camrip);
          postdata += '&is_ads=' + encodeURIComponent(element.media.is_ads);
          postdata += '&is_director=' + encodeURIComponent(element.media.is_director);
          postdata += '&favs=' + encodeURIComponent(extract.favs);
          postdata += '&action=get_movie';
        }

        network.clear();
        network.timeout(10000);
        network["native"](component.proxyLink(url, prox, prox_enc, 'enc2t'), function (json) {
          if (json && json.url) {
            var video = decode(json.url),
                file = '',
                quality = false;
            var items = extractItems(video);

            if (items && items.length) {
              // a title without premium tiers leaves the account's value alone
              var offered = component.parsePlaylist(video);
              var best = rezkaBest(items, offered.length);
              rezkaTitleSave(extract.film_id, rezkaOffered(offered.map(function (p) { return p.label; })));
              if (best && best !== +Lampa.Storage.get('online_mod_rezka2_best', 0)) Lampa.Storage.set('online_mod_rezka2_best', best);
              file = items[0].file;
              quality = {};
              items.forEach(function (item) {
                quality[item.label] = item.file;
              });
            } else if (video && component.parsePlaylist(video).length) {
              // Every quality was the Premium placeholder
              error(Lampa.Lang.translate('online_mod_rezka_premium_only'));
              return;
            }

            if (file) {
              element.stream = file;
              element.qualitys = quality;
              element.subtitles = parseSubtitles(json.subtitle);
              call(element);
            } else error();
          } else error();
        }, function (a, c) {
          error();
        }, postdata, {
          withCredentials: logged_in,
          headers: headers
        });
      }

      function decode(data) {
        if (!startsWith(data, '#')) return data;

        var enc = function enc(str) {
          return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (match, p1) {
            return String.fromCharCode('0x' + p1);
          }));
        };

        var dec = function dec(str) {
          return decodeURIComponent(atob(str).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          }).join(''));
        };

        var trashList = ['$$!!@$$@^!@#$$@', '@@@@@!##!^^^', '####^!!##!@@', '^^^!@##!!##', '$$#!!@#!@##'];
        var x = data.substring(2);
        trashList.forEach(function (trash) {
          x = x.replace('//_//' + enc(trash), '');
        });

        try {
          x = dec(x);
        } catch (e) {
          x = '';
        }

        return x;
      }

      function proxyStream(url) {
        if (url && use_stream_proxy) {
          return url.replace(/\/\/(stream\.voidboost\.(cc|top|link|club)|[^\/]*.ukrtelcdn.net|vdbmate.org|sambray.org|rumbegg.org|laptostack.org|frntroy.org|femeretes.org)\//, rezka2_prx_ukr);
        }

        if (url && rezka2_fix_stream) {
          return url.replace(/\/\/(stream\.voidboost\.(cc|top|link|club)|[^\/]*.ukrtelcdn.net)\//, '//femeretes.org/');
        }

        return url;
      }
      /**
       * Получить потоки
       * @param {String} str
       * @returns array
       */


      function extractItems(str) {
        if (!str) return [];

        try {
          var items = component.parsePlaylist(str).map(function (item) {
            // Premium labels come as '<span ...>1080p Ultra<img ...></span>'
            item.label = (item.label || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
            var int_quality = NaN;
            var quality = item.label.match(/(\d\d\d+)/);

            if (quality) {
              int_quality = parseInt(quality[1]);
            } else {
              quality = item.label.match(/(\d+)K/);

              if (quality) {
                int_quality = parseInt(quality[1]) * 1000;
              }
            }

            var links;

            if (prefer_mp4) {
              links = item.links.filter(function (url) {
                return /\.mp4$/i.test(url);
              });
            } else {
              links = item.links.filter(function (url) {
                return /\.m3u8$/i.test(url);
              });
            }

            if (!links.length) links = item.links;
            var link = links[0] || '';
            link = component.fixLinkProtocol(link, prefer_http, 'full');
            return {
              label: item.label,
              quality: int_quality,
              key: videoKey(link),
              file: proxyStream(link)
            };
          });
          items = dropPremiumStubs(items);
          items.sort(function (a, b) {
            if (b.quality > a.quality) return 1;
            if (b.quality < a.quality) return -1;
            if (b.label > a.label) return 1;
            if (b.label < a.label) return -1;
            return 0;
          });
          return items;
        } catch (e) {}

        return [];
      }

      // Without Premium, HDrezka points premium qualities (and every quality of
      // a premium-only voice) at one shared placeholder video.
      var PREMIUM_STUB_DIR = '/1/5/3/6/4/2/4/';
      var PREMIUM_STUB_FILE = /\/zrkms\.mp4$/i;

      function videoKey(link) {
        return (link || '').replace(/^[a-z]+:\/\/[^\/]+\/[^\/]*:[^\/]*:[^\/]*/i, '').replace(/:hls:manifest\.m3u8$/i, '');
      }

      function dropPremiumStubs(items) {
        var labels = {};
        items.forEach(function (item) {
          if (!item.key) return;
          labels[item.key] = labels[item.key] || {};
          labels[item.key][item.label] = true;
        });
        return items.filter(function (item) {
          if (!item.key) return true;
          if (item.key.indexOf(PREMIUM_STUB_DIR) === 0 || PREMIUM_STUB_FILE.test(item.key)) return false;
          return Object.keys(labels[item.key]).length < 2;
        });
      }

      function parseSubtitles(str) {
        var subtitles = [];

        if (str) {
          subtitles = component.parsePlaylist(str).map(function (item) {
            var link = item.links[0] || '';
            link = component.fixLinkProtocol(link, prefer_http, 'full');
            return {
              label: item.label,
              url: component.processSubs(link)
            };
          });
        }

        return subtitles.length ? subtitles : false;
      }
      /**
       * Отфильтровать файлы
       * @returns array
       */


      function filtred() {
        var filtred = [];

        if (extract.is_series) {
          var season_id = parts ? merged_season_id : filter_items.season_id[choice.season];
          var voice = filter_items.voice[choice.voice];
          // merged parts are numbered in their order, not by the page's own season id
          var season_num = parts ? choice.season + 1 : 0;
          // a free account is offered 4K too, but those tiers are Premium placeholders: cap like the «По сериям» badge
          var max = Math.min(rezkaTitleMax(extract.film_id), +Lampa.Storage.get('online_mod_rezka2_best', 0) || (Lampa.Storage.field('online_mod_rezka2_show_premium') === true ? 1080 : 720));
          var range = max ? '360p ~ ' + (max >= 2160 ? '2160p' : max + 'p') : '360p ~ 1080p';
          extract.episode.forEach(function (episode) {
            if (episode.season_id == season_id) {
              filtred.push({
                title: component.formatEpisodeTitle(season_num || episode.season_id, null, episode.name),
                quality: range,
                info: ' / ' + voice,
                season: season_num || parseInt(episode.season_id),
                episode: parseInt(episode.episode_id),
                media: episode
              });
            }
          });
        } else {
          extract.voice.forEach(function (voice) {
            filtred.push({
              title: voice.name || select_title,
              quality: '360p ~ 1080p',
              info: '',
              media: voice
            });
          });
        }

        return filtred;
      }
      /**
       * Показать файлы
       */


      // Stable id of an episode/voice for DDD's resume (stream links are signed)
      function dddKey(element) {
        var media = element.media || {};
        if (element.season) return ['rezka', extract.film_id, media.translator_id, media.season_id, media.episode_id].join(':');
        return ['rezka', extract.film_id, media.id, media.is_director || 0].join(':');
      }

      function append(items) {
        component.reset();
        var viewed = Lampa.Storage.cache('online_view', 5000, []);
        var last_episode = component.getLastEpisode(items);
        items.forEach(function (element) {
          if (element.season) {
            element.translate_episode_end = last_episode;
            element.translate_voice = filter_items.voice[choice.voice];
          }

          var hash = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title].join('') : object.movie.original_title);
          var view = component.watchView(element, hash, items);
          var item = Lampa.Template.get('online_mod', element);
          var hash_file = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title, filter_items.voice[choice.voice]].join('') : object.movie.original_title + element.title);
          element.timeline = view;
          item.append(Lampa.Timeline.render(view));

          if (Lampa.Timeline.details) {
            item.find('.online__quality').append(Lampa.Timeline.details(view, ' / '));
          }

          if (viewed.indexOf(hash_file) !== -1) item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
          item.on('hover:enter', function () {
            if (element.loading) return;
            if (object.movie.id) Lampa.Favorite.add('history', object.movie, 100);
            element.loading = true;
            getStream(element, function (element) {
              element.loading = false;
              var first = {
                anime_skip: skipOf(element),
                url: component.getDefaultQuality(element.qualitys, element.stream),
                quality: component.renameQualityMap(element.qualitys),
                subtitles: element.subtitles,
                timeline: element.timeline,
                ddd_key: dddKey(element),
                title: element.season ? element.title : select_title + (element.title == select_title ? '' : ' / ' + element.title)
              };

              if (element.season && Lampa.Platform.version) {
                var playlist = [];
                items.forEach(function (elem) {
                  if (elem == element) {
                    playlist.push(first);
                  } else {
                    var cell = {
                      anime_skip: skipOf(elem),
                      url: function url(call) {
                        getStream(elem, function (elem) {
                          cell.url = component.getDefaultQuality(elem.qualitys, elem.stream);
                          cell.quality = component.renameQualityMap(elem.qualitys);
                          cell.subtitles = elem.subtitles;
                          call();
                        }, function () {
                          cell.url = '';
                          call();
                        });
                      },
                      timeline: elem.timeline,
                      ddd_key: dddKey(elem),
                      title: elem.title
                    };
                    playlist.push(cell);
                  }
                });
                playWithoutPreroll(first, playlist);
              } else {
                playWithoutPreroll(first, [first]);
              }

              if (viewed.indexOf(hash_file) == -1) {
                viewed.push(hash_file);
                item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
                Lampa.Storage.set('online_view', viewed);
              }
            }, function (error) {
              element.loading = false;
              Lampa.Noty.show(error || Lampa.Lang.translate(extract.blocked ? 'online_mod_blockedlink' : 'online_mod_nolink'));
            });
          });
          component.append(item);
          component.contextmenu({
            item: item,
            view: view,
            viewed: viewed,
            hash_file: hash_file,
            element: element,
            file: function file(call) {
              getStream(element, function (element) {
                call({
                  file: element.stream,
                  quality: element.qualitys
                });
              }, function (error) {
                Lampa.Noty.show(error || Lampa.Lang.translate(extract.blocked ? 'online_mod_blockedlink' : 'online_mod_nolink'));
              });
            }
          });
        });
        component.start(true);
      }
    }

    var network$3 = new Lampa.Reguest();

    function rezka2Login(success, error) {
      var host = Utils.rezka2Mirror();
      var url = host + '/ajax/login/';
      var postdata = 'login_name=' + encodeURIComponent(Lampa.Storage.get('online_mod_rezka2_name', ''));
      postdata += '&login_password=' + encodeURIComponent(Lampa.Storage.get('online_mod_rezka2_password', ''));
      postdata += '&login_not_save=0';

      var android = Lampa.Platform.is('android');
      var native = android && Utils.checkAndroidVersion(339);
      var headers = android ? { 'User-Agent': Utils.rezka2UserAgent() } : {};
      var cookie = Lampa.Storage.get('online_mod_rezka2_cookie', '') + '';
      if (cookie) headers.Cookie = cookie;

      var storeCookies = function (res) {
        var list = anubisSetCookies(res && res.headers);

        for (var i = 0; i < list.length; i++) {
          var raw = String(list[i]);
          var line = raw.split(';')[0];

          if (!line || line.indexOf('=') === -1) continue;
          if (/Max-Age=0\b/.test(raw)) continue;

          anubisStoreCookie(line, headers);
        }
      };

      var checkPage = function (body) {
        body = (body || '').replace(/\n/g, '');
        var error_form = body.match(/(<div class="error-code">[^<]*<div>[^<]*<\/div>[^<]*<\/div>)\s*(<div class="error-title">[^<]*<\/div>)/);

        if (error_form) {
          Lampa.Noty.show(error_form[0]);
          if (error) error();
          return;
        }

        var verify_form = body.match(/<span>MIRROR<\/span>.*<button type="submit" onclick="\$\.cookie(\([^)]*\))/);

        if (verify_form) {
          Lampa.Noty.show(Lampa.Lang.translate('online_mod_unsupported_mirror') + ' HDrezka');
          rezka2Logout(error, error);
          return;
        }

        if (success) success();
      };

      var handle = function (res) {
        var raw = res && res.body !== undefined ? res.body : res;
        var json = typeof raw === 'string' ? Lampa.Arrays.decodeJson(raw, {}) : raw;

        if (json && (json.success || json.message == 'Уже авторизован на сайте. Необходимо обновить страницу!')) {
          Lampa.Storage.set('online_mod_rezka2_status', 'true');
          storeCookies(res);

          network$3.clear();
          network$3.timeout(8000);

          if (native) {
            anubisFetch(network$3, host + '/', false, {
              dataType: 'text',
              headers: headers
            }, function (page) {
              storeCookies(page);
              checkPage(typeof page.body === 'string' ? page.body : '');
            }, function () {
              if (success) success();
            }, true);
          } else {
            network$3.silent(host + '/', checkPage, function (a, c) {
              if (success) success();
            }, false, {
              dataType: 'text',
              withCredentials: true
            });
          }
        } else {
          Lampa.Storage.set('online_mod_rezka2_status', 'false');
          if (json && json.message) Lampa.Noty.show(typeof json.message === 'object' ? $.map(json.message, function (v) { return v; }).join(' ') : json.message);
          if (error) error();
        }
      };

      network$3.clear();
      network$3.timeout(8000);

      if (native) {
        anubisFetch(network$3, url, postdata, {
          headers: headers
        }, handle, function (a, c) {
          Lampa.Noty.show(network$3.errorDecode(a, c));
          if (error) error();
        }, true);
      } else {
        network$3.silent(url, handle, function (a, c) {
          Lampa.Noty.show(network$3.errorDecode(a, c));
          if (error) error();
        }, postdata, {
          withCredentials: true
        });
      }
    }

    function rezka2Logout(success, error) {
      var url = Utils.rezka2Mirror() + '/logout/';
      var android = Lampa.Platform.is('android');
      var native = android && Utils.checkAndroidVersion(339);
      var headers = android ? { 'User-Agent': Utils.rezka2UserAgent() } : {};
      var cookie = Lampa.Storage.get('online_mod_rezka2_cookie', '') + '';
      if (cookie) headers.Cookie = cookie;

      network$3.clear();
      network$3.timeout(8000);

      var done = function () {
        Lampa.Storage.set('online_mod_rezka2_status', 'false');
        if (success) success();
      };

      if (native) {
        anubisFetch(network$3, url, false, {
          dataType: 'text',
          headers: headers
        }, done, function (a, c) {
          Lampa.Storage.set('online_mod_rezka2_status', 'false');
          Lampa.Noty.show(network$3.errorDecode(a, c));
          if (error) error();
        }, true);
      } else {
        network$3.silent(url, done, function (a, c) {
          Lampa.Storage.set('online_mod_rezka2_status', 'false');
          Lampa.Noty.show(network$3.errorDecode(a, c));
          if (error) error();
        }, false, {
          dataType: 'text',
          withCredentials: true
        });
      }
    }

    /**
     * Anubis — proof-of-work anti-bot on HDrezka mirrors.
     *
     * Mirrors answer protected routes (film pages, /ajax/login/) with a small
     * HTML page containing a SHA-256 challenge. The plugin solves it, passes
     * the challenge and stores the auth cookie, after which the site behaves
     * like in a normal browser.
     */
    function anubisSha256Hex(ascii) {
      function rightRotate(value, amount) {
        return (value >>> amount) | (value << (32 - amount));
      }

      function zeros(count) {
        var s = '';
        while (s.length < count) s += '0';
        return s;
      }

      var mathPow = Math.pow;
      var maxWord = mathPow(2, 32);
      var lengthProperty = 'length';
      var i, j;
      var result = '';
      var words = [];
      var asciiBitLength = ascii[lengthProperty] * 8;
      var hash = anubisSha256Hex.h = anubisSha256Hex.h || [];
      var k = anubisSha256Hex.k = anubisSha256Hex.k || [];
      var primeCounter = k[lengthProperty];
      var isComposite = {};

      for (var candidate = 2; primeCounter < 64; candidate++) {
        if (!isComposite[candidate]) {
          for (i = 0; i < 313; i += candidate) isComposite[i] = candidate;
          hash[primeCounter] = (mathPow(candidate, .5) * maxWord) | 0;
          k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
        }
      }

      ascii += '\x80';
      while (ascii[lengthProperty] % 64 - 56) ascii += '\x00';

      for (i = 0; i < ascii[lengthProperty]; i++) {
        j = ascii.charCodeAt(i);
        if (j >> 8) return '';
        words[i >> 2] |= j << ((3 - i) % 4) * 8;
      }

      words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
      words[words[lengthProperty]] = asciiBitLength;

      for (j = 0; j < words[lengthProperty];) {
        var w = words.slice(j, j += 16);
        var oldHash = hash;

        hash = hash.slice(0, 8);

        for (i = 0; i < 64; i++) {
          var w15 = w[i - 15];
          var w2 = w[i - 2];
          var a = hash[0];
          var e = hash[4];
          var temp1 = hash[7]
            + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
            + ((e & hash[5]) ^ ((~e) & hash[6]))
            + k[i]
            + (w[i] = (i < 16) ? w[i] : (
              w[i - 16]
              + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3))
              + w[i - 7]
              + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))
            ) | 0);
          var temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
            + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

          hash = [(temp1 + temp2) | 0].concat(hash);
          hash[4] = (hash[4] + temp1) | 0;
        }

        for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
      }

      for (i = 0; i < 8; i++) {
        for (j = 3; j + 1; j--) {
          var b = (hash[i] >> (j * 8)) & 255;
          result += ((b < 16) ? 0 : '') + b.toString(16);
        }
      }

      return result;
    }

    function anubisJson(html, id) {
      var match = String(html || '').match(new RegExp('<script id="' + id + '"[^>]*>([\\s\\S]*?)<\\/script>'));

      if (!match) return null;

      try {
        return JSON.parse(match[1].replace(/<\/?[^>]+>/g, '').trim());
      } catch (e) {
        return null;
      }
    }

    function anubisParseChallenge(html) {
      if (typeof html !== 'string' || html.indexOf('anubis_challenge') === -1) return null;

      var data = anubisJson(html, 'anubis_challenge');
      if (!data || !data.challenge || !data.challenge.id || !data.challenge.randomData) return null;

      var rules = data.rules || {};
      var difficulty = parseInt(rules.difficulty != null ? rules.difficulty : data.challenge.difficulty, 10);
      if (!isFinite(difficulty) || difficulty < 0) return null;

      var basePrefix = anubisJson(html, 'anubis_base_prefix');
      if (typeof basePrefix !== 'string') basePrefix = '';

      return {
        id: data.challenge.id,
        randomData: data.challenge.randomData,
        difficulty: difficulty,
        basePrefix: basePrefix
      };
    }

    function anubisSetCookies(headers) {
      var list = headers && (headers['set-cookie'] || headers['Set-Cookie']);
      if (!list) return [];
      if (typeof list === 'string') return [list];
      return list;
    }

    function anubisCookieFromHeaders(headers, part) {
      var list = anubisSetCookies(headers);

      for (var i = 0; i < list.length; i++) {
        var line = String(list[i]);
        if (line.indexOf(part) === -1) continue;
        if (/Max-Age=0\b/.test(line)) continue;
        return line.split(';')[0];
      }

      return '';
    }

    function anubisStoreCookie(line, headersObj) {
      if (!line) return;

      var name = line.split('=')[0];
      var base = (headersObj && headersObj.Cookie) || Lampa.Storage.get('online_mod_rezka2_cookie', '') || '';
      var parts = String(base).split(';');
      var kept = [];

      for (var i = 0; i < parts.length; i++) {
        var part = parts[i].replace(/^\s+|\s+$/g, '');
        if (!part) continue;

        var key = part.split('=')[0];
        if (key === name) continue;
        if (name.indexOf('techaro.lol-anubis-auth') === 0 && key.indexOf('techaro.lol-anubis-auth') === 0) continue;

        kept.push(part);
      }

      kept.push(line);

      var merged = kept.join('; ');
      if (headersObj) headersObj.Cookie = merged;
      Lampa.Storage.set('online_mod_rezka2_cookie', merged);
    }

    function anubisSolve(challenge) {
      var data = challenge.randomData;
      var difficulty = challenge.difficulty;
      var bytes = Math.floor(difficulty / 2);
      var odd = difficulty % 2;
      var zerosPrefix = '';
      var started = Date.now();
      var nonce = 0;
      var limit = 6000000;
      var hash = '';

      while (zerosPrefix.length < bytes * 2) zerosPrefix += '0';

      while (nonce < limit) {
        hash = anubisSha256Hex(data + nonce);

        if (hash.slice(0, bytes * 2) === zerosPrefix && (!odd || hash.charAt(bytes * 2) === '0')) {
          break;
        }

        nonce++;
      }

      return {
        hash: hash,
        nonce: nonce,
        elapsed: Date.now() - started
      };
    }

    function anubisPass(network, requestedUrl, response, challenge, headers, success, error) {
      var verification = anubisCookieFromHeaders(response.headers, 'techaro.lol-anubis-cookie-verification');
      var solved = anubisSolve(challenge);
      var origin = (String(requestedUrl).match(/^https?:\/\/[^\/]+/) || [''])[0];
      var passUrl = origin + (challenge.basePrefix || '') + '/.within.website/x/cmd/anubis/api/pass-challenge'
        + '?id=' + encodeURIComponent(challenge.id)
        + '&response=' + encodeURIComponent(solved.hash)
        + '&nonce=' + solved.nonce
        + '&redir=' + encodeURIComponent(requestedUrl)
        + '&elapsedTime=' + solved.elapsed;

      var passHeaders = {};
      for (var key in headers) {
        if (Object.prototype.hasOwnProperty.call(headers, key)) passHeaders[key] = headers[key];
      }

      var cookie = (headers && headers.Cookie) || Lampa.Storage.get('online_mod_rezka2_cookie', '') || '';
      if (verification) cookie = cookie ? verification + '; ' + cookie : verification;
      if (cookie) passHeaders.Cookie = cookie;

      network.clear();
      network.timeout(15000);
      network['native'](passUrl, function (res) {
        var auth = anubisCookieFromHeaders(anubisNormalize(res).headers, 'techaro.lol-anubis-auth');
        if (auth) anubisStoreCookie(auth, headers);
        success(!!auth);
      }, function () {
        if (error) error();
      }, false, {
        dataType: 'text',
        headers: passHeaders,
        returnHeaders: true
      });
    }

    // With returnHeaders the Android bridge may answer with its own JSON
    // envelope as text: '{"headers":{...},"body":"<html>..."}'. Unwrap it,
    // otherwise the page is parsed with every quote still escaped.
    function anubisUnwrap(value) {
      if (typeof value !== 'string' || value.charAt(0) !== '{' || value.indexOf('"body"') === -1) return null;

      try {
        var parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object' && parsed.body !== undefined) return parsed;
      } catch (e) {}

      return null;
    }

    function anubisNormalize(res) {
      var inner = anubisUnwrap(res) || (res && typeof res === 'object' ? anubisUnwrap(res.body) : null);

      if (inner) {
        return {
          status: inner.status || (res && res.status) || 0,
          headers: inner.headers || (res && res.headers) || {},
          body: inner.body
        };
      }
      if (res && typeof res === 'object' && res.body !== undefined) {
        return { status: res.status || 0, headers: res.headers || {}, body: res.body };
      }
      if (res && typeof res === 'object' && (res.status !== undefined || res.headers !== undefined)) {
        return { status: res.status || 0, headers: res.headers || {}, body: res };
      }
      return { status: 0, headers: {}, body: res };
    }

    /**
     * Request wrapper: sends the request, and when the answer is an Anubis
     * challenge, solves it and repeats the same request once.
     */
    function anubisFetch(network, url, postdata, options, success, error, allow) {
      options = options || {};

      var headers = options.headers || {};
      var retried = false;

      function request() {
        var opts = {};
        for (var key in options) {
          if (Object.prototype.hasOwnProperty.call(options, key)) opts[key] = options[key];
        }

        if (allow) opts.returnHeaders = true;

        network['native'](url, function (res) {
          var normalized = anubisNormalize(res);
          var challenge = allow && !retried ? anubisParseChallenge(normalized.body) : null;

          if (!challenge) {
            success(normalized);
            return;
          }

          retried = true;
          anubisPass(network, url, normalized, challenge, headers, function () {
            request();
          }, function () {
            success(normalized);
          });
        }, error, postdata, opts);
      }

      request();
    }

    function rezka2FillCookie(success, error) {
      var prox = Utils.proxy('rezka2');
      var prox_enc = '';
      var returnHeaders = Lampa.Platform.is('android') && Utils.checkAndroidVersion(339);

      // the login and password must not go through a public CORS proxy: in a browser only the bridge, own server or own proxy
      if (prox && !Lampa.Platform.is('android')) {
        var own_helper = Utils.helperServer();
        var own_proxy = Lampa.Storage.field('online_mod_proxy_other') === true ? Lampa.Storage.field('online_mod_proxy_other_url') + '' : '';
        if (prox !== window.online_mod_rezka_bridge && !(own_helper && prox === own_helper + '/') && !(own_proxy && prox.indexOf(own_proxy) === 0)) prox = window.online_mod_rezka_bridge || (own_helper ? own_helper + '/' : '');
      }

      var proxy_mirror = Lampa.Storage.field('online_mod_proxy_rezka2_mirror') === true;
      var host = prox && !proxy_mirror ? Utils.rezka2Host() : Utils.rezka2Mirror();

      if (!prox && !returnHeaders) {
        Lampa.Noty.show(Lampa.Lang.translate('online_mod_rezka_login_disabled'));
        if (error) error();
        return;
      }

      var user_agent = Utils.rezka2UserAgent();
      var headers = Lampa.Platform.is('android') ? {
        'User-Agent': user_agent
      } : {};

      if (prox) {
        prox_enc += 'param/User-Agent=' + encodeURIComponent(user_agent) + '/';
        prox_enc += 'cookie_plus/param/Cookie=/';
        returnHeaders = false;
      }

      var url = host + '/ajax/login/';
      var postdata = 'login_name=' + encodeURIComponent(Lampa.Storage.get('online_mod_rezka2_name', ''));
      postdata += '&login_password=' + encodeURIComponent(Lampa.Storage.get('online_mod_rezka2_password', ''));
      postdata += '&login_not_save=0';
      network$3.clear();
      network$3.timeout(8000);
      anubisFetch(network$3, Utils.proxyLink(url, prox, prox_enc, 'enc2t'), postdata, {
        headers: headers
      }, function (json) {
        var cookie = '';
        var values = {};
        var sid = '';
        var body = json && json.body !== undefined ? json.body : json || {};
        body = typeof body === 'string' ? Lampa.Arrays.decodeJson(body, {}) : body;

        // Keep cookies we already have (first of all the Anubis auth cookie),
        // otherwise a successful login would drop them.
        String(Lampa.Storage.get('online_mod_rezka2_cookie', '') + '').split(';').forEach(function (part) {
          part = part.replace(/^\s+|\s+$/g, '');
          var eq = part.indexOf('=');
          if (eq === -1) return;
          values[part.slice(0, eq)] = part.slice(eq + 1);
        });

        if (!body.success) {
          if (body.message) Lampa.Noty.show(typeof body.message === 'object' ? $.map(body.message, function (v) { return v; }).join(' ') : body.message);
          if (error) error();
          return;
        }

        var cookieHeaders = json && json.headers && json.headers['set-cookie'] || null;

        if (cookieHeaders && cookieHeaders.forEach) {
          cookieHeaders.forEach(function (param) {
            var parts = param.split(';')[0].split('=');

            if (parts[0]) {
              if (parts[1] === 'deleted') delete values[parts[0]];else values[parts[0]] = parts[1] || '';
            }
          });
        }

        sid = values['PHPSESSID'] || sid;
        delete values['PHPSESSID'];
        var cookies = [];

        for (var name in values) {
          cookies.push(name + '=' + values[name]);
        }

        cookie = cookies.join('; ');

        if (cookie || sid) {
          if (cookie) Lampa.Storage.set('online_mod_rezka2_cookie', cookie);
          if (cookie.indexOf('PHPSESSID=') == -1) cookie = 'PHPSESSID=' + (sid || Utils.randomId(26)) + (cookie ? '; ' + cookie : '');
          var prox_enc2 = prox_enc;

          if (prox) {
            prox_enc2 += 'param/Cookie=' + encodeURIComponent(cookie) + '/';
          } else {
            headers['Cookie'] = cookie;
          }

          network$3.clear();
          network$3.timeout(8000);
          anubisFetch(network$3, Utils.proxyLink(host + '/', prox, prox_enc2, 'enc2t'), false, {
            dataType: 'text',
            headers: headers
          }, function (json) {
            var body = (json && typeof json.body === 'string' ? json.body : '').replace(/\n/g, '');
            var error_form = body.match(/(<div class="error-code">[^<]*<div>[^<]*<\/div>[^<]*<\/div>)\s*(<div class="error-title">[^<]*<\/div>)/);

            if (error_form) {
              Lampa.Noty.show(error_form[0]);
              if (error) error();
              return;
            }

            var cookieHeaders = json && json.headers && json.headers['set-cookie'] || null;

            if (cookieHeaders && cookieHeaders.forEach) {
              cookieHeaders.forEach(function (param) {
                var parts = param.split(';')[0].split('=');

                if (parts[0]) {
                  if (parts[1] === 'deleted') delete values[parts[0]];else values[parts[0]] = parts[1] || '';
                }
              });
              sid = values['PHPSESSID'] || sid;
              delete values['PHPSESSID'];
              var _cookies = [];

              for (var _name in values) {
                _cookies.push(_name + '=' + values[_name]);
              }

              cookie = _cookies.join('; ');
              if (cookie) Lampa.Storage.set('online_mod_rezka2_cookie', cookie);
            }

            var verify_form = body.match(/<span>MIRROR<\/span>.*<button type="submit" onclick="\$\.cookie(\([^)]*\))/);

            if (verify_form) {
              var verify_cookie;

              try {
                verify_cookie = (0, eval)('"use strict"; (function(name, value){ return {name: name, value: value}; })' + verify_form[1] + ';');
              } catch (e) {}

              if (verify_cookie) {
                values[verify_cookie.name] = verify_cookie.value;
                var _cookies2 = [];

                for (var _name2 in values) {
                  _cookies2.push(_name2 + '=' + values[_name2]);
                }

                cookie = _cookies2.join('; ');
                if (cookie) Lampa.Storage.set('online_mod_rezka2_cookie', cookie);
                if (cookie.indexOf('PHPSESSID=') == -1) cookie = 'PHPSESSID=' + (sid || Utils.randomId(26)) + (cookie ? '; ' + cookie : '');
                var prox_enc3 = prox_enc;

                if (prox) {
                  prox_enc3 += 'param/Cookie=' + encodeURIComponent(cookie) + '/';
                } else {
                  headers['Cookie'] = cookie;
                }

                network$3.clear();
                network$3.timeout(8000);
                network$3["native"](Utils.proxyLink(host + '/', prox, prox_enc3, 'enc2t'), function (str) {
                  var json = typeof str === 'string' ? Lampa.Arrays.decodeJson(str, {}) : str;
                  var body = (json && json.body || '').replace(/\n/g, '');
                  var error_form = body.match(/(<div class="error-code">[^<]*<div>[^<]*<\/div>[^<]*<\/div>)\s*(<div class="error-title">[^<]*<\/div>)/);

                  if (error_form) {
                    Lampa.Noty.show(error_form[0]);
                    if (error) error();
                    return;
                  }

                  var verify_form = body.match(/<span>MIRROR<\/span>.*<button type="submit" onclick="\$\.cookie(\([^)]*\))/);

                  if (verify_form) {
                    Lampa.Storage.set('online_mod_rezka2_cookie', '');
                    Lampa.Noty.show(Lampa.Lang.translate('online_mod_unsupported_mirror') + ' HDrezka');
                    if (error) error();
                    return;
                  }

                  var cookieHeaders = json && json.headers && json.headers['set-cookie'] || null;

                  if (cookieHeaders && cookieHeaders.forEach) {
                    cookieHeaders.forEach(function (param) {
                      var parts = param.split(';')[0].split('=');

                      if (parts[0]) {
                        if (parts[1] === 'deleted') delete values[parts[0]];else values[parts[0]] = parts[1] || '';
                      }
                    });
                    sid = values['PHPSESSID'] || sid;
                    delete values['PHPSESSID'];
                    var _cookies3 = [];

                    for (var _name3 in values) {
                      _cookies3.push(_name3 + '=' + values[_name3]);
                    }

                    cookie = _cookies3.join('; ');
                    if (cookie) Lampa.Storage.set('online_mod_rezka2_cookie', cookie);
                  }

                  if (success) success();
                }, function (a, c) {
                  if (success) success();
                }, false, {
                  dataType: 'text',
                  headers: headers,
                  returnHeaders: returnHeaders
                });
                return;
              }
            }

            if (success) success();
          }, function (a, c) {
            if (success) success();
          }, returnHeaders && !prox);
        } else {
          if (error) error();
        }
      }, function (a, c) {
        Lampa.Noty.show(network$3.errorDecode(a, c));
        if (error) error();
      }, returnHeaders && !prox);
    }

    rezka2.initSettings = function (show_all) {
      var android = Lampa.Platform.is('android');
      if (android) Lampa.Storage.set("online_mod_rezka2_status", 'false');
      var balanser_name = 'HDrezka';
      var component_name = 'online_mod_rezka2';
      if (Lampa.SettingsApi.getComponent(component_name)) return;

      {
        var icon = "<svg><use xlink:href=\"#sprite-settings\"></use></svg>";
        Lampa.SettingsApi.addComponent({
          component: component_name,
          icon: icon,
          name: balanser_name
        });
        Lampa.SettingsApi.addParam({
          component: 'online_mod',
          param: {
            name: component_name + '_settings',
            type: 'button'
          },
          field: {
            name: "<div class=\"settings-folder\" style=\"padding:0!important\"><div style=\"width:1.8em;height:1.3em;padding-right:.5em\">".concat(icon, "</div><div style=\"font-size:1.3em\">").concat(balanser_name, "</div></div>")
          },
          onChange: function onChange() {
            Lampa.Settings.create(component_name, {
              onBack: function onBack() {
                Lampa.Settings.create('online_mod');
              }
            });
          }
        });
      }

      if (show_all) {
        Lampa.SettingsApi.addParam({
          component: component_name,
          param: {
            name: 'online_mod_proxy_rezka2',
            type: 'trigger',
            "default": false
          },
          field: {
            name: Lampa.Lang.translate('online_mod_proxy_balanser') + ' ' + balanser_name
          }
        });
      }

      {
        Lampa.SettingsApi.addParam({
          component: component_name,
          param: {
            name: 'online_mod_rezka2_mirror',
            placeholder: Lampa.Lang.translate('settings_cub_not_specified'),
            type: 'input',
            values: '',
            "default": ''
          },
          field: {
            name: Lampa.Lang.translate('online_mod_rezka2_mirror')
          }
        });
      }

      if (show_all) {
        Lampa.SettingsApi.addParam({
          component: component_name,
          param: {
            name: 'online_mod_proxy_rezka2_mirror',
            type: 'trigger',
            "default": false
          },
          field: {
            name: Lampa.Lang.translate('online_mod_proxy_rezka2_mirror')
          }
        });
      }

      {
        Lampa.SettingsApi.addParam({
          component: component_name,
          param: {
            name: 'online_mod_rezka2_name',
            placeholder: Lampa.Lang.translate('settings_cub_not_specified'),
            type: 'input',
            values: '',
            "default": ''
          },
          field: {
            name: Lampa.Lang.translate('online_mod_rezka2_name')
          }
        });
        Lampa.SettingsApi.addParam({
          component: component_name,
          param: {
            name: 'online_mod_rezka2_password',
            placeholder: Lampa.Lang.translate('settings_cub_not_specified'),
            type: 'input',
            values: '',
            "default": ''
          },
          field: {
            name: Lampa.Lang.translate('online_mod_rezka2_password')
          }
        });
      }

      if (!android) addHelperServerParam(component_name);

      if (!android) {
        var rezka2_login = {};
        Lampa.SettingsApi.addParam({
          component: component_name,
          param: {
            name: 'online_mod_rezka2_login',
            type: 'button'
          },
          field: {
            name: Lampa.Lang.translate('online_mod_rezka2_login')
          },
          onRender: function onRender(item) {
            rezka2_login = item;
            item.append("<div class=\"settings-param__status\"></div>");
          },
          onChange: function onChange() {
            var rezka2_login_status = $('.settings-param__status', rezka2_login).removeClass('active error wait').addClass('wait');
            (Utils.proxy('rezka2') ? rezka2FillCookie : rezka2Login)(function () {
              rezka2_login_status.removeClass('active error wait').addClass('active');
            }, function () {
              rezka2_login_status.removeClass('active error wait').addClass('error');
            });
          }
        });
        var rezka2_logout = {};
        Lampa.SettingsApi.addParam({
          component: component_name,
          param: {
            name: 'online_mod_rezka2_logout',
            type: 'button'
          },
          field: {
            name: Lampa.Lang.translate('online_mod_rezka2_logout')
          },
          onRender: function onRender(item) {
            rezka2_logout = item;
            item.append("<div class=\"settings-param__status\"></div>");
          },
          onChange: function onChange() {
            var rezka2_logout_status = $('.settings-param__status', rezka2_logout).removeClass('active error wait').addClass('wait');
            if (Utils.proxy('rezka2')) {
              var done = function () {
                Lampa.Storage.set('online_mod_rezka2_cookie', '');
                Lampa.Storage.set('online_mod_rezka2_status', 'false');
                rezka2_logout_status.removeClass('active error wait').addClass('active');
              };
              if (window.online_mod_rezka_bridge) {
                network$3.silent(window.online_mod_rezka_bridge + Utils.rezka2Host() + '/logout/', done, done, false, { dataType: 'text' });
              } else {
                done();
              }
            } else {
              rezka2Logout(function () {
                rezka2_logout_status.removeClass('active error wait').addClass('active');
              }, function () {
                rezka2_logout_status.removeClass('active error wait').addClass('error');
              });
            }
          }
        });
      }

      if (show_all || android) {
        var rezka2_cookie = {};
        Lampa.SettingsApi.addParam({
          component: component_name,
          param: {
            name: 'online_mod_rezka2_cookie',
            placeholder: Lampa.Lang.translate('settings_cub_not_specified'),
            type: 'input',
            values: '',
            "default": ''
          },
          field: {
            name: Lampa.Lang.translate('online_mod_rezka2_cookie')
          },
          onRender: function onRender(item) {
            rezka2_cookie = item;
          }
        });
        var rezka2_fill_cookie = {};
        Lampa.SettingsApi.addParam({
          component: component_name,
          param: {
            name: 'online_mod_rezka2_fill_cookie',
            type: 'button'
          },
          field: {
            name: Lampa.Lang.translate('online_mod_rezka2_fill_cookie')
          },
          onRender: function onRender(item) {
            rezka2_fill_cookie = item;
            item.append("<div class=\"settings-param__status\"></div>");
          },
          onChange: function onChange() {
            var rezka2_fill_cookie_status = $('.settings-param__status', rezka2_fill_cookie).removeClass('active error wait').addClass('wait');
            rezka2FillCookie(function () {
              rezka2_fill_cookie_status.removeClass('active error wait').addClass('active');
              Lampa.Params.update(rezka2_cookie, [], null);
            }, function () {
              rezka2_fill_cookie_status.removeClass('active error wait').addClass('error');
              Lampa.Params.update(rezka2_cookie, [], null);
            });
          }
        });
      }

      {
        Lampa.SettingsApi.addParam({
          component: component_name,
          param: {
            name: 'online_mod_rezka2_show_premium',
            type: 'trigger',
            "default": false
          },
          field: {
            name: Lampa.Lang.translate('online_mod_rezka2_show_premium')
          }
        });
        Lampa.SettingsApi.addParam({
          component: component_name,
          param: {
            name: 'online_mod_rezka2_fix_stream',
            type: 'trigger',
            "default": false
          },
          field: {
            name: Lampa.Lang.translate('online_mod_rezka2_fix_stream')
          }
        });
        Lampa.SettingsApi.addParam({
          component: component_name,
          param: {
            name: 'online_mod_use_stream_proxy',
            type: 'trigger',
            "default": false
          },
          field: {
            name: Lampa.Lang.translate('online_mod_use_stream_proxy')
          }
        });
        Lampa.SettingsApi.addParam({
          component: component_name,
          param: {
            name: 'online_mod_rezka2_prx_ukr',
            type: 'select',
            values: {
              'prx.ukrtelcdn.net': 'prx.ukrtelcdn.net',
              'prx-cogent.ukrtelcdn.net': 'prx-cogent.ukrtelcdn.net',
              'prx2-cogent.ukrtelcdn.net': 'prx2-cogent.ukrtelcdn.net',
              'prx3-cogent.ukrtelcdn.net': 'prx3-cogent.ukrtelcdn.net',
              'prx4-cogent.ukrtelcdn.net': 'prx4-cogent.ukrtelcdn.net',
              'prx-ams.ukrtelcdn.net': 'prx-ams.ukrtelcdn.net',
              'prx2-ams.ukrtelcdn.net': 'prx2-ams.ukrtelcdn.net'
            },
            "default": 'prx.ukrtelcdn.net'
          },
          field: {
            name: Lampa.Lang.translate('online_mod_rezka2_prx_ukr')
          }
        });
      }
    };

    rezka2.hideSettings = function (body) {
      $('[data-component="online_mod_rezka2"]', body).hide();
    };

    function kinobase(component, _object, config) {
      var network = new Lampa.Reguest();
      var extract = [];
      var object = _object;
      var select_title = '';
      var is_playlist = false;
      var quality_type = '';
      var translation = '';
      var prefer_mp4 = Lampa.Storage.field('online_mod_prefer_mp4') === true;
      var file_type = prefer_mp4 ? 'mp4' : 'hls';
      var prox = component.proxy('kinobase');
      var host = prox ? 'https://kinobase.org' : Utils.kinobaseMirror();
      var ref = host + '/';
      var embed = ref;
      var logged_in = !(prox || Lampa.Platform.is('android'));
      var user_agent = Utils.baseUserAgent();
      var check_cookie = Lampa.Storage.get('online_mod_kinobase_cookie', '') + '';
      var prox_enc_stream = '';
      var decrypt = Utils.decodeSecret([110, 62, 22, 19, 66, 73, 51, 7, 27, 59, 56, 105, 94, 86, 74, 92, 50, 27, 17, 44, 37, 36, 11, 94, 17, 89, 53, 28, 2, 44, 125, 103, 69, 5, 1, 72, 46, 5, 6, 106, 96, 107, 22, 2, 16, 22, 103, 37, 62, 25, 21, 14, 55, 41, 54, 99, 23, 48, 94, 120, 10, 2, 41, 51, 61, 110, 30, 37, 55, 116, 108, 62, 22, 19, 16, 22, 103, 3, 29, 60, 101, 48, 69, 0, 3, 72, 103, 7, 23, 43, 108, 118, 69, 45, 63, 1, 103, 3, 19, 42, 108, 59, 9, 23, 27, 95, 53, 85, 79, 120, 34, 62, 9, 26, 89, 26, 49, 20, 0, 120, 40, 36, 6, 3, 15, 95, 41, 1, 82, 101, 108, 99, 11, 19, 21, 26, 3, 58, 63, 8, 45, 57, 22, 19, 16, 19, 105, 5, 19, 42, 63, 46, 35, 4, 13, 87, 20, 1, 0, 49, 34, 44, 77, 84, 94, 82, 34, 20, 22, 102, 112, 100, 13, 19, 3, 94, 121, 73, 16, 55, 40, 50, 91, 74, 77, 88, 40, 17, 11, 102, 110, 103, 69, 84, 22, 95, 63, 1, 93, 48, 56, 38, 9, 84, 75, 1, 103, 3, 19, 42, 108, 59, 4, 3, 17, 95, 24, 1, 27, 53, 41, 107, 88, 86, 82, 1, 103, 3, 19, 42, 108, 45, 51, 25, 11, 94, 103, 72, 82, 62, 57, 37, 6, 2, 11, 85, 41, 93, 91, 35, 49, 112, 69, 0, 3, 72, 103, 19, 59, 54, 56, 107, 88, 86, 4, 79, 41, 22, 6, 49, 35, 37, 77, 95, 25, 26, 53, 16, 6, 45, 62, 37, 69, 71, 89, 26, 58, 78, 82, 46, 45, 57, 69, 46, 47, 118, 15, 1, 6, 40, 30, 46, 20, 3, 7, 73, 51, 85, 79, 120, 42, 62, 11, 21, 22, 83, 40, 27, 82, 0, 1, 7, 45, 2, 22, 74, 21, 16, 3, 45, 41, 56, 17, 94, 75, 65, 103, 1, 26, 49, 63, 101, 10, 6, 7, 84, 103, 72, 82, 62, 57, 37, 6, 2, 11, 85, 41, 93, 31, 116, 108, 62, 76, 13, 66, 72, 34, 6, 92, 40, 57, 56, 13, 94, 25, 26, 50, 7, 30, 98, 108, 62, 69, 11, 75, 1, 103, 8, 73, 120, 56, 35, 12, 5, 76, 73, 34, 27, 22, 120, 113, 107, 3, 3, 12, 89, 51, 28, 29, 54, 100, 98, 30, 11, 89, 26, 58, 78, 82, 46, 45, 57, 69, 38, 14, 91, 62, 16, 0, 50, 63, 107, 88, 86, 4, 79, 41, 22, 6, 49, 35, 37, 69, 38, 14, 91, 62, 16, 0, 50, 63, 99, 10, 6, 22, 19, 60, 85, 2, 52, 45, 50, 0, 4, 66, 7, 103, 26, 2, 44, 119, 107, 24, 77, 66, 76, 38, 7, 82, 58, 45, 32, 84, 68, 81, 26, 122, 85, 9, 120, 45, 33, 4, 14, 49, 95, 51, 0, 2, 98, 108, 111, 75, 23, 8, 91, 63, 38, 23, 44, 57, 59, 73, 86, 1, 85, 40, 30, 27, 61, 118, 107, 65, 88, 1, 85, 40, 30, 27, 61, 96, 107, 4, 28, 3, 66, 125, 85, 86, 118, 45, 33, 4, 14, 78, 26, 32, 16, 6, 98, 108, 111, 75, 17, 7, 78, 107, 85, 2, 55, 63, 63, 95, 86, 70, 20, 55, 26, 1, 44, 96, 107, 2, 19, 22, 105, 36, 7, 27, 40, 56, 113, 69, 82, 76, 93, 34, 1, 33, 59, 62, 34, 21, 2, 78, 26, 52, 16, 6, 12, 37, 38, 0, 25, 23, 78, 125, 85, 5, 49, 34, 47, 10, 1, 76, 73, 34, 1, 38, 49, 33, 46, 10, 3, 22, 22, 103, 22, 30, 61, 45, 57, 49, 31, 15, 95, 40, 0, 6, 98, 108, 60, 12, 24, 6, 85, 48, 91, 17, 52, 41, 42, 23, 34, 11, 87, 34, 26, 7, 44, 96, 107, 22, 19, 22, 115, 41, 1, 23, 42, 58, 42, 9, 76, 66, 77, 46, 27, 22, 55, 59, 101, 22, 19, 22, 115, 41, 1, 23, 42, 58, 42, 9, 90, 66, 89, 43, 16, 19, 42, 5, 37, 17, 19, 16, 76, 38, 25, 72, 120, 59, 34, 11, 18, 13, 77, 105, 22, 30, 61, 45, 57, 44, 24, 22, 95, 53, 3, 19, 52, 96, 107, 6, 25, 12, 73, 40, 25, 23, 98, 108, 60, 12, 24, 6, 85, 48, 91, 17, 55, 34, 56, 10, 26, 7, 22, 103, 37, 30, 57, 53, 46, 23, 28, 17, 0, 103, 2, 27, 54, 40, 36, 18, 88, 50, 86, 38, 12, 23, 42, 38, 56, 73, 86, 4, 84, 24, 28, 28, 49, 56, 113, 69, 82, 76, 92, 41, 91, 27, 54, 37, 63, 73, 86, 4, 84, 24, 7, 23, 57, 40, 50, 95, 86, 70, 20, 33, 27, 92, 42, 41, 42, 1, 15, 78, 26, 24, 79, 82, 122, 110, 107, 24, 77, 66, 78, 53, 12, 82, 35, 108, 63, 23, 15, 66, 65, 103, 81, 92, 57, 38, 42, 29, 37, 7, 78, 50, 5, 82, 101, 108, 111, 75, 21, 13, 85, 44, 28, 23, 120, 113, 107, 3, 32, 13, 83, 35, 78, 82, 124, 98, 42, 15, 23, 26, 26, 122, 85, 20, 45, 34, 40, 17, 31, 13, 84, 111, 6, 23, 44, 56, 34, 11, 17, 17, 19, 60, 85, 27, 62, 108, 99, 22, 19, 22, 78, 46, 27, 21, 43, 98, 38, 0, 2, 10, 85, 35, 85, 79, 101, 113, 107, 71, 62, 39, 123, 3, 87, 82, 36, 48, 107, 22, 19, 22, 78, 46, 27, 21, 43, 98, 63, 28, 6, 7, 26, 122, 72, 79, 120, 110, 3, 32, 55, 38, 24, 110, 14, 82, 49, 42, 107, 77, 5, 7, 78, 51, 28, 28, 63, 63, 101, 22, 3, 1, 89, 34, 6, 1, 113, 108, 56, 0, 2, 22, 83, 41, 18, 1, 118, 63, 62, 6, 21, 7, 73, 52, 93, 28, 45, 32, 39, 73, 86, 64, 73, 50, 22, 17, 61, 63, 56, 71, 90, 66, 65, 58, 92, 73, 120, 37, 45, 69, 94, 17, 95, 51, 1, 27, 54, 43, 56, 75, 21, 13, 87, 55, 25, 23, 44, 41, 98, 69, 5, 7, 78, 51, 28, 28, 63, 63, 101, 6, 25, 15, 74, 43, 16, 6, 61, 100, 48, 24, 90, 66, 24, 52, 0, 17, 59, 41, 56, 22, 84, 75, 1, 103, 8, 82, 61, 32, 56, 0, 86, 11, 92, 103, 93, 7, 43, 41, 57, 69, 80, 68, 26, 111, 90, 46, 119, 57, 56, 0, 4, 61, 94, 38, 1, 19, 119, 101, 101, 17, 19, 17, 78, 111, 6, 23, 44, 56, 34, 11, 17, 17, 20, 50, 7, 30, 113, 101, 48, 69, 31, 4, 26, 111, 6, 23, 44, 56, 34, 11, 17, 17, 20, 52, 0, 17, 59, 41, 56, 22, 95, 66, 73, 34, 1, 6, 49, 34, 44, 22, 88, 17, 79, 36, 22, 23, 43, 63, 99, 16, 5, 7, 72, 107, 85, 80, 43, 57, 40, 6, 19, 17, 73, 101, 89, 82, 35, 49, 98, 94, 86, 31, 26, 34, 25, 1, 61, 108, 34, 3, 86, 74, 76, 40, 17, 82, 126, 106, 107, 77, 89, 62, 21, 28, 43, 46, 119, 17, 97, 57, 89, 62, 94, 108, 90, 91, 118, 56, 46, 22, 2, 74, 73, 34, 1, 6, 49, 34, 44, 22, 88, 23, 72, 43, 92, 91, 35, 108, 34, 3, 86, 74, 73, 34, 1, 6, 49, 34, 44, 22, 88, 17, 79, 36, 22, 23, 43, 63, 98, 69, 5, 7, 78, 51, 28, 28, 63, 63, 101, 22, 3, 1, 89, 34, 6, 1, 112, 58, 36, 1, 90, 66, 24, 52, 0, 17, 59, 41, 56, 22, 84, 78, 26, 60, 8, 91, 99, 108, 54, 69, 19, 14, 73, 34, 85, 27, 62, 108, 99, 22, 19, 22, 78, 46, 27, 21, 43, 98, 62, 23, 26, 75, 26, 53, 16, 1, 118, 60, 62, 22, 30, 74, 65, 51, 12, 2, 61, 118, 107, 71, 23, 8, 91, 63, 87, 94, 120, 57, 57, 9, 76, 66, 73, 34, 1, 6, 49, 34, 44, 22, 88, 23, 72, 43, 89, 82, 40, 45, 57, 4, 27, 17, 0, 103, 6, 23, 44, 56, 34, 11, 17, 17, 20, 35, 20, 6, 57, 49, 98, 94, 86, 31, 1, 103, 81, 92, 63, 41, 63, 69, 75, 66, 92, 50, 27, 17, 44, 37, 36, 11, 94, 23, 72, 43, 89, 82, 60, 45, 63, 4, 95, 25, 26, 53, 16, 1, 118, 60, 62, 22, 30, 74, 65, 51, 12, 2, 61, 118, 107, 71, 17, 7, 78, 101, 89, 82, 45, 62, 39, 95, 86, 23, 72, 43, 89, 82, 40, 45, 57, 4, 27, 17, 0, 103, 17, 19, 44, 45, 54, 76, 77, 66, 71, 124, 85, 86, 118, 60, 36, 22, 2, 66, 7, 103, 19, 7, 54, 47, 63, 12, 25, 12, 18, 50, 7, 30, 116, 108, 47, 4, 2, 3, 19, 60, 85, 0, 61, 63, 101, 21, 3, 17, 82, 111, 14, 6, 33, 60, 46, 95, 86, 64, 74, 40, 6, 6, 122, 96, 107, 16, 4, 14, 0, 103, 0, 0, 52, 96, 107, 21, 23, 16, 91, 42, 6, 72, 120, 40, 42, 17, 23, 31, 19, 124, 85, 15, 99, 108, 111, 75, 17, 7, 78, 20, 22, 0, 49, 60, 63, 69, 75, 66, 92, 50, 27, 17, 44, 37, 36, 11, 94, 23, 72, 43, 92, 9, 120, 62, 46, 22, 88, 18, 79, 52, 29, 90, 35, 56, 50, 21, 19, 88, 26, 101, 18, 23, 44, 31, 40, 23, 31, 18, 78, 101, 89, 82, 45, 62, 39, 95, 86, 23, 72, 43, 89, 82, 40, 45, 57, 4, 27, 17, 0, 103, 14, 80, 7, 110, 113, 69, 50, 3, 78, 34, 91, 28, 55, 59, 99, 76, 11, 31, 19, 124, 85, 15, 99, 108, 60, 12, 24, 6, 85, 48, 91, 1, 61, 56, 31, 12, 27, 7, 85, 50, 1, 82, 101, 108, 60, 12, 24, 6, 85, 48, 91, 1, 61, 56, 2, 11, 2, 7, 72, 49, 20, 30, 120, 113, 107, 3, 63, 12, 78, 124, 85, 5, 49, 34, 47, 10, 1, 76, 89, 43, 16, 19, 42, 24, 34, 8, 19, 13, 79, 51, 85, 79, 120, 59, 34, 11, 18, 13, 77, 105, 22, 30, 61, 45, 57, 44, 24, 22, 95, 53, 3, 19, 52, 108, 118, 69, 16, 52, 85, 46, 17, 73, 120, 59, 34, 11, 18, 13, 77, 105, 22, 29, 54, 63, 36, 9, 19, 66, 7, 103, 14, 15, 99, 108, 60, 12, 24, 6, 85, 48, 91, 34, 52, 45, 50, 0, 4, 8, 73, 103, 72, 82, 8, 32, 42, 28, 19, 16, 80, 52, 78, 82, 124, 98, 45, 11, 88, 11, 84, 46, 1, 82, 101, 108, 45, 16, 24, 1, 78, 46, 26, 28, 112, 63, 103, 69, 21, 78, 26, 53, 92, 9, 120, 47, 107, 88, 86, 1, 26, 59, 9, 82, 60, 35, 40, 16, 27, 7, 84, 51, 78, 82, 42, 41, 63, 16, 4, 12, 26, 41, 16, 5, 120, 46, 42, 14, 71, 80, 9, 105, 19, 28, 7, 37, 37, 12, 2, 74, 73, 107, 85, 17, 116, 108, 57, 76, 77, 66, 71, 124, 85, 86, 118, 42, 37, 75, 4, 7, 91, 35, 12, 82, 101, 108, 45, 16, 24, 1, 78, 46, 26, 28, 112, 36, 98, 30, 86, 16, 95, 51, 0, 0, 54, 108, 35, 69, 80, 68, 26, 47, 93, 91, 99, 108, 54, 94, 86, 21, 83, 41, 17, 29, 47, 98, 27, 41, 55, 59, 127, 21, 42, 38, 1, 28, 14, 69, 75, 66, 106, 11, 52, 43, 29, 30, 20, 49, 47, 50, 127, 124, 85, 5, 49, 34, 47, 10, 1, 76, 124, 14, 57, 55, 7, 24, 18, 53, 51, 66, 7, 103, 51, 59, 20, 9, 20, 49, 47, 50, 127, 124, 85, 27, 62, 108, 99, 22, 21, 16, 83, 55, 1, 67, 113, 108, 99, 85, 90, 66, 95, 49, 20, 30, 113, 100, 56, 6, 4, 11, 74, 51, 68, 91, 99, 108, 34, 3, 86, 74, 73, 36, 7, 27, 40, 56, 121, 76, 86, 74, 10, 107, 85, 23, 46, 45, 39, 76, 94, 17, 89, 53, 28, 2, 44, 126, 98, 94, 86, 7, 76, 38, 25, 90, 43, 56, 57, 76, 77, 66, 71, 103, 19, 27, 54, 45, 39, 9, 15, 66, 65, 103, 81, 92, 57, 38, 42, 29, 37, 7, 78, 50, 5, 82, 101, 108, 41, 4, 29, 83, 8, 116, 91, 19, 50, 45, 51, 54, 19, 22, 79, 55, 78, 82, 124, 98, 40, 10, 25, 9, 83, 34, 85, 79, 120, 46, 42, 14, 71, 80, 9, 105, 22, 29, 55, 39, 34, 0, 77, 66, 30, 105, 20, 24, 57, 52, 107, 88, 86, 0, 91, 44, 68, 64, 107, 98, 42, 15, 23, 26, 1, 103, 81, 92, 63, 41, 63, 69, 75, 66, 88, 38, 30, 67, 106, 127, 101, 2, 19, 22, 1, 103, 81, 92, 40, 35, 56, 17, 86, 95, 26, 37, 20, 25, 105, 126, 120, 75, 6, 13, 73, 51, 78, 82, 124, 98, 44, 0, 2, 49, 89, 53, 28, 2, 44, 108, 118, 69, 20, 3, 81, 118, 71, 65, 118, 43, 46, 17, 37, 1, 72, 46, 5, 6, 99, 108, 60, 12, 24, 6, 85, 48, 91, 1, 61, 56, 31, 12, 27, 7, 85, 50, 1, 82, 101, 108, 41, 4, 29, 83, 8, 116, 91, 1, 61, 56, 31, 12, 27, 7, 85, 50, 1, 73, 120, 59, 34, 11, 18, 13, 77, 105, 22, 30, 61, 45, 57, 49, 31, 15, 95, 40, 0, 6, 120, 113, 107, 7, 23, 9, 11, 117, 70, 92, 59, 32, 46, 4, 4, 54, 83, 42, 16, 29, 45, 56, 112, 69, 1, 11, 84, 35, 26, 5, 118, 63, 46, 17, 63, 12, 78, 34, 7, 4, 57, 32, 107, 88, 86, 0, 91, 44, 68, 64, 107, 98, 56, 0, 2, 43, 84, 51, 16, 0, 46, 45, 39, 94, 86, 21, 83, 41, 17, 29, 47, 98, 40, 9, 19, 3, 72, 14, 27, 6, 61, 62, 61, 4, 26, 66, 7, 103, 23, 19, 51, 125, 121, 86, 88, 1, 86, 34, 20, 0, 17, 34, 63, 0, 4, 20, 91, 43, 78, 82, 47, 37, 37, 1, 25, 21, 20, 36, 26, 28, 43, 35, 39, 0, 86, 95, 26, 37, 20, 25, 105, 126, 120, 75, 21, 13, 84, 52, 26, 30, 61, 119, 107, 18, 31, 12, 94, 40, 2, 92, 8, 32, 42, 28, 19, 16, 80, 52, 85, 79, 120, 46, 42, 14, 71, 80, 9, 105, 37, 30, 57, 53, 46, 23, 28, 17, 1, 103, 81, 92, 62, 34, 101, 12, 24, 11, 78, 103, 72, 82, 58, 45, 32, 84, 68, 81, 20, 33, 27, 45, 49, 34, 34, 17, 77, 66, 30, 105, 19, 28, 118, 62, 46, 4, 18, 27, 26, 122, 85, 16, 57, 39, 122, 87, 69, 76, 72, 34, 20, 22, 33, 119, 107, 24, 86, 31, 26, 36, 20, 6, 59, 36, 107, 77, 19, 75, 65, 103, 8, 82, 46, 45, 57, 69, 6, 3, 72, 38, 24, 1, 120, 113, 107, 30, 11, 89, 26, 53, 16, 1, 118, 42, 36, 23, 51, 3, 89, 47, 93, 20, 45, 34, 40, 17, 31, 13, 84, 103, 93, 2, 113, 55, 107, 12, 16, 66, 18, 111, 90, 46, 119, 57, 56, 0, 4, 61, 94, 38, 1, 19, 119, 101, 101, 17, 19, 17, 78, 111, 5, 92, 45, 62, 39, 76, 95, 66, 74, 38, 7, 19, 53, 63, 101, 16, 5, 7, 72, 103, 72, 82, 40, 119, 107, 12, 16, 66, 18, 111, 90, 46, 119, 23, 21, 57, 89, 63, 16, 27, 90, 46, 60, 103, 100, 76, 88, 22, 95, 52, 1, 90, 40, 98, 62, 23, 26, 75, 19, 103, 5, 19, 42, 45, 38, 22, 88, 20, 85, 35, 85, 79, 120, 60, 112, 69, 11, 75, 1, 103, 5, 19, 42, 45, 38, 22, 88, 18, 86, 38, 12, 23, 42, 108, 118, 69, 6, 14, 91, 62, 16, 0, 99, 108, 57, 0, 2, 23, 72, 41, 85, 2, 57, 62, 42, 8, 5, 89, 26, 58, 92, 92, 59, 45, 39, 9, 94, 25, 71, 107]);

      var filter_items = {};
      var choice = {
        season: 0,
        voice: 0
      };
      /**
       * Поиск
       * @param {Object} _object
       * @param {String} kinopoisk_id
       */

      this.search = function (_object, kinopoisk_id, data) {
        var _this = this;

        object = _object;
        select_title = object.search || object.movie.title;
        if (this.wait_similars && data && data[0].is_similars) return getPage(data[0].link);
        var url = embed + 'search?query=' + encodeURIComponent(component.cleanTitle(select_title));
        var cookie = check_cookie;
        var headers = Lampa.Platform.is('android') ? {
          'Origin': host,
          'Referer': ref,
          'User-Agent': user_agent,
          'Cookie': cookie
        } : {};
        var prox_enc_page = '';

        if (prox) {
          prox_enc_page += 'param/Origin=' + encodeURIComponent(host) + '/';
          prox_enc_page += 'param/Referer=' + encodeURIComponent(ref) + '/';
          prox_enc_page += 'param/User-Agent=' + encodeURIComponent(user_agent) + '/';
          prox_enc_stream = prox_enc_page;
          prox_enc_page += 'param/Cookie=' + encodeURIComponent(cookie) + '/';
        }

        network.clear();
        network.timeout(1000 * 10);
        network["native"](component.proxyLink(url, prox, prox_enc_page), function (str) {
          str = (str || '').replace(/\n/g, '');
          var links = object.movie.number_of_seasons ? str.match(/<div class="title"><a href="\/(serial|tv_show)\/([^"]*)"[^>]*>(.*?)<\/a><\/div>/g) : str.match(/<div class="title"><a href="\/film\/([^"]*)"[^>]*>(.*?)<\/a><\/div>/g);
          var search_date = object.search_date || !object.clarification && (object.movie.release_date || object.movie.first_air_date || object.movie.last_air_date) || '0000';
          var search_year = parseInt((search_date + '').slice(0, 4));

          if (links) {
            var is_sure = false;
            var items = links.map(function (l) {
              var div = $(l),
                  link = $('a', div),
                  titl = link.attr('title') || link.text() || '';
              var year;
              var found = titl.match(/^(.*)\((\d{4})\)$/);

              if (found) {
                year = parseInt(found[2]);
                titl = found[1].trim();
              }

              return {
                year: year,
                title: titl,
                link: link.attr('href') || ''
              };
            });
            var cards = items;

            if (cards.length) {
              if (select_title) {
                var tmp = cards.filter(function (c) {
                  return component.containsTitle(c.title, select_title);
                });

                if (tmp.length) {
                  cards = tmp;
                  is_sure = true;
                }
              }

              if (cards.length > 1 && search_year) {
                var _tmp = cards.filter(function (c) {
                  return c.year == search_year;
                });

                if (!_tmp.length) _tmp = cards.filter(function (c) {
                  return c.year && c.year > search_year - 2 && c.year < search_year + 2;
                });
                if (_tmp.length) cards = _tmp;
              }
            }

            if (cards.length == 1 && is_sure) {
              if (search_year && cards[0].year) {
                is_sure = cards[0].year > search_year - 2 && cards[0].year < search_year + 2;
              }

              if (is_sure) {
                is_sure = false;

                if (select_title) {
                  is_sure |= component.equalTitle(cards[0].title, select_title);
                }
              }
            }

            if (cards.length == 1 && is_sure) getPage(cards[0].link);else if (items.length) {
              _this.wait_similars = true;
              items.forEach(function (c) {
                c.is_similars = true;
              });
              component.similars(items);
              component.loading(false);
            } else component.emptyForQuery(select_title);
          } else if (str.indexOf('/recaptcha/api.js') !== -1 || str.indexOf('form action="/check?') !== -1) {
            if (prox) {
              component.empty(Lampa.Lang.translate('online_mod_captcha_proxy'));
            } else {
              component.empty(Lampa.Lang.translate('online_mod_captcha_address') + embed);
            }
          } else component.emptyForQuery(select_title);
        }, function (a, c) {
          component.empty(network.errorDecode(a, c));
        }, false, {
          dataType: 'text',
          withCredentials: logged_in,
          headers: headers
        });
      };

      this.extendChoice = function (saved) {
        Lampa.Arrays.extend(choice, saved, true);
      };
      /**
       * Сброс фильтра
       */


      this.reset = function () {
        component.reset();
        choice = {
          season: 0,
          voice: 0
        };
        filter();
        append(filtred());
        component.saveChoice(choice);
      };
      /**
       * Применить фильтр
       * @param {*} type
       * @param {*} a
       * @param {*} b
       */


      this.filter = function (type, a, b) {
        choice[a.stype] = b.index;
        component.reset();
        filter();
        append(filtred());
        component.saveChoice(choice);
      };
      /**
       * Уничтожить
       */


      this.destroy = function () {
        network.clear();
        extract = null;
      };

      function filter() {
        filter_items = {
          season: [],
          voice: []
        };

        if (is_playlist) {
          extract.forEach(function (item) {
            if (item.playlist || item.folder) {
              filter_items.season.push(item.title || item.comment || '');
            }
          });
        }

        if (!filter_items.season[choice.season]) choice.season = 0;

        if (is_playlist) {
          extract.forEach(function (item, i) {
            var playlist = item.playlist || item.folder;

            if (playlist) {
              if (i == choice.season) {
                playlist.forEach(function (eps) {
                  if (eps.file) {
                    component.parsePlaylist(eps.file).forEach(function (el) {
                      if (el.voice && filter_items.voice.indexOf(el.voice) == -1) {
                        filter_items.voice.push(el.voice);
                      }
                    });
                  }
                });
              }
            } else if (item.file) {
              component.parsePlaylist(item.file).forEach(function (el) {
                if (el.voice && filter_items.voice.indexOf(el.voice) == -1) {
                  filter_items.voice.push(el.voice);
                }
              });
            }
          });
        }

        if (!filter_items.voice[choice.voice]) choice.voice = 0;
        component.filter(filter_items, choice);
      }

      function filtred() {
        var filtred = [];

        if (is_playlist) {
          var playlist = extract;
          var season = object.movie.number_of_seasons && 1;

          if (extract[choice.season] && (extract[choice.season].playlist || extract[choice.season].folder)) {
            playlist = extract[choice.season].playlist || extract[choice.season].folder;
            season = parseInt(extract[choice.season].title || extract[choice.season].comment || '');
            if (isNaN(season)) season = 1;
          }

          playlist.forEach(function (eps, index) {
            var items = extractItems(eps.file, filter_items.voice[choice.voice]);

            if (items.length) {
              var title = eps.title || eps.comment || '';
              var alt_voice = title.match(/\d+ серия (.*)$/i);
              var info = items[0].voice || alt_voice && alt_voice[1].trim() || translation;
              if (info == title) info = '';

              if (season) {
                var episode = parseInt(title);
                if (isNaN(episode)) episode = index + 1;
                filtred.push({
                  title: component.formatEpisodeTitle(season, null, title),
                  quality: items[0].quality + 'p' + (quality_type ? ' - ' + quality_type : ''),
                  info: info ? ' / ' + info : '',
                  season: season,
                  episode: episode,
                  file: eps.file,
                  voice: items[0].voice,
                  subtitles: parseSubs(eps.subtitle)
                });
              } else {
                filtred.push({
                  title: title || select_title,
                  quality: items[0].quality + 'p' + (quality_type ? ' - ' + quality_type : ''),
                  info: info ? ' / ' + info : '',
                  file: eps.file,
                  voice: items[0].voice,
                  subtitles: parseSubs(eps.subtitle)
                });
              }
            }
          });
        } else {
          filtred = extract;
        }

        return filtred;
      }

      function parseSubs(str) {
        if (!str) return false;
        var subtitles = component.parsePlaylist(str).map(function (item) {
          var link = item.links[0] || '';
          return {
            label: item.label,
            url: component.processSubs(component.proxyLink(link, prox, prox_enc_stream))
          };
        });
        return subtitles.length ? subtitles : false;
      }
      /**
       * Получить данные о фильме
       * @param {String} str
       */


      function extractData(vod, page) {
        var quality_match = page.match(/<li><b>Качество:<\/b>([^<,]+)<\/li>/i);
        var translation_match = page.match(/<li><b>Перевод:<\/b>([^<,]+)<\/li>/i);
        quality_type = quality_match ? quality_match[1].trim() : '';
        translation = translation_match ? translation_match[1].trim() : '';
        var pl = vod && vod.file && Lampa.Arrays.decodeJson(vod.file, []) || [];

        if (pl.length) {
          extract = pl;
          is_playlist = true;
        } else if (vod && vod.file) {
          var file = vod.file;
          var found = [];
          var subtiles = parseSubs(vod.subtitle);

          if (file) {
            var voices = {};
            component.parsePlaylist(file).forEach(function (item) {
              var prev = voices[item.voice || ''];
              var quality_str = item.label.match(/(\d\d\d+)/);
              var quality = quality_str ? parseInt(quality_str[1]) : NaN;

              if (!prev || quality > prev.quality) {
                voices[item.voice || ''] = {
                  quality: quality
                };
              }
            });

            for (var voice in voices) {
              var el = voices[voice];
              found.push({
                title: voice || translation || select_title,
                quality: el.quality + 'p' + (quality_type ? ' - ' + quality_type : ''),
                info: '',
                file: file,
                voice: voice,
                subtitles: subtiles
              });
            }
          }

          extract = found;
          is_playlist = false;
        } else component.emptyForQuery(select_title);
      }

      function getUrlWithParams(url, params) {
        url = url || '';
        url = component.fixLink(url, ref);

        if (params) {
          for (var name in params) {
            var value = params[name];
            url = Lampa.Utils.addUrlComponent(url, encodeURIComponent(name) + '=' + encodeURIComponent(value));
          }
        }

        return url;
      }

      function searchMovieUrl(str) {
        var regex = /<script src="([^"]*\/movie\.js\b[^"]*)"/g;
        var found;

        while ((found = regex.exec(str)) !== null) {
          var start = str.lastIndexOf('<!--', found.index);
          var end = str.lastIndexOf('-->', found.index);
          if (end >= start) return found[1];
        }

        return '';
      }

      function getPage(url) {
        url = component.fixLink(url, ref);
        var cookie = (check_cookie ? check_cookie + '; ' : '') + 'player_type=new; file_type=' + file_type;
        var headers = Lampa.Platform.is('android') ? {
          'Origin': host,
          'Referer': url,
          'User-Agent': user_agent,
          'Cookie': cookie
        } : {};
        var prox_enc_page = '';

        if (prox) {
          prox_enc_page += 'param/Origin=' + encodeURIComponent(host) + '/';
          prox_enc_page += 'param/Referer=' + encodeURIComponent(url) + '/';
          prox_enc_stream = prox_enc_page;
          prox_enc_page += 'param/User-Agent=' + encodeURIComponent(user_agent) + '/';
          prox_enc_page += 'param/Cookie=' + encodeURIComponent(cookie) + '/';
        }

        network.clear();
        network.timeout(1000 * 10);
        network["native"](component.proxyLink(url, prox, prox_enc_page), function (str) {
          str = (str || '').replace(/\n/g, '');
          var MOVIE_ID = str.match(/var MOVIE_ID = (\d+);/);
          var PLAYER_CUID = str.match(/var PLAYER_CUID = "([^"]+)";/);
          var IDENTIFIER = str.match(/var IDENTIFIER = "([^"]+)";/);
          var IMAGES_URL_SCRIPT = str.match(/<script[^>]*>([^<]*var IMAGES_URL = [^<]*)<\/script>/);
          var MOVIE_ID_SCRIPT = str.match(/<script[^>]*>([^<]*var MOVIE_ID = [^<]*)<\/script>/);
          var MOVIE_URL = searchMovieUrl(str);

          if (MOVIE_ID && PLAYER_CUID && IDENTIFIER && MOVIE_ID_SCRIPT && MOVIE_URL) {
            var SCRIPTS = IMAGES_URL_SCRIPT ? IMAGES_URL_SCRIPT.index > MOVIE_ID_SCRIPT.index ? [MOVIE_ID_SCRIPT[1], IMAGES_URL_SCRIPT[1]] : [IMAGES_URL_SCRIPT[1], MOVIE_ID_SCRIPT[1]] : [MOVIE_ID_SCRIPT[1], ''];
            if (SCRIPTS[1] === SCRIPTS[0]) SCRIPTS[1] = '';
            var movie_url = component.fixLink(MOVIE_URL, ref);
            network.clear();
            network.timeout(1000 * 10);
            network["native"](component.proxyLink(movie_url, prox, prox_enc_page), function (script) {
              var params = {};

              try {
                params = (0, eval)(decrypt + [JSON.stringify(component.decodeHtml(SCRIPTS[0])), JSON.stringify(component.decodeHtml(SCRIPTS[1])), JSON.stringify(script || ''), JSON.stringify('new'), JSON.stringify(file_type)].join(',') + ');');
              } catch (e) {}

              var user_url = params.user && params.user.url;

              if (!user_url) {
                component.empty('No user_url');
                return;
              }

              var user_params = params.user && params.user.params || {};
              user_params['_'] = Date.now();
              user_url = getUrlWithParams(user_url || '/user_data', user_params);
              network.clear();
              network.timeout(1000 * 10);
              network["native"](component.proxyLink(user_url, prox, prox_enc_page), function (data) {
                if (data && !data.error) {
                  var _params = {};

                  try {
                    _params = (0, eval)(decrypt + [JSON.stringify(component.decodeHtml(SCRIPTS[0])), JSON.stringify(component.decodeHtml(SCRIPTS[1])), JSON.stringify(script), JSON.stringify('new'), JSON.stringify(file_type), JSON.stringify(data)].join(',') + ');');
                  } catch (e) {}

                  if (data.allow_watch != null && !data.allow_watch) {
                    Lampa.Noty.show(Lampa.Lang.translate('online_mod_blockedlink') + (data.client_country ? ': ' + data.client_country : ''));
                    component.emptyForQuery(select_title);
                    return;
                  } else if (!_params.vod) {
                    Lampa.Noty.show(Lampa.Lang.translate('online_mod_nolink'));
                    component.emptyForQuery(select_title);
                    return;
                  }

                  var vod_url = _params.vod.url || '';

                  if (!vod_url) {
                    component.empty('No vod_url');
                    return;
                  }

                  var vod_params = _params.vod && _params.vod.params || {};
                  vod_params['_'] = Date.now();
                  vod_url = getUrlWithParams(vod_url || '/vod/' + MOVIE_ID[1], vod_params);
                  network.clear();
                  network.timeout(1000 * 10);
                  network["native"](component.proxyLink(vod_url, prox, prox_enc_page), function (files) {
                    component.loading(false);
                    var params = {};

                    try {
                      params = (0, eval)(decrypt + [JSON.stringify(component.decodeHtml(SCRIPTS[0])), JSON.stringify(component.decodeHtml(SCRIPTS[1])), JSON.stringify(script), JSON.stringify('new'), JSON.stringify(file_type), JSON.stringify(data), JSON.stringify(files)].join(',') + ');');
                    } catch (e) {}

                    extractData(params.player, str);
                    filter();
                    append(filtred());
                  }, function (a, c) {
                    component.empty(network.errorDecode(a, c));
                  }, false, {
                    dataType: 'text',
                    withCredentials: logged_in,
                    headers: headers
                  });
                } else if (data && data.error) {
                  if (prox) {
                    component.empty(Lampa.Lang.translate('online_mod_captcha_proxy'));
                  } else {
                    component.empty(Lampa.Lang.translate('online_mod_captcha_address') + embed);
                  }
                } else component.emptyForQuery(select_title);
              }, function (a, c) {
                component.empty(network.errorDecode(a, c));
              }, false, {
                dataType: 'text',
                withCredentials: logged_in,
                headers: headers
              });
            }, function (a, c) {
              component.empty(network.errorDecode(a, c));
            }, false, {
              dataType: 'text',
              withCredentials: logged_in,
              headers: headers
            });
          } else component.emptyForQuery(select_title);
        }, function (a, c) {
          component.empty(network.errorDecode(a, c));
        }, false, {
          dataType: 'text',
          withCredentials: logged_in,
          headers: headers
        });
      }
      /**
       * Получить потоки
       * @param {String} str
       * @param {String} voice
       * @returns array
       */


      function extractItems(str, voice) {
        if (!str) return [];

        try {
          var list = component.parsePlaylist(str);

          if (voice) {
            var tmp = list.filter(function (el) {
              return el.voice == voice;
            });

            if (tmp.length) {
              list = tmp;
            } else {
              list = list.filter(function (el) {
                return typeof el.voice === 'undefined';
              });
            }
          }

          var items = list.map(function (item) {
            var quality = item.label.match(/(\d\d\d+)/);
            var file = item.links[0] || '';
            return {
              label: item.label,
              voice: item.voice,
              quality: quality ? parseInt(quality[1]) : NaN,
              file: component.proxyLink(file, prox, prox_enc_stream)
            };
          });
          items.sort(function (a, b) {
            if (b.quality > a.quality) return 1;
            if (b.quality < a.quality) return -1;
            if (b.label > a.label) return 1;
            if (b.label < a.label) return -1;
            return 0;
          });
          return items;
        } catch (e) {}

        return [];
      }

      function getStream(element) {
        var file = '',
            quality = false;
        var items = extractItems(element.file, element.voice);

        if (items && items.length) {
          file = items[0].file;
          quality = {};
          items.forEach(function (item) {
            quality[item.label] = item.file;
          });
        }

        element.stream = file;
        element.qualitys = quality;
        return {
          file: file,
          quality: quality
        };
      }
      /**
       * Показать файлы
       */


      function append(items) {
        component.reset();
        var viewed = Lampa.Storage.cache('online_view', 5000, []);
        var last_episode = component.getLastEpisode(items);
        items.forEach(function (element) {
          if (element.season) {
            element.translate_episode_end = last_episode;
            element.translate_voice = filter_items.voice[choice.voice];
          }

          var hash = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title].join('') : object.movie.original_title);
          var view = component.watchView(element, hash, items);
          var item = Lampa.Template.get('online_mod', element);
          var hash_file = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title, element.title, 'kinobase'].join('') : object.movie.original_title + element.quality + 'kinobase');
          element.timeline = view;
          item.append(Lampa.Timeline.render(view));

          if (Lampa.Timeline.details) {
            item.find('.online__quality').append(Lampa.Timeline.details(view, ' / '));
          }

          if (viewed.indexOf(hash_file) !== -1) item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
          item.on('hover:enter', function () {
            if (object.movie.id) Lampa.Favorite.add('history', object.movie, 100);
            getStream(element);

            if (element.stream) {
              var playlist = [];
              var first = {
                url: component.getDefaultQuality(element.qualitys, element.stream),
                quality: component.renameQualityMap(element.qualitys),
                subtitles: element.subtitles,
                timeline: element.timeline,
                title: element.season ? element.title : select_title + (element.title == select_title ? '' : ' / ' + element.title)
              };

              if (element.season) {
                items.forEach(function (elem) {
                  getStream(elem);
                  playlist.push({
                    url: component.getDefaultQuality(elem.qualitys, elem.stream),
                    quality: component.renameQualityMap(elem.qualitys),
                    subtitles: elem.subtitles,
                    timeline: elem.timeline,
                    title: elem.title
                  });
                });
              } else {
                playlist.push(first);
              }

              if (playlist.length > 1) first.playlist = playlist;
              playWithoutPreroll(first, playlist);

              if (viewed.indexOf(hash_file) == -1) {
                viewed.push(hash_file);
                item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
                Lampa.Storage.set('online_view', viewed);
              }
            } else Lampa.Noty.show(Lampa.Lang.translate('online_mod_nolink'));
          });
          component.append(item);
          component.contextmenu({
            item: item,
            view: view,
            viewed: viewed,
            hash_file: hash_file,
            element: element,
            file: function file(call) {
              call(getStream(element));
            }
          });
        });
        component.start(true);
      }
    }

    kinobase.initSettings = function (show_all) {
      var balanser_name = 'Kinobase';
      var component_name = 'online_mod_kinobase';
      if (Lampa.SettingsApi.getComponent(component_name)) return;

      {
        var icon = "<svg><use xlink:href=\"#sprite-settings\"></use></svg>";
        Lampa.SettingsApi.addComponent({
          component: component_name,
          icon: icon,
          name: balanser_name
        });
        Lampa.SettingsApi.addParam({
          component: 'online_mod',
          param: {
            name: component_name + '_settings',
            type: 'button'
          },
          field: {
            name: "<div class=\"settings-folder\" style=\"padding:0!important\"><div style=\"width:1.8em;height:1.3em;padding-right:.5em\">".concat(icon, "</div><div style=\"font-size:1.3em\">").concat(balanser_name, "</div></div>")
          },
          onChange: function onChange() {
            Lampa.Settings.create(component_name, {
              onBack: function onBack() {
                Lampa.Settings.create('online_mod');
              }
            });
          }
        });
      }

      {
        Lampa.SettingsApi.addParam({
          component: component_name,
          param: {
            name: 'online_mod_proxy_kinobase',
            type: 'trigger',
            "default": false
          },
          field: {
            name: Lampa.Lang.translate('online_mod_proxy_balanser') + ' ' + balanser_name
          }
        });
        Lampa.SettingsApi.addParam({
          component: component_name,
          param: {
            name: 'online_mod_kinobase_mirror',
            placeholder: Lampa.Lang.translate('settings_cub_not_specified'),
            type: 'input',
            values: '',
            "default": ''
          },
          field: {
            name: Lampa.Lang.translate('online_mod_kinobase_mirror')
          }
        });
        Lampa.SettingsApi.addParam({
          component: component_name,
          param: {
            name: 'online_mod_kinobase_cookie',
            placeholder: Lampa.Lang.translate('settings_cub_not_specified'),
            type: 'input',
            values: '',
            "default": ''
          },
          field: {
            name: Lampa.Lang.translate('online_mod_kinobase_cookie')
          }
        });
      }
    };

    kinobase.hideSettings = function (body) {
      $('[data-component="online_mod_kinobase"]', body).hide();
    };

    function collaps(component, _object, config) {
      var network = new Lampa.Reguest();
      var extract = {};
      var object = _object;
      var select_title = '';
      var prefer_http = Lampa.Storage.field('online_mod_prefer_http') === true;
      var prefer_dash = !!(config && config.prefer_dash);
      var lampa_player = Lampa.Storage.field('online_mod_collaps_lampa_player') === true;
      var prox = component.proxy('collaps');
      var base = 'api.nextembed.ws';
      var host = 'https://' + base;
      var ref = host + '/';
      var user_agent = Utils.baseUserAgent();
      var embed = (prefer_http ? 'http:' : 'https:') + '//' + base + '/embed/';
      var embed2 = (prefer_http ? 'http:' : 'https:') + '//api.kinogram.best/embed/';
      var prox_enc = '';

      if (prox) {
        prox_enc += 'param/User-Agent=' + encodeURIComponent(user_agent) + '/';
      }

      var prox_enc_stream = prox_enc;

      if (prox) {
        prox_enc += 'ip/';
        prox_enc_stream += 'param/Origin=' + encodeURIComponent(host) + '/';
        prox_enc_stream += 'param/Referer=' + encodeURIComponent(ref) + '/';
      }

      var net_method = lampa_player ? 'silent' : 'native';
      var play_headers = !prox && !lampa_player && Lampa.Platform.is('android') ? {
        'User-Agent': user_agent,
        'Origin': host,
        'Referer': ref
      } : {};
      var filter_items = {};
      var choice = {
        season: 0,
        voice: 0
      };

      function collaps_api_search(api, callback, error) {
        network.clear();
        network.timeout(10000);
        network[net_method](component.proxyLink(embed + api, prox, prox_enc, 'enc2t'), function (str) {
          if (callback) callback(str || '');
        }, function (a, c) {
          if (a.status == 404 && (!a.responseText || a.responseText.indexOf('видео недоступно') !== -1)) {
            if (callback) callback('');
          } else {
            network.clear();
            network.timeout(10000);
            network[net_method](component.proxyLink(embed2 + api, prox, prox_enc, 'enc2t'), function (str) {
              if (callback) callback(str || '');
            }, function (a, c) {
              if (a.status == 404 && (!a.responseText || a.responseText.indexOf('видео недоступно') !== -1) || a.status == 0 && a.statusText !== 'timeout') {
                if (callback) callback('');
              } else if (error) error(network.errorDecode(a, c));
            }, false, {
              dataType: 'text',
              headers: play_headers
            });
          }
        }, false, {
          dataType: 'text',
          headers: play_headers
        });
      }
      /**
       * Поиск
       * @param {Object} _object
       */


      this.search = function (_object, kinopoisk_id) {
        object = _object;
        select_title = object.search || object.movie.title;
        var error = component.empty.bind(component);
        var api = (+kinopoisk_id ? 'kp/' : 'imdb/') + kinopoisk_id;
        collaps_api_search(api, function (str) {
          if (str) parse(str);else if (!object.clarification && object.movie.imdb_id && kinopoisk_id != object.movie.imdb_id) {
            collaps_api_search('imdb/' + object.movie.imdb_id, function (str) {
              if (str) parse(str);else component.emptyForQuery(select_title);
            }, error);
          } else component.emptyForQuery(select_title);
        }, error);
      };

      this.extendChoice = function (saved) {
        Lampa.Arrays.extend(choice, saved, true);
      };
      /**
       * Сброс фильтра
       */


      this.reset = function () {
        component.reset();
        choice = {
          season: 0,
          voice: 0
        };
        filter();
        append(filtred());
        component.saveChoice(choice);
      };
      /**
       * Применить фильтр
       * @param {*} type
       * @param {*} a
       * @param {*} b
       */


      this.filter = function (type, a, b) {
        choice[a.stype] = b.index;
        component.reset();
        filter();
        append(filtred());
        component.saveChoice(choice);
      };
      /**
       * Уничтожить
       */


      this.destroy = function () {
        network.clear();
        extract = null;
      };

      function parse(str) {
        component.loading(false);
        str = (str || '').replace(/\n/g, '');
        var find = str.match(/makePlayer\(({.*?})\);/);
        var json;

        try {
          json = find && (0, eval)('"use strict"; (' + find[1] + ');');
        } catch (e) {}

        if (json) {
          extract = json;

          if (extract.playlist && extract.playlist.seasons) {
            extract.playlist.seasons.sort(function (a, b) {
              return a.season - b.season;
            });
          }

          filter();
          append(filtred());
        } else component.emptyForQuery(select_title);
      }
      /**
       * Построить фильтр
       */


      function filter() {
        filter_items = {
          season: [],
          voice: []
        };

        if (extract.playlist && extract.playlist.seasons) {
          extract.playlist.seasons.forEach(function (season) {
            filter_items.season.push(Lampa.Lang.translate('torrent_serial_season') + ' ' + season.season);
          });
        }

        if (!filter_items.season[choice.season]) choice.season = 0;
        component.filter(filter_items, choice);
      }

      function fixUrl(url, add) {
        url = url || '';

        if (url && add) {
          url += atob('JnZw');
        }

        url = component.fixLinkProtocol(url, prefer_http, true);
        return url;
      }
      /**
       * Отфильтровать файлы
       * @returns array
       */


      function filtred() {
        var filtred = [];

        if (extract.playlist) {
          extract.playlist.seasons.forEach(function (season, i) {
            if (i == choice.season) {
              season.episodes.forEach(function (episode) {
                var audio_tracks = episode.audio.names.map(function (name) {
                  return {
                    language: name
                  };
                });
                var audio_infos = episode.audio.names.map(function (name, index) {
                  var order = episode.audio.order && episode.audio.order[index];
                  return {
                    name: name,
                    order: order != null ? order : 1000
                  };
                });
                audio_infos.sort(function (a, b) {
                  return a.order - b.order;
                });
                var audio_names = audio_infos.map(function (a) {
                  return a.name;
                }).filter(function (name) {
                  return name && name !== 'delete';
                });
                var file = fixUrl(prefer_dash && (episode.dasha || episode.dash) || episode.hls || '', true);
                filtred.push({
                  title: episode.title,
                  quality: '360p ~ ' + (prefer_dash ? '1080p' : '720p'),
                  info: audio_names.length ? ' / ' + component.uniqueNamesShortText(audio_names, 80) : '',
                  season: season.season,
                  episode: parseInt(episode.episode),
                  file: component.proxyLink(file, prox, prox_enc_stream),
                  subtitles: episode.cc ? episode.cc.map(function (c) {
                    var url = fixUrl(c.url || '');
                    return {
                      label: c.name,
                      url: component.processSubs(component.proxyLink(url, prox, prox_enc_stream))
                    };
                  }) : false,
                  audio_tracks: audio_tracks.length ? audio_tracks : false
                });
              });
            }
          });
        } else if (extract.source) {
          var max_quality = 0;
          extract.qualityByWidth && Lampa.Arrays.getKeys(extract.qualityByWidth).forEach(function (resolution) {
            var quality = extract.qualityByWidth[resolution] || 0;
            if (!prefer_dash && quality > 720) quality = 0;
            if (quality > max_quality) max_quality = quality;
          });
          var audio_tracks = extract.source.audio.names.map(function (name) {
            return {
              language: name
            };
          });
          var audio_infos = extract.source.audio.names.map(function (name, index) {
            var order = extract.source.audio.order && extract.source.audio.order[index];
            return {
              name: name,
              order: order != null ? order : 1000
            };
          });
          audio_infos.sort(function (a, b) {
            return a.order - b.order;
          });
          var audio_names = audio_infos.map(function (a) {
            return a.name;
          }).filter(function (name) {
            return name && name !== 'delete';
          });
          var file = fixUrl(prefer_dash && (extract.source.dasha || extract.source.dash) || extract.source.hls || '', true);
          filtred.push({
            title: extract.title || select_title,
            quality: max_quality ? max_quality + 'p' : '360p ~ ' + (prefer_dash ? '1080p' : '720p'),
            info: audio_names.length ? ' / ' + component.uniqueNamesShortText(audio_names, 80) : '',
            file: component.proxyLink(file, prox, prox_enc_stream),
            subtitles: extract.source.cc ? extract.source.cc.map(function (c) {
              var url = fixUrl(c.url || '');
              return {
                label: c.name,
                url: component.processSubs(component.proxyLink(url, prox, prox_enc_stream))
              };
            }) : false,
            audio_tracks: audio_tracks.length ? audio_tracks : false
          });
        }

        return filtred;
      }
      /**
       * Показать файлы
       */


      function append(items) {
        component.reset();
        var viewed = Lampa.Storage.cache('online_view', 5000, []);
        items.forEach(function (element) {
          var hash = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title].join('') : object.movie.original_title);
          var view = component.watchView(element, hash, items);
          var item = Lampa.Template.get('online_mod', element);
          var hash_file = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title, element.title].join('') : object.movie.original_title + 'collaps');
          element.timeline = view;
          item.append(Lampa.Timeline.render(view));

          if (Lampa.Timeline.details) {
            item.find('.online__quality').append(Lampa.Timeline.details(view, ' / '));
          }

          if (viewed.indexOf(hash_file) !== -1) item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
          item.on('hover:enter', function (event, options) {
            if (object.movie.id) Lampa.Favorite.add('history', object.movie, 100);

            if (element.file) {
              var playlist = [];
              var first = {
                anime_skip: skipOf(element),
                url: component.getDefaultQuality(null, element.file),
                subtitles: element.subtitles,
                translate: {
                  tracks: element.audio_tracks
                },
                timeline: element.timeline,
                title: element.season ? element.title : select_title + (element.title == select_title ? '' : ' / ' + element.title),
                headers: play_headers
              };

              if (element.season) {
                items.forEach(function (elem) {
                  playlist.push({
                    anime_skip: skipOf(elem),
                    url: component.getDefaultQuality(null, elem.file),
                    subtitles: elem.subtitles,
                    translate: {
                      tracks: elem.audio_tracks
                    },
                    timeline: elem.timeline,
                    title: elem.title,
                    headers: play_headers
                  });
                });
              } else {
                playlist.push(first);
              }

              if (playlist.length > 1) first.playlist = playlist;
              if (options && options.runas) Lampa.Player.runas(options.runas);else if (lampa_player) Lampa.Player.runas('lampa');
              playWithoutPreroll(first, playlist);

              if (viewed.indexOf(hash_file) == -1) {
                viewed.push(hash_file);
                item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
                Lampa.Storage.set('online_view', viewed);
              }
            } else Lampa.Noty.show(Lampa.Lang.translate('online_mod_nolink'));
          });
          component.append(item);
          component.contextmenu({
            item: item,
            view: view,
            element: element,
            viewed: viewed,
            hash_file: hash_file,
            file: function file(call) {
              call({
                file: element.file
              });
            }
          });
        });
        component.start(true);
      }
    }

    collaps.initSettings = function (show_all) {
      var balanser_name = 'Collaps';
      var component_name = 'online_mod_collaps';
      if (Lampa.SettingsApi.getComponent(component_name)) return;

      {
        var icon = "<svg><use xlink:href=\"#sprite-settings\"></use></svg>";
        Lampa.SettingsApi.addComponent({
          component: component_name,
          icon: icon,
          name: balanser_name
        });
        Lampa.SettingsApi.addParam({
          component: 'online_mod',
          param: {
            name: component_name + '_settings',
            type: 'button'
          },
          field: {
            name: "<div class=\"settings-folder\" style=\"padding:0!important\"><div style=\"width:1.8em;height:1.3em;padding-right:.5em\">".concat(icon, "</div><div style=\"font-size:1.3em\">").concat(balanser_name, "</div></div>")
          },
          onChange: function onChange() {
            Lampa.Settings.create(component_name, {
              onBack: function onBack() {
                Lampa.Settings.create('online_mod');
              }
            });
          }
        });
      }

      if (show_all) {
        Lampa.SettingsApi.addParam({
          component: component_name,
          param: {
            name: 'online_mod_proxy_collaps',
            type: 'trigger',
            "default": false
          },
          field: {
            name: Lampa.Lang.translate('online_mod_proxy_balanser') + ' ' + balanser_name
          }
        });
      }

      {
        Lampa.SettingsApi.addParam({
          component: component_name,
          param: {
            name: 'online_mod_collaps_lampa_player',
            type: 'trigger',
            "default": false
          },
          field: {
            name: Lampa.Lang.translate('online_mod_collaps_lampa_player')
          }
        });
      }
    };

    collaps.hideSettings = function (body) {
      $('[data-component="online_mod_collaps"]', body).hide();
    };

    function cdnmovies(component, _object, config) {
      var network = new Lampa.Reguest();
      var extract = [];
      var object = _object;
      var select_title = '';
      var prefer_http = Lampa.Storage.field('online_mod_prefer_http') === true;
      var prefer_mp4 = Lampa.Storage.field('online_mod_prefer_mp4') === true;
      var prox = component.proxy('cdnmovies');
      var host = Utils.decodeSecret([36, 63, 17, 6, 17, 0, 104, 90, 4, 49, 40, 46, 10, 30, 6, 20, 40, 27, 30, 49, 34, 46]);
      var ref = host + '/';
      var user_agent = 'Mozilla/5.0 (Linux; Android 10; K; client) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.6167.178 Mobile Safari/537.36';
      var headers = Lampa.Platform.is('android') ? {
        'Origin': host,
        'Referer': ref,
        'User-Agent': user_agent
      } : {};
      var prox_enc = '';

      if (prox) {
        prox_enc += 'param/Origin=' + encodeURIComponent(host) + '/';
        prox_enc += 'param/Referer=' + encodeURIComponent(ref) + '/';
        prox_enc += 'param/User-Agent=' + encodeURIComponent(user_agent) + '/';
      }

      var embed_host = 'https://cdnmovies-stream.online';
      var embed = embed_host + '/';
      var prox_enc2 = '';

      if (prox) {
        prox_enc2 += 'param/Origin=' + encodeURIComponent(embed_host) + '/';
        prox_enc2 += 'param/Referer=' + encodeURIComponent(embed) + '/';
        prox_enc2 += 'param/User-Agent=' + encodeURIComponent(user_agent) + '/';
      }

      var filter_items = {};
      var choice = {
        season: 0,
        voice: 0,
        voice_name: ''
      };

      function cdn_api_search(api, callback, error) {
        var call_success = function call_success(str) {
          if (callback) callback(str || '');
        };

        var call_error = function call_error(a, c) {
          if ((a.status == 404 || a.status == 403) && (!a.responseText || a.responseText.indexOf('<title>Not Found</title>') !== -1 || a.responseText.indexOf('Не найдено!') !== -1 || a.responseText.indexOf('Контент не найден или недоступен в вашем регионе!') !== -1) || a.status == 0 && a.statusText !== 'timeout') {
            if (callback) callback('');
          } else if (error) error(network.errorDecode(a, c));
        };

        {
          var meta = $('head meta[name="referrer"]');
          var referrer = meta.attr('content') || 'never';
          meta.attr('content', 'origin');

          try {
            network.clear();
            network.timeout(10000);
            network["native"](component.proxyLink(embed + api, prox, prox_enc), call_success, call_error, false, {
              dataType: 'text',
              headers: headers
            });
          } finally {
            meta.attr('content', referrer);
          }
        }
      }
      /**
       * Начать поиск
       * @param {Object} _object
       * @param {String} kinopoisk_id
       */


      this.search = function (_object, kinopoisk_id) {
        object = _object;
        select_title = object.search || object.movie.title;

        var empty = function empty() {
          component.emptyForQuery(select_title);
        };

        var error = component.empty.bind(component);
        var api = (+kinopoisk_id ? 'kinopoisk/' : 'imdb/') + kinopoisk_id + '/iframe';
        cdn_api_search(api, function (str) {
          parse(str || '', function () {
            if (!object.clarification && object.movie.imdb_id && kinopoisk_id != object.movie.imdb_id) {
              cdn_api_search('imdb/' + object.movie.imdb_id + '/iframe', function (str) {
                parse(str || '', empty);
              }, error);
            } else empty();
          });
        }, error);
      };

      this.extendChoice = function (saved) {
        Lampa.Arrays.extend(choice, saved, true);
      };
      /**
       * Сброс фильтра
       */


      this.reset = function () {
        component.reset();
        choice = {
          season: 0,
          voice: 0,
          voice_name: ''
        };
        filter();
        append(filtred());
        component.saveChoice(choice);
      };
      /**
       * Применить фильтр
       * @param {*} type
       * @param {*} a
       * @param {*} b
       */


      this.filter = function (type, a, b) {
        choice[a.stype] = b.index;
        if (a.stype == 'voice') choice.voice_name = filter_items.voice[b.index];
        component.reset();
        filter();
        append(filtred());
        component.saveChoice(choice);
      };
      /**
       * Уничтожить
       */


      this.destroy = function () {
        network.clear();
        extract = null;
      };

      function parse(str, empty) {
        str = (str || '').replace(/\n/g, '');
        var find = str.match(/Playerjs\(({.*?})\);/);
        var json;

        try {
          json = find && (0, eval)('"use strict"; (function(){ return ' + find[1] + '; })();');
        } catch (e) {}

        var video;
        var player = json && json.file && decode(json.file);

        try {
          video = player && JSON.parse(player);
        } catch (e) {}

        if (video && video.length && video.forEach) {
          component.loading(false);
          extract = video;
          filter();
          append(filtred());
        } else empty();
      }

      function decode(data) {
        if (!startsWith(data, '#')) return data;

        var enc = function enc(str) {
          return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (match, p1) {
            return String.fromCharCode('0x' + p1);
          }));
        };

        var dec = function dec(str) {
          return decodeURIComponent(atob(str).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          }).join(''));
        };

        var trashList = ['wNp2wBTNcPRQvTC0_CpxCsq_8T1u9Q', 'md-Od2G9RWOgSa5HoBSSbWrCyIqQyY', 'kzuOYQqB_QSOL-xzN_Kz3kkgkHhHit', '6-xQWMh7ertLp8t_M9huUDk1M0VrYJ', 'RyTwtf15_GLEsXxnpU4Ljjd0ReY-VH'];
        var x = data.substring(2);
        trashList.forEach(function (trash) {
          x = x.replace('//' + enc(trash), '');
        });

        try {
          x = dec(x);
        } catch (e) {
          x = '';
        }

        return x;
      }
      /**
       * Получить потоки
       * @param {String} str
       * @returns array
       */


      function extractItemsPlaylist(str, url) {
        if (!str) return [];

        try {
          var items = component.parsePlaylist(str).map(function (item) {
            var quality = item.label.match(/(\d\d\d+)/);
            var link = item.links[0] || '';
            link = link.replace('/sundb.coldcdn.xyz/', '/sundb.nl/');
            link = component.fixLinkProtocol(link, prefer_http, true);
            if (prefer_mp4) link = link.replace(/(\.mp4):hls:manifest\.m3u8$/i, '$1');
            return {
              label: item.label,
              quality: quality ? parseInt(quality[1]) : NaN,
              file: component.proxyLink(link, prox, prox_enc2)
            };
          });
          items.sort(function (a, b) {
            if (b.quality > a.quality) return 1;
            if (b.quality < a.quality) return -1;
            if (b.label > a.label) return 1;
            if (b.label < a.label) return -1;
            return 0;
          });
          return items;
        } catch (e) {}

        return [];
      }
      /**
       * Получить поток
       * @param {*} element
       */


      function parseStream(element, call, error, itemsExtractor, str, url) {
        var file = '';
        var quality = false;
        var items = itemsExtractor(str, url);

        if (items && items.length) {
          file = items[0].file;
          quality = {};
          items.forEach(function (item) {
            quality[item.label] = item.file;
          });
        }

        if (file) {
          element.stream = file;
          element.qualitys = quality;
          call(element);
        } else error();
      }
      /**
       * Получить поток
       * @param {*} element
       */


      function getStream(element, call, error) {
        if (element.stream) return call(element);
        var url = element.file || '';

        if (startsWith(url, '[')) {
          parseStream(element, call, error, extractItemsPlaylist, url, '');
          return;
        }

        url = url.replace('/sundb.coldcdn.xyz/', '/sundb.nl/');
        url = component.fixLinkProtocol(url, prefer_http, true);
        if (prefer_mp4) url = url.replace(/(\.mp4):hls:manifest\.m3u8$/i, '$1');

        if (url) {
          element.stream = component.proxyLink(url, prox, prox_enc2);
          element.qualitys = false;
          call(element);
        } else error();
      }
      /**
       * Построить фильтр
       */


      function filter() {
        filter_items = {
          season: [],
          voice: []
        };
        var season_objs = [];
        extract.forEach(function (s) {
          if (s.folder) {
            s.title = s.title || s.comment || '';
            s.season_num = parseInt(s.title.match(/\d+/));
            season_objs.push(s);
          }
        });
        season_objs.sort(function (a, b) {
          var cmp = a.season_num - b.season_num;
          if (cmp) return cmp;
          if (a.title > b.title) return 1;
          if (a.title < b.title) return -1;
          return 0;
        });
        filter_items.season = season_objs.map(function (s) {
          return s.title;
        });
        if (!filter_items.season[choice.season]) choice.season = 0;
        var s = season_objs[choice.season];

        if (s && s.folder) {
          s.folder.forEach(function (e) {
            if (e.folder) {
              e.folder.forEach(function (v) {
                var voice = v.title || v.comment || '';
                if (filter_items.voice.indexOf(voice) == -1) filter_items.voice.push(voice);
              });
            }
          });
        }

        if (!filter_items.voice[choice.voice]) choice.voice = 0;

        if (choice.voice_name) {
          var inx = filter_items.voice.indexOf(choice.voice_name);
          if (inx == -1) choice.voice = 0;else if (inx !== choice.voice) {
            choice.voice = inx;
          }
        }

        component.filter(filter_items, choice);
      }

      function parseSubs(str) {
        if (!str) return false;
        var subtitles = component.parsePlaylist(str).map(function (item) {
          var link = item.links[0] || '';
          link = link.replace('/sundb.coldcdn.xyz/', '/sundb.nl/');
          link = component.fixLinkProtocol(link, prefer_http, true);
          return {
            label: item.label,
            url: component.processSubs(component.proxyLink(link, prox, prox_enc2))
          };
        });
        return subtitles.length ? subtitles : false;
      }
      /**
       * Отфильтровать файлы
       * @returns array
       */


      function filtred() {
        var filtred = [];
        extract.forEach(function (data) {
          if (data.folder) {
            var s_title = data.title || data.comment || '';

            if (s_title == filter_items.season[choice.season]) {
              data.folder.forEach(function (e) {
                if (e.folder) {
                  var e_title = e.title || e.comment || '';
                  var found = false;
                  var found_broken = false;
                  e.folder.forEach(function (v) {
                    var voice = v.title || v.comment || '';

                    if (!found && voice == filter_items.voice[choice.voice] && v.file) {
                      if (v.file.indexOf('//sarnage.cc/') !== -1) {
                        found_broken = true;
                      } else {
                        found = true;
                        var episode_num = parseInt(e_title.match(/\d+/));
                        var season_num = parseInt(s_title.match(/\d+/));
                        filtred.push({
                          title: component.formatEpisodeTitle(season_num, episode_num),
                          quality: '360p ~ 1080p',
                          info: ' / ' + Lampa.Utils.shortText(voice, 50),
                          season: season_num,
                          episode: episode_num,
                          file: v.file,
                          subtitles: parseSubs(v.subtitle)
                        });
                      }
                    }
                  });

                  if (!found && found_broken) {
                    e.folder.forEach(function (v) {
                      var voice = v.title || v.comment || '';

                      if (!found && voice == filter_items.voice[choice.voice] && v.file) {
                        found = true;
                        var episode_num = parseInt(e_title.match(/\d+/));
                        var season_num = parseInt(s_title.match(/\d+/));
                        filtred.push({
                          title: component.formatEpisodeTitle(season_num, episode_num),
                          quality: '360p ~ 1080p',
                          info: ' / ' + Lampa.Utils.shortText(voice, 50),
                          season: season_num,
                          episode: episode_num,
                          file: v.file,
                          subtitles: parseSubs(v.subtitle)
                        });
                      }
                    });
                  }
                }
              });
            }
          } else {
            filtred.push({
              title: data.title || data.comment || select_title,
              quality: '360p ~ 1080p',
              info: '',
              file: data.file,
              subtitles: parseSubs(data.subtitle)
            });
          }
        });
        return filtred;
      }
      /**
       * Добавить видео
       * @param {Array} items
       */


      function append(items) {
        component.reset();
        var viewed = Lampa.Storage.cache('online_view', 5000, []);
        var last_episode = component.getLastEpisode(items);
        items.forEach(function (element) {
          if (element.season) {
            element.translate_episode_end = last_episode;
            element.translate_voice = filter_items.voice[choice.voice];
          }

          var hash = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title].join('') : object.movie.original_title);
          var view = component.watchView(element, hash, items);
          var item = Lampa.Template.get('online_mod', element);
          var hash_file = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title, filter_items.voice[choice.voice]].join('') : object.movie.original_title + element.title);
          element.timeline = view;
          item.append(Lampa.Timeline.render(view));

          if (Lampa.Timeline.details) {
            item.find('.online__quality').append(Lampa.Timeline.details(view, ' / '));
          }

          if (viewed.indexOf(hash_file) !== -1) item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
          item.on('hover:enter', function () {
            if (element.loading) return;
            if (object.movie.id) Lampa.Favorite.add('history', object.movie, 100);
            element.loading = true;
            getStream(element, function (element) {
              element.loading = false;
              var first = {
                url: component.getDefaultQuality(element.qualitys, element.stream),
                quality: component.renameQualityMap(element.qualitys),
                subtitles: element.subtitles,
                timeline: element.timeline,
                title: element.season ? element.title : select_title + (element.title == select_title ? '' : ' / ' + element.title)
              };

              if (element.season && Lampa.Platform.version) {
                var playlist = [];
                items.forEach(function (elem) {
                  if (elem == element) {
                    playlist.push(first);
                  } else {
                    var cell = {
                      url: function url(call) {
                        getStream(elem, function (elem) {
                          cell.url = component.getDefaultQuality(elem.qualitys, elem.stream);
                          cell.quality = component.renameQualityMap(elem.qualitys);
                          cell.subtitles = elem.subtitles;
                          call();
                        }, function () {
                          cell.url = '';
                          call();
                        });
                      },
                      timeline: elem.timeline,
                      title: elem.title
                    };
                    playlist.push(cell);
                  }
                });
                playWithoutPreroll(first, playlist);
              } else {
                playWithoutPreroll(first, [first]);
              }

              if (viewed.indexOf(hash_file) == -1) {
                viewed.push(hash_file);
                item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
                Lampa.Storage.set('online_view', viewed);
              }
            }, function () {
              element.loading = false;
              Lampa.Noty.show(Lampa.Lang.translate('online_mod_nolink'));
            });
          });
          component.append(item);
          component.contextmenu({
            item: item,
            view: view,
            viewed: viewed,
            hash_file: hash_file,
            element: element,
            file: function file(call) {
              getStream(element, function (element) {
                call({
                  file: element.stream,
                  quality: element.qualitys
                });
              }, function () {
                Lampa.Noty.show(Lampa.Lang.translate('online_mod_nolink'));
              });
            }
          });
        });
        component.start(true);
      }
    }

    cdnmovies.initSettings = function (show_all) {
      var balanser_name = 'CDNMovies';
      var component_name = 'online_mod_cdnmovies';
      if (Lampa.SettingsApi.getComponent(component_name)) return;

      {
        var icon = "<svg><use xlink:href=\"#sprite-settings\"></use></svg>";
        Lampa.SettingsApi.addComponent({
          component: component_name,
          icon: icon,
          name: balanser_name
        });
        Lampa.SettingsApi.addParam({
          component: 'online_mod',
          param: {
            name: component_name + '_settings',
            type: 'button'
          },
          field: {
            name: "<div class=\"settings-folder\" style=\"padding:0!important\"><div style=\"width:1.8em;height:1.3em;padding-right:.5em\">".concat(icon, "</div><div style=\"font-size:1.3em\">").concat(balanser_name, "</div></div>")
          },
          onChange: function onChange() {
            Lampa.Settings.create(component_name, {
              onBack: function onBack() {
                Lampa.Settings.create('online_mod');
              }
            });
          }
        });
      }

      {
        Lampa.SettingsApi.addParam({
          component: component_name,
          param: {
            name: 'online_mod_proxy_cdnmovies',
            type: 'trigger',
            "default": false
          },
          field: {
            name: Lampa.Lang.translate('online_mod_proxy_balanser') + ' ' + balanser_name
          }
        });
      }
    };

    cdnmovies.hideSettings = function (body) {
      $('[data-component="online_mod_cdnmovies"]', body).hide();
    };

    function filmix(component, _object, config) {
      var network = new Lampa.Reguest();
      var extract = {};
      var object = _object;
      var debug = !!(config && config.debug);
      var prox = component.proxy('filmix');
      var prox2 = component.proxy('filmix_site');
      var prox3 = component.proxy('filmix_abuse');
      var host = Utils.filmixHost();
      var ref = host + '/';
      var user_agent = Utils.baseUserAgent();
      var site = ref;
      var embed = Utils.filmixAppHost() + '/api/v2/';
      var headers = Lampa.Platform.is('android') ? {
        'User-Agent': Utils.filmixUserAgent()
      } : {};
      var prox_enc = '';

      if (prox) {
        prox_enc += 'param/User-Agent=' + encodeURIComponent(Utils.filmixUserAgent()) + '/';
      }

      var headers2 = Lampa.Platform.is('android') ? {
        'Origin': host,
        'Referer': ref,
        'User-Agent': user_agent,
        'X-Requested-With': 'XMLHttpRequest'
      } : {
        'X-Requested-With': 'XMLHttpRequest'
      };
      var prox2_enc = '';

      if (prox2) {
        prox2_enc += 'param/Origin=' + encodeURIComponent(host) + '/';
        prox2_enc += 'param/Referer=' + encodeURIComponent(ref) + '/';
        prox2_enc += 'param/User-Agent=' + encodeURIComponent(user_agent) + '/';
      }

      var select_title = '';
      var prefer_http = Lampa.Storage.field('online_mod_prefer_http') === true;
      var filter_items = {};
      var choice = {
        season: 0,
        voice: 0,
        voice_name: ''
      };
      var secret = '';
      var secret_url = '';

      function decodeSecretToken(callback) {
        {
          if (callback) callback();
          return;
        }
      }

      if (!window.mod_filmix) {
        window.mod_filmix = {
          max_qualitie: 480,
          is_max_qualitie: false
        };
      }

      var token = Lampa.Storage.get('filmix_token', '') + '';
      var dev_token = Utils.filmixToken(Utils.randomHex(16), token || 'aaaabbbbccccddddeeeeffffaaaabbbb');
      var abuse_token = prox3 ? Utils.filmixToken(Utils.randomHex(16), 'aaaabbbbccccddddeeeeffffaaaabbbb') : '';
      /**
       * Начать поиск
       * @param {Object} _object
       * @param {String} kinopoisk_id
       */

      this.search = function (_object, kinopoisk_id, data) {
        var _this = this;

        object = _object;
        select_title = object.search || object.movie.title;
        if (this.wait_similars && data && data[0].is_similars) return find(data[0].id);
        var search_date = object.search_date || !object.clarification && (object.movie.release_date || object.movie.first_air_date || object.movie.last_air_date) || '0000';
        var search_year = parseInt((search_date + '').slice(0, 4));
        var orig_titles = [];

        if (object.movie.alternative_titles && object.movie.alternative_titles.results) {
          orig_titles = object.movie.alternative_titles.results.map(function (t) {
            return t.title;
          });
        }

        if (object.movie.original_title) orig_titles.push(object.movie.original_title);
        if (object.movie.original_name) orig_titles.push(object.movie.original_name);
        var clean_title = component.cleanTitle(select_title).replace(/\b(\d\d\d\d+)\b/g, '+$1');
        var object_date = object.movie.release_date || object.movie.first_air_date || object.movie.last_air_date || '0000';
        var object_year = parseInt((object_date + '').slice(0, 4));

        if (object_year) {
          clean_title = clean_title.replace(new RegExp(' \\+(' + object_year + ')$'), ' $1');
        }

        var display = function display(json) {
          if (json && json.length && json.forEach) {
            var is_sure = false;
            json.forEach(function (c) {
              if (!c.orig_title) c.orig_title = c.original_title || c.original_name;
              if (!c.year && c.alt_name) c.year = parseInt(c.alt_name.split('-').pop());
            });
            var cards = json;

            if (cards.length) {
              if (orig_titles.length) {
                var tmp = cards.filter(function (c) {
                  return component.containsAnyTitle([c.orig_title, c.title], orig_titles);
                });

                if (tmp.length) {
                  cards = tmp;
                  is_sure = true;
                }
              }

              if (select_title) {
                var _tmp = cards.filter(function (c) {
                  return component.containsAnyTitle([c.title, c.orig_title], [select_title]);
                });

                if (_tmp.length) {
                  cards = _tmp;
                  is_sure = true;
                }
              }

              if (cards.length > 1 && search_year) {
                var _tmp2 = cards.filter(function (c) {
                  return c.year == search_year;
                });

                if (!_tmp2.length) _tmp2 = cards.filter(function (c) {
                  return c.year && c.year > search_year - 2 && c.year < search_year + 2;
                });
                if (_tmp2.length) cards = _tmp2;
              }
            }

            if (cards.length == 1 && is_sure) {
              if (search_year && cards[0].year) {
                is_sure = cards[0].year > search_year - 2 && cards[0].year < search_year + 2;
              }

              if (is_sure) {
                is_sure = false;

                if (orig_titles.length) {
                  is_sure |= component.equalAnyTitle([cards[0].orig_title, cards[0].title], orig_titles);
                }

                if (select_title) {
                  is_sure |= component.equalAnyTitle([cards[0].title, cards[0].orig_title], [select_title]);
                }
              }
            }

            if (cards.length == 1 && is_sure) find(cards[0].id);else if (json.length) {
              _this.wait_similars = true;
              json.forEach(function (c) {
                c.is_similars = true;
                c.seasons_count = c.last_episode && c.last_episode.season;
                c.episodes_count = c.last_episode && c.last_episode.episode;
              });
              component.similars(json);
              component.loading(false);
            } else component.emptyForQuery(select_title);
          } else component.emptyForQuery(select_title);
        };

        var siteSearch = function siteSearch() {
          var url = site + 'api/v2/suggestions?search_word=' + encodeURIComponent(clean_title);
          network.clear();
          network.timeout(15000);
          network["native"](component.proxyLink(url, prox2, prox2_enc, 'enc2t'), function (json) {
            display(json && json.posts || []);
          }, function (a, c) {
            component.empty(network.errorDecode(a, c));
          }, false, {
            headers: headers2
          });
        };

        var apiSearch = function apiSearch(abuse) {
          var url = embed + 'search' + (abuse ? abuse_token : dev_token);
          url = Lampa.Utils.addUrlComponent(url, 'story=' + encodeURIComponent(clean_title));
          url = abuse ? component.proxyLink(url, prox3, '', '') : component.proxyLink(url, prox, prox_enc, 'enc2t');
          network.clear();
          network.timeout(15000);
          network["native"](url, function (json) {
            if (json && json.length && json.forEach) display(json);else siteSearch();
          }, function (a, c) {
            if (!abuse && abuse_token) apiSearch(true);else siteSearch();
          }, false, {
            headers: headers
          });
        };

        decodeSecretToken(function () {
          return apiSearch();
        });
      };

      function find(filmix_id, abuse, abuse_error, low_quality) {
        if (!debug && !window.mod_filmix.is_max_qualitie) {
          window.mod_filmix.is_max_qualitie = true;
          token = Lampa.Storage.get('filmix_token', '') + '';
          dev_token = Utils.filmixToken(Utils.randomHex(16), token || 'aaaabbbbccccddddeeeeffffaaaabbbb');

          if (token) {
            var url = embed + 'user_profile' + dev_token;
            network.clear();
            network.timeout(15000);
            network["native"](component.proxyLink(url, prox, prox_enc, 'enc2t'), function (found) {
              if (found && found.user_data) {
                window.mod_filmix.max_qualitie = 720;
                if (found.user_data.is_pro) window.mod_filmix.max_qualitie = 1080;
                if (found.user_data.is_pro_plus) window.mod_filmix.max_qualitie = 2160;
              }

              end_search();
            }, function (a, c) {
              end_search();
            }, false, {
              headers: headers
            });
          } else end_search();
        } else end_search();

        function end_search() {
          var url = embed + 'post/' + filmix_id + (abuse ? abuse_token : dev_token);
          url = abuse ? component.proxyLink(url, prox3, '', '') : component.proxyLink(url, prox, prox_enc, 'enc2t');

          var not_found = function not_found(str) {
            if (abuse && abuse_error) success(abuse_error);else if (!abuse && abuse_token) find(filmix_id, true, null, true);else if (str) component.empty(str);else component.emptyForQuery(select_title);
          };

          network.clear();
          network.timeout(15000);
          network["native"](url, function (found) {
            var pl_links = found && found.player_links || {};

            if (pl_links.movie && Object.keys(pl_links.movie).length > 0 || pl_links.playlist && Object.keys(pl_links.playlist).length > 0) {
              if (!abuse && abuse_token && checkAbuse(found)) find(filmix_id, true, found);else success(found, low_quality);
            } else {
              console.log('Filmix', 'not found:', filmix_id, pl_links.movie, pl_links.playlist);
              not_found();
            }
          }, function (a, c) {
            console.log('Filmix', 'error:', filmix_id, network.errorDecode(a, c));
            not_found(network.errorDecode(a, c));
          }, false, {
            headers: headers
          });
        }
      }

      this.extendChoice = function (saved) {
        Lampa.Arrays.extend(choice, saved, true);
      };
      /**
       * Сброс фильтра
       */


      this.reset = function () {
        component.reset();
        choice = {
          season: 0,
          voice: 0,
          voice_name: ''
        };
        filter();
        append(filtred());
        component.saveChoice(choice);
      };
      /**
       * Применить фильтр
       * @param {*} type
       * @param {*} a
       * @param {*} b
       */


      this.filter = function (type, a, b) {
        choice[a.stype] = b.index;
        if (a.stype == 'voice') choice.voice_name = filter_items.voice[b.index];
        component.reset();
        filter();
        append(filtred());
        component.saveChoice(choice);
      };
      /**
       * Уничтожить
       */


      this.destroy = function () {
        network.clear();
        extract = null;
      };
      /**
       * Успешно, есть данные
       * @param {Object} json
       */


      function success(json, low_quality) {
        component.loading(false);
        extractData(json, low_quality);
        filter();
        append(filtred());
      }

      function checkAbuse(data) {
        var pl_links = data.player_links || {};

        if (pl_links.movie && Object.keys(pl_links.movie).length > 0) {

          for (var ID in pl_links.movie) {
            var file = pl_links.movie[ID];
            var stream_url = file.link || '';

            if (file.translation === 'Заблокировано правообладателем!' && stream_url.indexOf('/abuse_') !== -1) {
              var found = stream_url.match(/https?:\/\/[^\/]+(\/s\/[^\/]*\/)/);

              if (found) {
                {
                  secret = '$1' + found[1];
                  secret_url = '';
                }

                console.log('Filmix', 'abuse:', data.id, Object.keys(pl_links.movie).length);
                return true;
              }
            }
          }
        }

        return false;
      }
      /**
       * Получить информацию о фильме
       * @param {Arrays} data
       */


      function extractData(data, low_quality) {
        extract = {};
        var filmix_max_qualitie = low_quality ? 480 : debug ? 2160 : window.mod_filmix.max_qualitie;
        var pl_links = data.player_links || {};

        if (pl_links.playlist && Object.keys(pl_links.playlist).length > 0) {
          var seasons = [];
          var seas_num = 0;

          for (var season_id in pl_links.playlist) {
            var season = pl_links.playlist[season_id];
            var voices = [];
            ++seas_num;

            for (var voice_id in season) {
              var episodes = season[voice_id];
              var items = [];
              var epis_num = 0;

              for (var episode_id in episodes) {
                var file = episodes[episode_id];
                ++epis_num;
                var quality_eps = file.qualities.filter(function (qualitys) {
                  return !isNaN(qualitys) && qualitys <= filmix_max_qualitie;
                });
                quality_eps.sort(function (a, b) {
                  return b - a;
                });
                var max_quality = quality_eps[0];

                if (max_quality) {
                  var stream_url = file.link || '';
                  stream_url = component.fixLinkProtocol(stream_url, prefer_http, true);

                  if (secret) {
                    stream_url = stream_url.replace(/(https?:\/\/[^\/]+)\/s\/[^\/]*\//, secret);
                    if (secret_url) stream_url = stream_url.replace(/^https?:\/\//, secret_url);
                  }

                  var seas_id = parseInt(season_id);
                  var epis_id = parseInt(episode_id);

                  if (isNaN(seas_id) || isNaN(epis_id)) {
                    var s_e = stream_url.substring(stream_url.lastIndexOf('/'));
                    var str_s_e = s_e.match(/s(\d+)e(\d+)_%s\.mp4/i);

                    if (str_s_e) {
                      seas_id = parseInt(str_s_e[1]);
                      epis_id = parseInt(str_s_e[2]);
                    }
                  }

                  if (isNaN(seas_id)) seas_id = seas_num;
                  if (isNaN(epis_id)) epis_id = epis_num;
                  items.push({
                    season: seas_id,
                    episode: epis_id,
                    file: stream_url,
                    quality: max_quality,
                    qualities: quality_eps
                  });
                }
              }

              if (items.length) {
                voices.push({
                  id: voice_id,
                  items: items
                });
              }
            }

            if (voices.length) {
              seasons.push({
                id: season_id,
                title: Lampa.Lang.translate('torrent_serial_season') + ' ' + (isNaN(season_id) ? seas_num : season_id),
                voices: voices
              });
            }
          }

          extract.seasons = seasons;
        } else if (pl_links.movie && Object.keys(pl_links.movie).length > 0) {
          var movies = [];

          for (var ID in pl_links.movie) {
            var _file = pl_links.movie[ID];
            var _max_quality = filmix_max_qualitie;

            var _stream_url = _file.link || '';

            _stream_url = component.fixLinkProtocol(_stream_url, prefer_http, true);

            if (secret) {
              _stream_url = _stream_url.replace(/(https?:\/\/[^\/]+)\/s\/[^\/]*\//, secret);
              if (secret_url) _stream_url = _stream_url.replace(/^https?:\/\//, secret_url);
            }

            var _quality_eps = _stream_url.match(/\[([\d,]*)\]\.mp4/i);

            if (_quality_eps) {
              _quality_eps = _quality_eps[1].split(',').map(function (quality) {
                return parseInt(quality);
              }).filter(function (quality) {
                return !isNaN(quality) && quality <= filmix_max_qualitie;
              });

              _quality_eps.sort(function (a, b) {
                return b - a;
              });

              _max_quality = _quality_eps[0];
            }

            if (_max_quality) {
              var file_url = _stream_url.replace(/\[[\d,]*\](\.mp4)/i, '%s$1');

              movies.push({
                translation: _file.translation,
                file: file_url,
                quality: _max_quality,
                qualities: _quality_eps
              });
            }
          }

          extract.movies = movies;
        }
      }
      /**
       * Найти поток
       * @param {Object} element
       * @returns string
       */


      function getFile(element) {
        var media = element.media || {};
        var file = media.file;
        var quality = false;

        if (file) {
          quality = {};

          if (media.qualities) {
            media.qualities.forEach(function (q) {
              quality[q + 'p'] = file.replace(/%s(\.mp4)/i, q + '$1');
            });
            file = file.replace(/%s(\.mp4)/i, media.qualities[0] + '$1');
          }
        }

        return {
          file: file,
          quality: quality
        };
      }
      /**
       * Построить фильтр
       */


      function filter() {
        filter_items = {
          season: extract.seasons ? extract.seasons.map(function (s) {
            return s.title;
          }) : [],
          voice: []
        };
        if (!filter_items.season[choice.season]) choice.season = 0;

        if (extract.seasons && extract.seasons[choice.season]) {
          filter_items.voice = extract.seasons[choice.season].voices.map(function (v) {
            return v.id;
          });
        }

        if (!filter_items.voice[choice.voice]) choice.voice = 0;

        if (choice.voice_name) {
          var inx = filter_items.voice.indexOf(choice.voice_name);
          if (inx == -1) choice.voice = 0;else if (inx !== choice.voice) {
            choice.voice = inx;
          }
        }

        component.filter(filter_items, choice);
      }
      /**
       * Отфильтровать файлы
       * @returns array
       */


      function filtred() {
        var filtred = [];

        if (extract.seasons) {
          var season = extract.seasons[choice.season] || {};
          var voices = season.voices || [];
          var voice = voices[choice.voice] || {};
          var voice_name = Lampa.Utils.shortText(filter_items.voice[choice.voice] || '', 50);
          var items = voice.items || [];
          items.forEach(function (media) {
            filtred.push({
              title: component.formatEpisodeTitle(media.season, media.episode),
              quality: media.quality + 'p',
              info: voice_name ? ' / ' + voice_name : '',
              season: media.season,
              episode: media.episode,
              media: media
            });
          });
        } else if (extract.movies) {
          extract.movies.forEach(function (media) {
            filtred.push({
              title: media.translation || select_title,
              quality: media.quality + 'p',
              info: '',
              media: media
            });
          });
        }

        return filtred;
      }
      /**
       * Добавить видео
       * @param {Array} items
       */


      function append(items) {
        component.reset();
        var viewed = Lampa.Storage.cache('online_view', 5000, []);
        var last_episode = component.getLastEpisode(items);
        items.forEach(function (element) {
          if (element.season) {
            element.translate_episode_end = last_episode;
            element.translate_voice = filter_items.voice[choice.voice];
          }

          var hash = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title].join('') : object.movie.original_title);
          var view = component.watchView(element, hash, items);
          var item = Lampa.Template.get('online_mod', element);
          var hash_file = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title, filter_items.voice[choice.voice]].join('') : object.movie.original_title + element.title);
          element.timeline = view;
          item.append(Lampa.Timeline.render(view));

          if (Lampa.Timeline.details) {
            item.find('.online__quality').append(Lampa.Timeline.details(view, ' / '));
          }

          if (viewed.indexOf(hash_file) !== -1) item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
          item.on('hover:enter', function () {
            if (object.movie.id) Lampa.Favorite.add('history', object.movie, 100);
            var extra = getFile(element);

            if (extra.file) {
              var playlist = [];
              var first = {
                anime_skip: skipOf(element),
                url: component.getDefaultQuality(extra.quality, extra.file),
                quality: component.renameQualityMap(extra.quality),
                timeline: element.timeline,
                title: element.season ? element.title : select_title + (element.title == select_title ? '' : ' / ' + element.title)
              };

              if (element.season) {
                items.forEach(function (elem) {
                  var ex = getFile(elem);
                  playlist.push({
                    anime_skip: skipOf(elem),
                    url: component.getDefaultQuality(ex.quality, ex.file),
                    quality: component.renameQualityMap(ex.quality),
                    timeline: elem.timeline,
                    title: elem.title
                  });
                });
              } else {
                playlist.push(first);
              }

              if (playlist.length > 1) first.playlist = playlist;
              playWithoutPreroll(first, playlist);

              if (viewed.indexOf(hash_file) == -1) {
                viewed.push(hash_file);
                item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
                Lampa.Storage.set('online_view', viewed);
              }
            } else Lampa.Noty.show(Lampa.Lang.translate('online_mod_nolink'));
          });
          component.append(item);
          component.contextmenu({
            item: item,
            view: view,
            viewed: viewed,
            hash_file: hash_file,
            element: element,
            file: function file(call) {
              call(getFile(element));
            }
          });
        });
        component.start(true);
      }
    }

    var network$2 = new Lampa.Reguest();
    var filmix_headers = Lampa.Platform.is('android') ? {
      'User-Agent': Utils.filmixUserAgent()
    } : {};
    var api_url = Utils.filmixAppHost() + '/api/v2/';
    var dev_id = Utils.randomHex(16);
    var ping_auth;

    function showStatus() {
      var status = Lampa.Storage.get('filmix_status', '{}');
      var info = Lampa.Lang.translate('online_mod_filmix_nodevice');

      if (status.login) {
        if (status.is_pro) info = status.login + ' - PRO ' + Lampa.Lang.translate('filter_rating_to') + ' - ' + status.pro_date;else if (status.is_pro_plus) info = status.login + ' - PRO_PLUS ' + Lampa.Lang.translate('filter_rating_to') + ' - ' + status.pro_date;else info = status.login + ' - NO PRO';
      }

      var field = $(Lampa.Lang.translate("\n        <div class=\"settings-param\" data-name=\"online_mod_filmix_status\" data-static=\"true\">\n            <div class=\"settings-param__name\">#{online_mod_filmix_status}</div>\n            <div class=\"settings-param__value\">".concat(info, "</div>\n        </div>")));
      $('.settings [data-name="online_mod_filmix_status"]').remove();
      $('.settings [data-name="online_mod_filmix_add"]').after(field);
    }

    function checkPro(token, call) {
      var filmix_prox = Utils.proxy('filmix');
      var filmix_prox_enc = '';

      if (filmix_prox) {
        filmix_prox_enc += 'param/User-Agent=' + encodeURIComponent(Utils.filmixUserAgent()) + '/';
      }

      network$2.clear();
      network$2.timeout(8000);
      network$2["native"](Utils.proxyLink(api_url + 'user_profile' + Utils.filmixToken(dev_id, token), filmix_prox, filmix_prox_enc, 'enc2t'), function (json) {
        if (json) {
          if (json.user_data) {
            Lampa.Storage.set('filmix_status', json.user_data);
            showStatus();
            if (call) call();
          }
        }
      }, function (a, c) {
        Lampa.Noty.show(network$2.errorDecode(a, c));
      }, false, {
        headers: filmix_headers
      });
    }

    filmix.initSettings = function (show_all) {
      var balanser_name = 'Filmix';
      var component_name = 'online_mod_filmix';
      if (Lampa.SettingsApi.getComponent(component_name)) return;

      {
        var icon = "<svg height=\"57\" viewBox=\"0 0 58 57\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n            <path d=\"M20 20.3735V45H26.8281V34.1262H36.724V26.9806H26.8281V24.3916C26.8281 21.5955 28.9062 19.835 31.1823 19.835H39V13H26.8281C23.6615 13 20 15.4854 20 20.3735Z\" fill=\"white\"/>\n            <rect x=\"2\" y=\"2\" width=\"54\" height=\"53\" rx=\"5\" stroke=\"white\" stroke-width=\"4\"/>\n        </svg>";
        Lampa.SettingsApi.addComponent({
          component: component_name,
          icon: icon,
          name: balanser_name
        });
        Lampa.SettingsApi.addParam({
          component: 'online_mod',
          param: {
            name: component_name + '_settings',
            type: 'button'
          },
          field: {
            name: "<div class=\"settings-folder\" style=\"padding:0!important\"><div style=\"width:1.8em;height:1.3em;padding-right:.5em\">".concat(icon, "</div><div style=\"font-size:1.3em\">").concat(balanser_name, "</div></div>")
          },
          onChange: function onChange() {
            Lampa.Settings.create(component_name, {
              onBack: function onBack() {
                Lampa.Settings.create('online_mod');
              }
            });
          }
        });
      }

      {
        Lampa.SettingsApi.addParam({
          component: component_name,
          param: {
            name: 'online_mod_proxy_filmix',
            type: 'trigger',
            "default": false
          },
          field: {
            name: Lampa.Lang.translate('online_mod_proxy_balanser') + ' ' + balanser_name
          }
        });
      }

      {
        var filmix_token = {};
        Lampa.SettingsApi.addParam({
          component: component_name,
          param: {
            name: 'filmix_token',
            placeholder: Lampa.Lang.translate('online_mod_filmix_param_placeholder'),
            type: 'input',
            values: '',
            "default": ''
          },
          field: {
            name: Lampa.Lang.translate('online_mod_filmix_param_add_title'),
            description: Lampa.Lang.translate('online_mod_filmix_param_add_descr')
          },
          onRender: function onRender(item) {
            filmix_token = item;
          },
          onChange: function onChange(value) {
            window.mod_filmix = {
              max_qualitie: 480,
              is_max_qualitie: false
            };
            Lampa.Storage.set('filmix_status', {});
            showStatus();
            if (value) checkPro(value);
          }
        });
        Lampa.SettingsApi.addParam({
          component: component_name,
          param: {
            name: 'online_mod_filmix_add',
            type: 'button'
          },
          field: {
            name: Lampa.Lang.translate('online_mod_filmix_param_add_device')
          },
          onChange: function onChange() {
            var user_code = '';
            var user_token = '';
            var filmix_prox = Utils.proxy('filmix');
            var filmix_prox_enc = '';

            if (filmix_prox) {
              filmix_prox_enc += 'param/User-Agent=' + encodeURIComponent(Utils.filmixUserAgent()) + '/';
            }

            var modal = $('<div><div class="broadcast__text">' + Lampa.Lang.translate('online_mod_filmix_modal_text') + '</div><div class="broadcast__device selector" style="text-align: center">' + Lampa.Lang.translate('online_mod_filmix_modal_wait') + '...</div><br><div class="broadcast__scan"><div></div></div></div></div>');
            Lampa.Modal.open({
              title: '',
              html: modal,
              onBack: function onBack() {
                clearInterval(ping_auth);
                Lampa.Modal.close();
                Lampa.Controller.toggle('settings_component');
              },
              onSelect: function onSelect() {
                Lampa.Utils.copyTextToClipboard(user_code, function () {
                  Lampa.Noty.show(Lampa.Lang.translate('online_mod_filmix_copy_secuses'));
                }, function () {
                  Lampa.Noty.show(Lampa.Lang.translate('online_mod_filmix_copy_fail'));
                });
              }
            });
            ping_auth = setInterval(function () {
              checkPro(user_token, function () {
                clearInterval(ping_auth);
                Lampa.Modal.close();
                Lampa.Storage.set('filmix_token', user_token);
                Lampa.Params.update(filmix_token, [], null);
                Lampa.Controller.toggle('settings_component');
              });
            }, 10000);
            network$2.clear();
            network$2.timeout(10000);
            network$2["native"](Utils.proxyLink(api_url + 'token_request' + Utils.filmixToken(dev_id, ''), filmix_prox, filmix_prox_enc, 'enc2t'), function (found) {
              if (found && found.status == 'ok') {
                user_token = found.code;
                user_code = found.user_code;
                modal.find('.selector').text(user_code); //modal.find('.broadcast__scan').remove()
              } else {
                clearInterval(ping_auth);
                modal.find('.selector').text(Lampa.Lang.translate('network_401'));
                modal.find('.broadcast__scan').remove();
                Lampa.Noty.show(Lampa.Lang.translate('network_401'));
              }
            }, function (a, c) {
              clearInterval(ping_auth);
              modal.find('.selector').text(Lampa.Lang.translate('network_noconnect') + ': ' + network$2.errorCode(a));
              modal.find('.broadcast__scan').remove();
              Lampa.Noty.show(network$2.errorDecode(a, c));
            }, false, {
              headers: filmix_headers
            });
          }
        });
      }

      Lampa.Settings.listener.follow('open', function (e) {
        if (e.name == component_name) {
          showStatus();
        }
      });
    };

    filmix.hideSettings = function (body) {
      $('[data-component="online_mod_filmix"]', body).hide();
    };

    function zetflix(component, _object, config) {
      var network = new Lampa.Reguest();
      var extract = [];
      var object = _object;
      var select_title = '';
      var select_id = '';
      var prefer_http = Lampa.Storage.field('online_mod_prefer_http') === true;
      var prox = component.proxy('zetflix');
      var prox_enc = '';

      var embed = (prefer_http ? 'http:' : 'https:') + '//hidxlglk.deploy.cx/lite/zetflix';
      var filter_items = {};
      var choice = {
        season: 0,
        voice: 0,
        voice_name: ''
      };
      /**
       * Начать поиск
       * @param {Object} _object
       * @param {String} kinopoisk_id
       */

      this.search = function (_object, kinopoisk_id) {
        object = _object;
        select_id = kinopoisk_id;
        select_title = object.search || object.movie.title;

        if (isNaN(select_id)) {
          component.emptyForQuery(select_title);
          return;
        }

        extract = [];
        getEpisodes();
      };

      function getEpisodes() {
        var s = object.movie.number_of_seasons ? choice.season + 1 : 0;

        if (extract[s]) {
          component.loading(false);
          filter();
          append(filtred());
          return;
        }

        var url = Lampa.Utils.addUrlComponent(embed, 'kinopoisk_id=' + select_id);
        if (s) url = Lampa.Utils.addUrlComponent(url, 's=' + s);
        url = Lampa.Utils.addUrlComponent(url, 'orightml=true');

        var call_success = function call_success(str) {
          parse(str);
        };

        var call_error = function call_error(a, c) {
          component.empty(network.errorDecode(a, c));
        };

        {
          var meta = $('head meta[name="referrer"]');
          var referrer = meta.attr('content') || 'never';
          meta.attr('content', 'origin');

          try {
            network.clear();
            network.timeout(10000);
            network.silent(url, call_success, call_error, false, {
              dataType: 'text'
            });
          } finally {
            meta.attr('content', referrer);
          }
        }
      }

      this.extendChoice = function (saved) {
        Lampa.Arrays.extend(choice, saved, true);
      };
      /**
       * Сброс фильтра
       */


      this.reset = function () {
        component.reset();
        choice = {
          season: 0,
          voice: 0,
          voice_name: ''
        };
        component.loading(true);
        getEpisodes();
        component.saveChoice(choice);
      };
      /**
       * Применить фильтр
       * @param {*} type
       * @param {*} a
       * @param {*} b
       */


      this.filter = function (type, a, b) {
        choice[a.stype] = b.index;
        if (a.stype == 'voice') choice.voice_name = filter_items.voice[b.index];
        component.reset();
        component.loading(true);
        getEpisodes();
        component.saveChoice(choice);
        setTimeout(component.closeFilter, 10);
      };
      /**
       * Уничтожить
       */


      this.destroy = function () {
        network.clear();
        extract = null;
      };
      /**
       * Получить потоки
       * @param {String} str
       * @returns array
       */


      function extractItems(str) {
        if (!str) return [];

        try {
          var items = component.parsePlaylist(str).map(function (item) {
            var quality = item.label.match(/(\d\d\d+)/);
            var link = item.links[0] || '';
            link = component.fixLinkProtocol(link, prefer_http, true);
            return {
              label: item.label,
              quality: quality ? parseInt(quality[1]) : NaN,
              file: component.proxyLink(link, prox, prox_enc)
            };
          });
          items.sort(function (a, b) {
            if (b.quality > a.quality) return 1;
            if (b.quality < a.quality) return -1;
            if (b.label > a.label) return 1;
            if (b.label < a.label) return -1;
            return 0;
          });
          return items;
        } catch (e) {}

        return [];
      }

      function parse(str) {
        component.loading(false);
        str = (str || '').replace(/\n/g, '');
        var find = str.match(/Playerjs\(({.*?})\);/);
        var json;

        try {
          json = find && (0, eval)('"use strict"; (function(){ var sign = function(){}; return ' + find[1] + '; })();');
        } catch (e) {}

        if (json && json.file) {
          var s = object.movie.number_of_seasons ? choice.season + 1 : 0;
          extract[s] = typeof json.file === 'string' ? [json] : json.file;
          extract[s].forEach(function (data) {
            if (data.folder) {
              data.folder.forEach(function (e) {
                e.media = {
                  items: extractItems(e.file)
                };
              });
            } else {
              data.media = {
                items: extractItems(data.file)
              };
            }
          });
          filter();
          append(filtred());
        } else component.emptyForQuery(select_title);
      }
      /**
       * Построить фильтр
       */


      function filter() {
        filter_items = {
          season: [],
          voice: []
        };

        if (object.movie.number_of_seasons) {
          for (var snum = 1; snum <= object.movie.number_of_seasons; snum++) {
            filter_items.season.push(Lampa.Lang.translate('torrent_serial_season') + ' ' + snum);
          }
        }

        if (!filter_items.season[choice.season]) choice.season = 0;
        var extract_s = extract[object.movie.number_of_seasons ? choice.season + 1 : 0] || [];
        extract_s.forEach(function (v) {
          if (v.folder) {
            var voice = v.title || v.comment || '';
            if (filter_items.voice.indexOf(voice) == -1) filter_items.voice.push(voice);
          }
        });
        if (!filter_items.voice[choice.voice]) choice.voice = 0;

        if (choice.voice_name) {
          var inx = filter_items.voice.indexOf(choice.voice_name);
          if (inx == -1) choice.voice = 0;else if (inx !== choice.voice) {
            choice.voice = inx;
          }
        }

        component.filter(filter_items, choice);
      }
      /**
       * Отфильтровать файлы
       * @returns array
       */


      function filtred() {
        var filtred = [];
        var extract_s = extract[object.movie.number_of_seasons ? choice.season + 1 : 0] || [];
        extract_s.forEach(function (data) {
          if (data.folder) {
            var voice = data.title || data.comment || '';

            if (voice == filter_items.voice[choice.voice]) {
              data.folder.forEach(function (e) {
                if (e.file) {
                  var e_title = e.title || e.comment || '';
                  var max_quality = e.media.items[0] || {};
                  var episode_num = parseInt(e_title.match(/\d+/));
                  var season_num = choice.season + 1;
                  filtred.push({
                    title: component.formatEpisodeTitle(season_num, episode_num),
                    quality: max_quality.label || '360p ~ 1080p',
                    info: ' / ' + Lampa.Utils.shortText(voice, 50),
                    season: season_num,
                    episode: episode_num,
                    media: e.media
                  });
                }
              });
            }

            filtred.sort(function (a, b) {
              return a.episode - b.episode;
            });
          } else if (data.file) {
            var max_quality = data.media.items[0] || {};
            filtred.push({
              title: data.title || data.comment || select_title,
              quality: max_quality.label || '360p ~ 1080p',
              info: '',
              media: data.media
            });
          }
        });
        return filtred;
      }
      /**
       * Найти поток
       * @param {Object} element
       * @returns string
       */


      function getFile(element) {
        var file = '';
        var quality = false;
        var items = element.media.items;

        if (items && items.length) {
          file = items[0].file;
          quality = {};
          items.forEach(function (item) {
            quality[item.label] = item.file;
          });
        }

        return {
          file: file,
          quality: quality
        };
      }
      /**
       * Показать файлы
       */


      function append(items) {
        component.reset();
        var viewed = Lampa.Storage.cache('online_view', 5000, []);
        var last_episode = component.getLastEpisode(items);
        items.forEach(function (element) {
          if (element.season) {
            element.translate_episode_end = last_episode;
            element.translate_voice = filter_items.voice[choice.voice];
          }

          var hash = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title].join('') : object.movie.original_title);
          var view = component.watchView(element, hash, items);
          var item = Lampa.Template.get('online_mod', element);
          var hash_file = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title, filter_items.voice[choice.voice]].join('') : object.movie.original_title + element.title);
          element.timeline = view;
          item.append(Lampa.Timeline.render(view));

          if (Lampa.Timeline.details) {
            item.find('.online__quality').append(Lampa.Timeline.details(view, ' / '));
          }

          if (viewed.indexOf(hash_file) !== -1) item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
          item.on('hover:enter', function () {
            if (object.movie.id) Lampa.Favorite.add('history', object.movie, 100);
            var extra = getFile(element);

            if (extra.file) {
              var playlist = [];
              var first = {
                url: component.getDefaultQuality(extra.quality, extra.file),
                quality: component.renameQualityMap(extra.quality),
                timeline: element.timeline,
                title: element.season ? element.title : select_title + (element.title == select_title ? '' : ' / ' + element.title)
              };

              if (element.season) {
                items.forEach(function (elem) {
                  var ex = getFile(elem);
                  playlist.push({
                    url: component.getDefaultQuality(ex.quality, ex.file),
                    quality: component.renameQualityMap(ex.quality),
                    timeline: elem.timeline,
                    title: elem.title
                  });
                });
              } else {
                playlist.push(first);
              }

              if (playlist.length > 1) first.playlist = playlist;
              playWithoutPreroll(first, playlist);

              if (viewed.indexOf(hash_file) == -1) {
                viewed.push(hash_file);
                item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
                Lampa.Storage.set('online_view', viewed);
              }
            } else Lampa.Noty.show(Lampa.Lang.translate('online_mod_nolink'));
          });
          component.append(item);
          component.contextmenu({
            item: item,
            view: view,
            viewed: viewed,
            hash_file: hash_file,
            element: element,
            file: function file(call) {
              call(getFile(element));
            }
          });
        });
        component.start(true);
      }
    }

    zetflix.initSettings = function (show_all) {
      var balanser_name = 'Zetflix';
      var component_name = 'online_mod_zetflix';
      if (Lampa.SettingsApi.getComponent(component_name)) return;

      {
        var icon = "<svg><use xlink:href=\"#sprite-settings\"></use></svg>";
        Lampa.SettingsApi.addComponent({
          component: component_name,
          icon: icon,
          name: balanser_name
        });
        Lampa.SettingsApi.addParam({
          component: 'online_mod',
          param: {
            name: component_name + '_settings',
            type: 'button'
          },
          field: {
            name: "<div class=\"settings-folder\" style=\"padding:0!important\"><div style=\"width:1.8em;height:1.3em;padding-right:.5em\">".concat(icon, "</div><div style=\"font-size:1.3em\">").concat(balanser_name, "</div></div>")
          },
          onChange: function onChange() {
            Lampa.Settings.create(component_name, {
              onBack: function onBack() {
                Lampa.Settings.create('online_mod');
              }
            });
          }
        });
      }

      {
        Lampa.SettingsApi.addParam({
          component: component_name,
          param: {
            name: 'online_mod_proxy_zetflix',
            type: 'trigger',
            "default": false
          },
          field: {
            name: Lampa.Lang.translate('online_mod_proxy_balanser') + ' ' + balanser_name
          }
        });
      }
    };

    zetflix.hideSettings = function (body) {
      $('[data-component="online_mod_zetflix"]', body).hide();
    };

    function fancdn(component, _object, config) {
      var network = new Lampa.Reguest();
      var extract = [];
      var object = _object;
      var select_title = '';
      var prefer_http = Lampa.Storage.field('online_mod_prefer_http') === true;
      var prox = component.proxy('fancdn');
      var host = Utils.fanserialsHost();
      var ref = host + '/';
      var user_agent = Utils.baseUserAgent();
      var headers = Lampa.Platform.is('android') ? {
        'Origin': host,
        'Referer': ref,
        'User-Agent': user_agent
      } : {};
      var prox_enc = '';

      if (prox) {
        prox_enc += 'param/Origin=' + encodeURIComponent(host) + '/';
        prox_enc += 'param/Referer=' + encodeURIComponent(ref) + '/';
        prox_enc += 'param/User-Agent=' + encodeURIComponent(user_agent) + '/';
      }

      var cookie = Lampa.Storage.get('online_mod_fancdn_cookie', '') + '';
      var authorization_required = !cookie;
      if (cookie.indexOf('PHPSESSID=') == -1) cookie = 'PHPSESSID=' + Utils.randomHex(32) + (cookie ? '; ' + cookie : '');

      if (cookie) {
        if (Lampa.Platform.is('android')) {
          headers.Cookie = cookie;
        }

        if (prox) {
          prox_enc += 'param/Cookie=' + encodeURIComponent(cookie) + '/';
        }
      }

      var embed = ref;
      var filter_items = {};
      var choice = {
        season: 0,
        voice: 0,
        voice_name: ''
      };
      /**
       * Начать поиск
       * @param {Object} _object
       * @param {String} kinopoisk_id
       */

      this.search = function (_object, kinopoisk_id, data) {
        var _this = this;

        object = _object;
        select_title = object.search || object.movie.title;
        if (this.wait_similars && data && data[0].is_similars) return getPage(data[0].link);
        var search_date = object.search_date || !object.clarification && (object.movie.release_date || object.movie.first_air_date || object.movie.last_air_date) || '0000';
        var search_year = parseInt((search_date + '').slice(0, 4));
        var orig_titles = [];

        if (object.movie.alternative_titles && object.movie.alternative_titles.results) {
          orig_titles = object.movie.alternative_titles.results.map(function (t) {
            return t.title;
          });
        }

        if (object.movie.original_title) orig_titles.push(object.movie.original_title);
        if (object.movie.original_name) orig_titles.push(object.movie.original_name);

        var display = function display(links) {
          if (links && links.length && links.forEach) {
            var is_sure = false;
            var items = links.map(function (l) {
              var li = $(l + '</div>');
              var link = $('a', li);
              var orig_div = $('div.name-origin-search', li);
              var titl = link.text().trim() || '';
              var orig_title = orig_div.text().trim() || '';
              var year;
              var found = orig_title.match(/^(.*)\((\d{4}\s*)\)$/);

              if (found) {
                year = parseInt(found[2]);
                orig_title = found[1].trim();
              }

              return {
                year: year,
                title: titl,
                orig_title: orig_title,
                link: link.attr('href') || ''
              };
            });
            var cards = items;

            if (cards.length) {
              if (orig_titles.length) {
                var tmp = cards.filter(function (c) {
                  return component.containsAnyTitle([c.orig_title, c.title], orig_titles);
                });

                if (tmp.length) {
                  cards = tmp;
                  is_sure = true;
                }
              }

              if (select_title) {
                var _tmp = cards.filter(function (c) {
                  return component.containsAnyTitle([c.title, c.orig_title], [select_title]);
                });

                if (_tmp.length) {
                  cards = _tmp;
                  is_sure = true;
                }
              }

              if (cards.length > 1 && search_year) {
                var _tmp2 = cards.filter(function (c) {
                  return c.year == search_year;
                });

                if (!_tmp2.length) _tmp2 = cards.filter(function (c) {
                  return c.year && c.year > search_year - 2 && c.year < search_year + 2;
                });
                if (_tmp2.length) cards = _tmp2;
              }
            }

            if (cards.length == 1 && is_sure) {
              if (search_year && cards[0].year) {
                is_sure = cards[0].year > search_year - 2 && cards[0].year < search_year + 2;
              }

              if (is_sure) {
                is_sure = false;

                if (orig_titles.length) {
                  is_sure |= component.equalAnyTitle([cards[0].orig_title, cards[0].title], orig_titles);
                }

                if (select_title) {
                  is_sure |= component.equalAnyTitle([cards[0].title, cards[0].orig_title], [select_title]);
                }
              }
            }

            if (cards.length == 1 && is_sure) getPage(cards[0].link);else if (items.length) {
              _this.wait_similars = true;
              items.forEach(function (c) {
                c.is_similars = true;
              });
              component.similars(items);
              component.loading(false);
            } else component.emptyForQuery(select_title);
          } else if (authorization_required) component.empty(Lampa.Lang.translate('online_mod_authorization_required') + ' FanSerials');else component.emptyForQuery(select_title);
        };

        var url = embed + 'index.php?do=search';
        var postdata = 'do=search&subaction=search&search_start=0&full_search=1&result_from=1&story=' + encodeURIComponent(select_title) + '&titleonly=3&searchuser=&replyless=0&replylimit=0&searchdate=0&beforeafter=after&sortby=title&resorder=asc&showposts=0&catlist%5B%5D=10';
        network.clear();
        network.timeout(10000);
        network["native"](component.proxyLink(url, prox, prox_enc, 'enc2t'), function (str) {
          str = (str || '').replace(/\n/g, '');
          var links = str.match(/<div class="item-search-header">\s*<h2>\s*<a [^>]*>[^<]*<\/a>\s*<\/h2>\s*<div class="name-origin-search">[^<]*<\/div>/g);
          display(links);
        }, function (a, c) {
          component.empty(network.errorDecode(a, c));
        }, postdata, {
          dataType: 'text',
          headers: headers
        });
      };

      function getPage(url) {
        url = component.fixLink(url, ref);
        network.clear();
        network.timeout(10000);
        network["native"](component.proxyLink(url, prox, prox_enc, 'enc2t'), function (str) {
          str = (str || '').replace(/\n/g, '');
          var player = str.match(/<iframe +id="iframe-player" +src=" *(\/movies\/(\d+)[^"]*)"/);

          if (player) {
            var player_url = Lampa.Utils.addUrlComponent(embed + atob('ZmlsbS5waHA='), 'kp=' + player[2]);
            var player_ref = component.fixLink(player[1], ref);
            var pos = player[1].indexOf('?');

            if (pos !== -1) {
              var token = player[1].substring(pos + 1);

              if (token) {
                Lampa.Storage.set('online_mod_fancdn_token', token);
                player_url += '&' + token;
              }
            }

            var player_headers = Lampa.Platform.is('android') ? {
              'Origin': host,
              'Referer': player_ref,
              'User-Agent': user_agent
            } : {};
            var prox_enc_player = '';

            if (prox) {
              prox_enc_player += 'param/Origin=' + encodeURIComponent(host) + '/';
              prox_enc_player += 'param/Referer=' + encodeURIComponent(player_ref) + '/';
              prox_enc_player += 'param/User-Agent=' + encodeURIComponent(user_agent) + '/';
            }

            if (cookie) {
              if (Lampa.Platform.is('android')) {
                headers.Cookie = cookie;
              }

              if (prox) {
                prox_enc_player += 'param/Cookie=' + encodeURIComponent(cookie) + '/';
              }
            }

            network.clear();
            network.timeout(10000);
            network["native"](component.proxyLink(player_url, prox, prox_enc_player, 'enc2t'), function (json) {
              parse(json, function () {
                component.emptyForQuery(select_title);
              });
            }, function (a, c) {
              component.empty(network.errorDecode(a, c));
            }, false, {
              headers: player_headers
            });
          } else if (authorization_required) component.empty(Lampa.Lang.translate('online_mod_authorization_required') + ' FanSerials');else component.emptyForQuery(select_title);
        }, function (a, c) {
          component.empty(network.errorDecode(a, c));
        }, false, {
          dataType: 'text',
          headers: headers
        });
      }

      this.extendChoice = function (saved) {
        Lampa.Arrays.extend(choice, saved, true);
      };
      /**
       * Сброс фильтра
       */


      this.reset = function () {
        component.reset();
        choice = {
          season: 0,
          voice: 0,
          voice_name: ''
        };
        filter();
        append(filtred());
        component.saveChoice(choice);
      };
      /**
       * Применить фильтр
       * @param {*} type
       * @param {*} a
       * @param {*} b
       */


      this.filter = function (type, a, b) {
        choice[a.stype] = b.index;
        if (a.stype == 'voice') choice.voice_name = filter_items.voice[b.index];
        component.reset();
        filter();
        append(filtred());
        component.saveChoice(choice);
      };
      /**
       * Уничтожить
       */


      this.destroy = function () {
        network.clear();
        extract = null;
      };
      /**
       * Получить потоки
       * @param {String} str
       * @returns array
       */


      function extractItems(str, url) {
        if (!str) return [];

        try {
          var items = component.parseM3U(str).map(function (item) {
            var link = item.link;
            var quality = item.height;
            var alt_quality = link.match(/\b(\d\d\d+)\./);

            if (alt_quality) {
              var alt_height = parseInt(alt_quality[1]);
              if (alt_height > quality && alt_height <= 4320) quality = alt_height;
            }

            return {
              label: quality ? quality + 'p' : '360p ~ 1080p',
              quality: quality,
              file: component.proxyStream(component.fixLink(link, url), 'fancdn')
            };
          });
          items.sort(function (a, b) {
            if (b.quality > a.quality) return 1;
            if (b.quality < a.quality) return -1;
            if (b.label > a.label) return 1;
            if (b.label < a.label) return -1;
            return 0;
          });
          return items;
        } catch (e) {}

        return [];
      }
      /**
       * Получить потоки
       * @param {String} str
       * @returns array
       */


      function extractItemsPlaylist(str, url) {
        if (!str) return [];

        try {
          var items = component.parsePlaylist(str).map(function (item) {
            var quality = item.label.match(/(\d\d\d+)/);
            var link = item.links[0] || '';
            link = component.fixLinkProtocol(link, prefer_http, true);
            return {
              label: item.label,
              quality: quality ? parseInt(quality[1]) : NaN,
              file: component.proxyStream(link, 'fancdn')
            };
          });
          items.sort(function (a, b) {
            if (b.quality > a.quality) return 1;
            if (b.quality < a.quality) return -1;
            if (b.label > a.label) return 1;
            if (b.label < a.label) return -1;
            return 0;
          });
          return items;
        } catch (e) {}

        return [];
      }
      /**
       * Получить поток
       * @param {*} element
       */


      function parseStream(element, call, error, itemsExtractor, str, url) {
        var file = '';
        var quality = false;
        var items = itemsExtractor(str, url);

        if (items && items.length) {
          file = items[0].file;
          quality = {};
          items.forEach(function (item) {
            quality[item.label] = item.file;
          });
        }

        if (file) {
          element.stream = file;
          element.qualitys = quality;
          element.subtitles = parseSubs(element.media.subtitles, url);
          call(element);
        } else error();
      }
      /**
       * Получить поток
       * @param {*} element
       */


      function getStreamM3U(element, call, error, file) {
        file = file.replace(/\.mp4:hls:manifest/, '');
        var hls_file = file.replace(/\/\d\d\d+([^\/]*\.m3u8)$/, '/hls$1');
        network.clear();
        network.timeout(5000);
        network["native"](component.proxyStream(hls_file, 'fancdn'), function (str) {
          parseStream(element, call, error, extractItems, str, hls_file);
        }, function (a, c) {
          if (file != hls_file) {
            network.clear();
            network.timeout(5000);
            network["native"](component.proxyStream(file, 'fancdn'), function (str) {
              parseStream(element, call, error, extractItems, str, file);
            }, function (a, c) {
              error();
            }, false, {
              dataType: 'text'
            });
          } else error();
        }, false, {
          dataType: 'text'
        });
      }
      /**
       * Получить поток
       * @param {*} element
       */


      function getStream(element, call, error) {
        if (element.stream) return call(element);
        var url = element.media.file || '';

        if (startsWith(url, '[')) {
          parseStream(element, call, error, extractItemsPlaylist, url, '');
          return;
        }

        url = component.fixLinkProtocol(url, prefer_http, true);

        if (endsWith(url, '.m3u8')) {
          getStreamM3U(element, call, error, url);
          return;
        }

        if (url) {
          element.stream = component.proxyStream(url, 'fancdn');
          element.qualitys = false;
          element.subtitles = parseSubs(element.media.subtitles, url);
          call(element);
        } else error();
      }

      function parseSubs(str, url) {
        if (!str) return false;
        var subtitles = component.parsePlaylist(str).map(function (item) {
          var link = item.links[0] || '';
          link = component.fixLinkProtocol(link, prefer_http, true);
          return {
            label: item.label,
            url: component.proxyStreamSubs(component.fixLink(link, url), 'fancdn')
          };
        });
        return subtitles.length ? subtitles : false;
      }

      function parse(json, empty) {
        if (json && json.length && json.forEach) {
          component.loading(false);
          extract = json;
          filter();
          append(filtred());
        } else empty();
      }
      /**
       * Построить фильтр
       */


      function filter() {
        filter_items = {
          season: [],
          season_num: [],
          voice: [],
          voice_info: []
        };
        extract.forEach(function (t) {
          if (t.folder) {
            for (var s_num in t.folder) {
              if (filter_items.season_num.indexOf(s_num) == -1) filter_items.season_num.push(s_num);
            }
          }
        });
        filter_items.season_num.sort(function (a, b) {
          return a - b;
        });
        filter_items.season_num.forEach(function (s_num) {
          filter_items.season.push(Lampa.Lang.translate('torrent_serial_season') + ' ' + s_num);
        });
        if (!filter_items.season[choice.season]) choice.season = 0;

        if (filter_items.season[choice.season]) {
          var s_num = filter_items.season_num[choice.season];
          extract.forEach(function (t) {
            if (t.folder && t.folder[s_num]) {
              var v_id = t.id || '';

              if (!filter_items.voice_info.some(function (v) {
                return v.id == v_id;
              })) {
                filter_items.voice.push(t.title || t.comment || '');
                filter_items.voice_info.push({
                  id: v_id
                });
              }
            }
          });
        }

        if (!filter_items.voice[choice.voice]) choice.voice = 0;

        if (choice.voice_name) {
          var inx = filter_items.voice.indexOf(choice.voice_name);
          if (inx == -1) choice.voice = 0;else if (inx !== choice.voice) {
            choice.voice = inx;
          }
        }

        component.filter(filter_items, choice);
      }
      /**
       * Отфильтровать файлы
       * @returns array
       */


      function filtred() {
        var filtred = [];
        extract.forEach(function (data) {
          if (data.folder) {
            var v_info = filter_items.voice_info[choice.voice];

            if (v_info && data.id == v_info.id) {
              var voice = filter_items.voice[choice.voice];
              var s_num = filter_items.season_num[choice.season];
              var s = data.folder[s_num] || {};

              if (s.folder) {
                for (var e_num in s.folder) {
                  var e = s.folder[e_num] || {};

                  if (e.file) {
                    filtred.push({
                      title: component.formatEpisodeTitle(s_num, e_num),
                      quality: '360p ~ 1080p',
                      info: ' / ' + Lampa.Utils.shortText(voice, 50),
                      season: parseInt(s_num),
                      episode: parseInt(e_num),
                      media: e
                    });
                  }
                }
              }
            }
          } else if (data.file) {
            filtred.push({
              title: data.title || data.comment || select_title,
              quality: '360p ~ 1080p',
              info: '',
              media: data
            });
          }
        });
        return filtred;
      }
      /**
       * Показать файлы
       */


      function append(items) {
        component.reset();
        var viewed = Lampa.Storage.cache('online_view', 5000, []);
        var last_episode = component.getLastEpisode(items);
        items.forEach(function (element) {
          if (element.season) {
            element.translate_episode_end = last_episode;
            element.translate_voice = filter_items.voice[choice.voice];
          }

          var hash = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title].join('') : object.movie.original_title);
          var view = component.watchView(element, hash, items);
          var item = Lampa.Template.get('online_mod', element);
          var hash_file = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title, filter_items.voice[choice.voice]].join('') : object.movie.original_title + element.title);
          element.timeline = view;
          item.append(Lampa.Timeline.render(view));

          if (Lampa.Timeline.details) {
            item.find('.online__quality').append(Lampa.Timeline.details(view, ' / '));
          }

          if (viewed.indexOf(hash_file) !== -1) item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
          item.on('hover:enter', function () {
            if (element.loading) return;
            if (object.movie.id) Lampa.Favorite.add('history', object.movie, 100);
            element.loading = true;
            getStream(element, function (element) {
              element.loading = false;
              var first = {
                url: component.getDefaultQuality(element.qualitys, element.stream),
                quality: component.renameQualityMap(element.qualitys),
                subtitles: element.subtitles,
                timeline: element.timeline,
                title: element.season ? element.title : select_title + (element.title == select_title ? '' : ' / ' + element.title)
              };

              if (element.season && Lampa.Platform.version) {
                var playlist = [];
                items.forEach(function (elem) {
                  if (elem == element) {
                    playlist.push(first);
                  } else {
                    var cell = {
                      url: function url(call) {
                        getStream(elem, function (elem) {
                          cell.url = component.getDefaultQuality(elem.qualitys, elem.stream);
                          cell.quality = component.renameQualityMap(elem.qualitys);
                          cell.subtitles = elem.subtitles;
                          call();
                        }, function () {
                          cell.url = '';
                          call();
                        });
                      },
                      timeline: elem.timeline,
                      title: elem.title
                    };
                    playlist.push(cell);
                  }
                });
                playWithoutPreroll(first, playlist);
              } else {
                playWithoutPreroll(first, [first]);
              }

              if (viewed.indexOf(hash_file) == -1) {
                viewed.push(hash_file);
                item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
                Lampa.Storage.set('online_view', viewed);
              }
            }, function () {
              element.loading = false;
              Lampa.Noty.show(Lampa.Lang.translate('online_mod_nolink'));
            });
          });
          component.append(item);
          component.contextmenu({
            item: item,
            view: view,
            viewed: viewed,
            hash_file: hash_file,
            element: element,
            file: function file(call) {
              getStream(element, function (element) {
                call({
                  file: element.stream,
                  quality: element.qualitys
                });
              }, function () {
                Lampa.Noty.show(Lampa.Lang.translate('online_mod_nolink'));
              });
            }
          });
        });
        component.start(true);
      }
    }

    var network$1 = new Lampa.Reguest();

    function fancdnFillCookie(success, error) {
      var prox = Utils.proxy('fancdn');
      var prox_enc = '';
      var returnHeaders = Lampa.Platform.is('android') && Utils.checkAndroidVersion(339);

      if (!prox && !returnHeaders) {
        if (error) error();
        return;
      }

      var host = Utils.fanserialsHost();
      var user_agent = Utils.baseUserAgent();
      var headers = Lampa.Platform.is('android') ? {
        'User-Agent': user_agent
      } : {};

      if (prox) {
        prox_enc += 'param/User-Agent=' + encodeURIComponent(user_agent) + '/';
        prox_enc += 'cookie_plus/param/Cookie=/';
        returnHeaders = false;
      }

      var url = host + '/';
      var postdata = 'login_name=' + encodeURIComponent(Lampa.Storage.get('online_mod_fancdn_name', ''));
      postdata += '&login_password=' + encodeURIComponent(Lampa.Storage.get('online_mod_fancdn_password', ''));
      postdata += '&login=submit';
      network$1.clear();
      network$1.timeout(8000);
      network$1["native"](Utils.proxyLink(url, prox, prox_enc, 'enc2t'), function (str) {
        var cookie = '';
        var values = {};
        var sid = '';
        var json = typeof str === 'string' ? Lampa.Arrays.decodeJson(str, {}) : str;
        var body = (json && json.body || '').replace(/\n/g, '');
        var error_form = body.match(/(<div class="berrors-inner">[^<]*<b class="berrors-title">[^<]*<\/b>[^<]*<\/div>)/);

        if (error_form) {
          Lampa.Noty.show(error_form[0]);
          if (error) error();
          return;
        }

        var cookieHeaders = json && json.headers && json.headers['set-cookie'] || null;

        if (cookieHeaders && cookieHeaders.forEach) {
          cookieHeaders.forEach(function (param) {
            var parts = param.split(';')[0].split('=');

            if (parts[0]) {
              if (parts[1] === 'deleted') delete values[parts[0]];else values[parts[0]] = parts[1] || '';
            }
          });
          sid = values['PHPSESSID'];
          delete values['PHPSESSID'];
          var cookies = [];

          for (var name in values) {
            cookies.push(name + '=' + values[name]);
          }

          cookie = cookies.join('; ');
        }

        if (cookie) {
          Lampa.Storage.set('online_mod_fancdn_cookie', cookie);
          if (cookie.indexOf('PHPSESSID=') == -1) cookie = 'PHPSESSID=' + (sid || Utils.randomHex(32)) + (cookie ? '; ' + cookie : '');
          var prox_enc2 = prox_enc;

          if (prox) {
            prox_enc2 += 'param/Cookie=' + encodeURIComponent(cookie) + '/';
          } else {
            headers['Cookie'] = cookie;
          }

          network$1.clear();
          network$1.timeout(8000);
          network$1["native"](Utils.proxyLink(host + '/', prox, prox_enc2, 'enc2t'), function (str) {
            var json = typeof str === 'string' ? Lampa.Arrays.decodeJson(str, {}) : str;
            var body = (json && json.body || '').replace(/\n/g, '');
            var error_form = body.match(/(<div class="berrors-inner">[^<]*<b class="berrors-title">[^<]*<\/b>[^<]*<\/div>)/);

            if (error_form) {
              Lampa.Noty.show(error_form[0]);
              if (error) error();
              return;
            }

            var cookieHeaders = json && json.headers && json.headers['set-cookie'] || null;

            if (cookieHeaders && cookieHeaders.forEach) {
              cookieHeaders.forEach(function (param) {
                var parts = param.split(';')[0].split('=');

                if (parts[0]) {
                  if (parts[1] === 'deleted') delete values[parts[0]];else values[parts[0]] = parts[1] || '';
                }
              });
              delete values['PHPSESSID'];
              var _cookies = [];

              for (var _name in values) {
                if (!startsWith(_name, "__")) _cookies.push(_name + '=' + values[_name]);
              }

              cookie = _cookies.join('; ');
              if (cookie) Lampa.Storage.set('online_mod_fancdn_cookie', cookie);
            }

            if (success) success();
          }, function (a, c) {
            if (success) success();
          }, false, {
            dataType: 'text',
            headers: headers,
            returnHeaders: returnHeaders
          });
        } else {
          if (error) error();
        }
      }, function (a, c) {
        Lampa.Noty.show(network$1.errorDecode(a, c));
        if (error) error();
      }, postdata, {
        dataType: 'text',
        headers: headers,
        returnHeaders: returnHeaders
      });
    }

    fancdn.initSettings = function (show_all) {
      var balanser_name = 'FanCDN';
      var component_name = 'online_mod_fancdn';
      if (Lampa.SettingsApi.getComponent(component_name)) return;

      {
        var icon = "<svg><use xlink:href=\"#sprite-settings\"></use></svg>";
        Lampa.SettingsApi.addComponent({
          component: component_name,
          icon: icon,
          name: balanser_name
        });
        Lampa.SettingsApi.addParam({
          component: 'online_mod',
          param: {
            name: component_name + '_settings',
            type: 'button'
          },
          field: {
            name: "<div class=\"settings-folder\" style=\"padding:0!important\"><div style=\"width:1.8em;height:1.3em;padding-right:.5em\">".concat(icon, "</div><div style=\"font-size:1.3em\">").concat(balanser_name, "</div></div>")
          },
          onChange: function onChange() {
            Lampa.Settings.create(component_name, {
              onBack: function onBack() {
                Lampa.Settings.create('online_mod');
              }
            });
          }
        });
      }

      {
        Lampa.SettingsApi.addParam({
          component: component_name,
          param: {
            name: 'online_mod_proxy_fancdn',
            type: 'trigger',
            "default": false
          },
          field: {
            name: Lampa.Lang.translate('online_mod_proxy_balanser') + ' ' + balanser_name
          }
        });
        Lampa.SettingsApi.addParam({
          component: component_name,
          param: {
            name: 'online_mod_fancdn_name',
            placeholder: Lampa.Lang.translate('settings_cub_not_specified'),
            type: 'input',
            values: '',
            "default": ''
          },
          field: {
            name: Lampa.Lang.translate('online_mod_fancdn_name')
          }
        });
        Lampa.SettingsApi.addParam({
          component: component_name,
          param: {
            name: 'online_mod_fancdn_password',
            placeholder: Lampa.Lang.translate('settings_cub_not_specified'),
            type: 'input',
            values: '',
            "default": ''
          },
          field: {
            name: Lampa.Lang.translate('online_mod_fancdn_password')
          }
        });
        var fancdn_cookie = {};
        Lampa.SettingsApi.addParam({
          component: component_name,
          param: {
            name: 'online_mod_fancdn_cookie',
            placeholder: Lampa.Lang.translate('settings_cub_not_specified'),
            type: 'input',
            values: '',
            "default": ''
          },
          field: {
            name: Lampa.Lang.translate('online_mod_fancdn_cookie')
          },
          onRender: function onRender(item) {
            fancdn_cookie = item;
          }
        });
        var fancdn_fill_cookie = {};
        Lampa.SettingsApi.addParam({
          component: component_name,
          param: {
            name: 'online_mod_fancdn_fill_cookie',
            type: 'button'
          },
          field: {
            name: Lampa.Lang.translate('online_mod_fancdn_fill_cookie')
          },
          onRender: function onRender(item) {
            fancdn_fill_cookie = item;
            item.append("<div class=\"settings-param__status\"></div>");
          },
          onChange: function onChange() {
            var fancdn_fill_cookie_status = $('.settings-param__status', fancdn_fill_cookie).removeClass('active error wait').addClass('wait');
            fancdnFillCookie(function () {
              fancdn_fill_cookie_status.removeClass('active error wait').addClass('active');
              Lampa.Params.update(fancdn_cookie, [], null);
            }, function () {
              fancdn_fill_cookie_status.removeClass('active error wait').addClass('error');
              Lampa.Params.update(fancdn_cookie, [], null);
            });
          }
        });
      }
    };

    fancdn.hideSettings = function (body) {
      $('[data-component="online_mod_fancdn"]', body).hide();
    };

    function fancdn2(component, _object, config) {
      var network = new Lampa.Reguest();
      var extract = [];
      var object = _object;
      var select_title = '';
      var prefer_http = Lampa.Storage.field('online_mod_prefer_http') === true;
      var prox = component.proxy('fancdn2');
      var host = Utils.fancdnHost();
      var ref = host + '/';
      var user_agent = Utils.baseUserAgent();
      var embed = host + atob('L2ZpbG0ucGhw');
      var filter_items = {};
      var choice = {
        season: 0,
        voice: 0,
        voice_name: ''
      };

      function fancdn_api_search(kinopoisk_id, callback, error) {
        var url = Lampa.Utils.addUrlComponent(embed, 'kp=' + encodeURIComponent(kinopoisk_id));
        var player_ref = component.fixLink('/movies/' + kinopoisk_id, ref);
        var token = Lampa.Storage.get('online_mod_fancdn_token', '') + '';

        if (token) {
          url += '&' + token;
          player_ref += '?' + token;
        }

        var headers = Lampa.Platform.is('android') ? {
          'Origin': host,
          'Referer': player_ref,
          'User-Agent': user_agent
        } : {};
        var prox_enc = '';

        if (prox) {
          prox_enc += 'param/Origin=' + encodeURIComponent(host) + '/';
          prox_enc += 'param/Referer=' + encodeURIComponent(player_ref) + '/';
          prox_enc += 'param/User-Agent=' + encodeURIComponent(user_agent) + '/';
        }

        network.clear();
        network.timeout(10000);
        network["native"](component.proxyLink(url, prox, prox_enc, 'enc2t'), function (json) {
          if (callback) callback(json);
        }, function (a, c) {
          if (error) error(network.errorDecode(a, c));
        }, false, {
          headers: headers
        });
      }
      /**
       * Начать поиск
       * @param {Object} _object
       * @param {String} kinopoisk_id
       */


      this.search = function (_object, kinopoisk_id) {
        object = _object;
        select_title = object.search || object.movie.title;

        if (isNaN(kinopoisk_id)) {
          component.emptyForQuery(select_title);
          return;
        }

        var error = component.empty.bind(component);
        fancdn_api_search(kinopoisk_id, function (json) {
          parse(json, function () {
            component.emptyForQuery(select_title);
          });
        }, error);
      };

      this.extendChoice = function (saved) {
        Lampa.Arrays.extend(choice, saved, true);
      };
      /**
       * Сброс фильтра
       */


      this.reset = function () {
        component.reset();
        choice = {
          season: 0,
          voice: 0,
          voice_name: ''
        };
        filter();
        append(filtred());
        component.saveChoice(choice);
      };
      /**
       * Применить фильтр
       * @param {*} type
       * @param {*} a
       * @param {*} b
       */


      this.filter = function (type, a, b) {
        choice[a.stype] = b.index;
        if (a.stype == 'voice') choice.voice_name = filter_items.voice[b.index];
        component.reset();
        filter();
        append(filtred());
        component.saveChoice(choice);
      };
      /**
       * Уничтожить
       */


      this.destroy = function () {
        network.clear();
        extract = null;
      };
      /**
       * Получить потоки
       * @param {String} str
       * @returns array
       */


      function extractItems(str, url) {
        if (!str) return [];

        try {
          var items = component.parseM3U(str).map(function (item) {
            var link = item.link;
            var quality = item.height;
            var alt_quality = link.match(/\b(\d\d\d+)\./);

            if (alt_quality) {
              var alt_height = parseInt(alt_quality[1]);
              if (alt_height > quality && alt_height <= 4320) quality = alt_height;
            }

            return {
              label: quality ? quality + 'p' : '360p ~ 1080p',
              quality: quality,
              file: component.proxyStream(component.fixLink(link, url), 'fancdn')
            };
          });
          items.sort(function (a, b) {
            if (b.quality > a.quality) return 1;
            if (b.quality < a.quality) return -1;
            if (b.label > a.label) return 1;
            if (b.label < a.label) return -1;
            return 0;
          });
          return items;
        } catch (e) {}

        return [];
      }
      /**
       * Получить потоки
       * @param {String} str
       * @returns array
       */


      function extractItemsPlaylist(str, url) {
        if (!str) return [];

        try {
          var items = component.parsePlaylist(str).map(function (item) {
            var quality = item.label.match(/(\d\d\d+)/);
            var link = item.links[0] || '';
            link = component.fixLinkProtocol(link, prefer_http, true);
            return {
              label: item.label,
              quality: quality ? parseInt(quality[1]) : NaN,
              file: component.proxyStream(link, 'fancdn')
            };
          });
          items.sort(function (a, b) {
            if (b.quality > a.quality) return 1;
            if (b.quality < a.quality) return -1;
            if (b.label > a.label) return 1;
            if (b.label < a.label) return -1;
            return 0;
          });
          return items;
        } catch (e) {}

        return [];
      }
      /**
       * Получить поток
       * @param {*} element
       */


      function parseStream(element, call, error, itemsExtractor, str, url) {
        var file = '';
        var quality = false;
        var items = itemsExtractor(str, url);

        if (items && items.length) {
          file = items[0].file;
          quality = {};
          items.forEach(function (item) {
            quality[item.label] = item.file;
          });
        }

        if (file) {
          element.stream = file;
          element.qualitys = quality;
          element.subtitles = parseSubs(element.media.subtitles, url);
          call(element);
        } else error();
      }
      /**
       * Получить поток
       * @param {*} element
       */


      function getStreamM3U(element, call, error, file) {
        file = file.replace(/\.mp4:hls:manifest/, '');
        var hls_file = file.replace(/\/\d\d\d+([^\/]*\.m3u8)$/, '/hls$1');
        network.clear();
        network.timeout(5000);
        network["native"](component.proxyStream(hls_file, 'fancdn'), function (str) {
          parseStream(element, call, error, extractItems, str, hls_file);
        }, function (a, c) {
          if (file != hls_file) {
            network.clear();
            network.timeout(5000);
            network["native"](component.proxyStream(file, 'fancdn'), function (str) {
              parseStream(element, call, error, extractItems, str, file);
            }, function (a, c) {
              error();
            }, false, {
              dataType: 'text'
            });
          } else error();
        }, false, {
          dataType: 'text'
        });
      }
      /**
       * Получить поток
       * @param {*} element
       */


      function getStream(element, call, error) {
        if (element.stream) return call(element);
        var url = element.media.file || '';

        if (startsWith(url, '[')) {
          parseStream(element, call, error, extractItemsPlaylist, url, '');
          return;
        }

        url = component.fixLinkProtocol(url, prefer_http, true);

        if (endsWith(url, '.m3u8')) {
          getStreamM3U(element, call, error, url);
          return;
        }

        if (url) {
          element.stream = component.proxyStream(url, 'fancdn');
          element.qualitys = false;
          element.subtitles = parseSubs(element.media.subtitles, url);
          call(element);
        } else error();
      }

      function parseSubs(str, url) {
        if (!str) return false;
        var subtitles = component.parsePlaylist(str).map(function (item) {
          var link = item.links[0] || '';
          link = component.fixLinkProtocol(link, prefer_http, true);
          return {
            label: item.label,
            url: component.proxyStreamSubs(component.fixLink(link, url), 'fancdn')
          };
        });
        return subtitles.length ? subtitles : false;
      }

      function parse(json, empty) {
        if (json && json.length && json.forEach) {
          component.loading(false);
          extract = json;
          filter();
          append(filtred());
        } else empty();
      }
      /**
       * Построить фильтр
       */


      function filter() {
        filter_items = {
          season: [],
          season_num: [],
          voice: [],
          voice_info: []
        };
        extract.forEach(function (t) {
          if (t.folder) {
            for (var s_num in t.folder) {
              if (filter_items.season_num.indexOf(s_num) == -1) filter_items.season_num.push(s_num);
            }
          }
        });
        filter_items.season_num.sort(function (a, b) {
          return a - b;
        });
        filter_items.season_num.forEach(function (s_num) {
          filter_items.season.push(Lampa.Lang.translate('torrent_serial_season') + ' ' + s_num);
        });
        if (!filter_items.season[choice.season]) choice.season = 0;

        if (filter_items.season[choice.season]) {
          var s_num = filter_items.season_num[choice.season];
          extract.forEach(function (t) {
            if (t.folder && t.folder[s_num]) {
              var v_id = t.id || '';

              if (!filter_items.voice_info.some(function (v) {
                return v.id == v_id;
              })) {
                filter_items.voice.push(t.title || t.comment || '');
                filter_items.voice_info.push({
                  id: v_id
                });
              }
            }
          });
        }

        if (!filter_items.voice[choice.voice]) choice.voice = 0;

        if (choice.voice_name) {
          var inx = filter_items.voice.indexOf(choice.voice_name);
          if (inx == -1) choice.voice = 0;else if (inx !== choice.voice) {
            choice.voice = inx;
          }
        }

        component.filter(filter_items, choice);
      }
      /**
       * Отфильтровать файлы
       * @returns array
       */


      function filtred() {
        var filtred = [];
        extract.forEach(function (data) {
          if (data.folder) {
            var v_info = filter_items.voice_info[choice.voice];

            if (v_info && data.id == v_info.id) {
              var voice = filter_items.voice[choice.voice];
              var s_num = filter_items.season_num[choice.season];
              var s = data.folder[s_num] || {};

              if (s.folder) {
                for (var e_num in s.folder) {
                  var e = s.folder[e_num] || {};

                  if (e.file) {
                    filtred.push({
                      title: component.formatEpisodeTitle(s_num, e_num),
                      quality: '360p ~ 1080p',
                      info: ' / ' + Lampa.Utils.shortText(voice, 50),
                      season: parseInt(s_num),
                      episode: parseInt(e_num),
                      media: e
                    });
                  }
                }
              }
            }
          } else if (data.file) {
            filtred.push({
              title: data.title || data.comment || select_title,
              quality: '360p ~ 1080p',
              info: '',
              media: data
            });
          }
        });
        return filtred;
      }
      /**
       * Показать файлы
       */


      function append(items) {
        component.reset();
        var viewed = Lampa.Storage.cache('online_view', 5000, []);
        var last_episode = component.getLastEpisode(items);
        items.forEach(function (element) {
          if (element.season) {
            element.translate_episode_end = last_episode;
            element.translate_voice = filter_items.voice[choice.voice];
          }

          var hash = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title].join('') : object.movie.original_title);
          var view = component.watchView(element, hash, items);
          var item = Lampa.Template.get('online_mod', element);
          var hash_file = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title, filter_items.voice[choice.voice]].join('') : object.movie.original_title + element.title);
          element.timeline = view;
          item.append(Lampa.Timeline.render(view));

          if (Lampa.Timeline.details) {
            item.find('.online__quality').append(Lampa.Timeline.details(view, ' / '));
          }

          if (viewed.indexOf(hash_file) !== -1) item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
          item.on('hover:enter', function () {
            if (element.loading) return;
            if (object.movie.id) Lampa.Favorite.add('history', object.movie, 100);
            element.loading = true;
            getStream(element, function (element) {
              element.loading = false;
              var first = {
                url: component.getDefaultQuality(element.qualitys, element.stream),
                quality: component.renameQualityMap(element.qualitys),
                subtitles: element.subtitles,
                timeline: element.timeline,
                title: element.season ? element.title : select_title + (element.title == select_title ? '' : ' / ' + element.title)
              };

              if (element.season && Lampa.Platform.version) {
                var playlist = [];
                items.forEach(function (elem) {
                  if (elem == element) {
                    playlist.push(first);
                  } else {
                    var cell = {
                      url: function url(call) {
                        getStream(elem, function (elem) {
                          cell.url = component.getDefaultQuality(elem.qualitys, elem.stream);
                          cell.quality = component.renameQualityMap(elem.qualitys);
                          cell.subtitles = elem.subtitles;
                          call();
                        }, function () {
                          cell.url = '';
                          call();
                        });
                      },
                      timeline: elem.timeline,
                      title: elem.title
                    };
                    playlist.push(cell);
                  }
                });
                playWithoutPreroll(first, playlist);
              } else {
                playWithoutPreroll(first, [first]);
              }

              if (viewed.indexOf(hash_file) == -1) {
                viewed.push(hash_file);
                item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
                Lampa.Storage.set('online_view', viewed);
              }
            }, function () {
              element.loading = false;
              Lampa.Noty.show(Lampa.Lang.translate('online_mod_nolink'));
            });
          });
          component.append(item);
          component.contextmenu({
            item: item,
            view: view,
            viewed: viewed,
            hash_file: hash_file,
            element: element,
            file: function file(call) {
              getStream(element, function (element) {
                call({
                  file: element.stream,
                  quality: element.qualitys
                });
              }, function () {
                Lampa.Noty.show(Lampa.Lang.translate('online_mod_nolink'));
              });
            }
          });
        });
        component.start(true);
      }
    }

    fancdn2.initSettings = function (show_all) {
      var balanser_name = 'FanCDN (ID)';
      var component_name = 'online_mod_proxy_fancdn2';
      if (Lampa.SettingsApi.getComponent(component_name)) return;

      {
        var icon = "<svg><use xlink:href=\"#sprite-settings\"></use></svg>";
        Lampa.SettingsApi.addComponent({
          component: component_name,
          icon: icon,
          name: balanser_name
        });
        Lampa.SettingsApi.addParam({
          component: 'online_mod',
          param: {
            name: component_name + '_settings',
            type: 'button'
          },
          field: {
            name: "<div class=\"settings-folder\" style=\"padding:0!important\"><div style=\"width:1.8em;height:1.3em;padding-right:.5em\">".concat(icon, "</div><div style=\"font-size:1.3em\">").concat(balanser_name, "</div></div>")
          },
          onChange: function onChange() {
            Lampa.Settings.create(component_name, {
              onBack: function onBack() {
                Lampa.Settings.create('online_mod');
              }
            });
          }
        });
      }

      {
        Lampa.SettingsApi.addParam({
          component: component_name,
          param: {
            name: 'online_mod_proxy_fancdn2',
            type: 'trigger',
            "default": false
          },
          field: {
            name: Lampa.Lang.translate('online_mod_proxy_balanser') + ' ' + balanser_name
          }
        });
      }
    };

    fancdn2.hideSettings = function (body) {
      $('[data-component="online_mod_proxy_fancdn2"]', body).hide();
    };

    function fanserials(component, _object, config) {
      var network = new Lampa.Reguest();
      var extract = {};
      var object = _object;
      var select_title = '';
      var select_id = '';
      var prefer_http = Lampa.Storage.field('online_mod_prefer_http') === true;
      var prox = component.proxy('fanserials');
      var prox_cdn = component.proxy('fanserials_cdn');
      var host = Utils.decodeSecret([95, 57, 28, 42, 55, 125, 28, 124, 25, 93, 66, 41, 7, 46, 48, 49, 92, 33, 25, 64, 26, 33, 7, 40, 32, 33, 90, 63, 23, 27, 69, 56], atob('RnVja0Zhbg=='));
      var ref = host + '/';
      var user_agent = Utils.baseUserAgent();
      var embed_host = (prefer_http ? 'http:' : 'https:') + atob('Ly9tYWxzZWQuc2l0ZQ==');
      var embed = embed_host + '/';
      var headers = Lampa.Platform.is('android') ? {
        'Origin': host,
        'Referer': ref,
        'User-Agent': user_agent
      } : {};
      var prox_enc = '';

      if (prox) {
        prox_enc += 'param/Origin=' + encodeURIComponent(host) + '/';
        prox_enc += 'param/Referer=' + encodeURIComponent(ref) + '/';
        prox_enc += 'param/User-Agent=' + encodeURIComponent(user_agent) + '/';
      }

      var prox_enc2 = '';

      if (prox) {
        prox_enc2 += 'param/Origin=' + encodeURIComponent(embed_host) + '/';
        prox_enc2 += 'param/Referer=' + encodeURIComponent(embed) + '/';
        prox_enc2 += 'param/User-Agent=' + encodeURIComponent(user_agent) + '/';
        prox_enc2 += 'param/Sec-Fetch-Dest=empty/';
        prox_enc2 += 'param/Sec-Fetch-Mode=cors/';
        prox_enc2 += 'param/Sec-Fetch-Site=same-origin/';
      }

      var filter_items = {};
      var choice = {
        season: 0,
        voice: 0,
        voice_name: ''
      };
      /**
       * Начать поиск
       * @param {Object} _object
       * @param {String} kinopoisk_id
       */

      this.search = function (_object, kinopoisk_id) {
        object = _object;
        select_id = kinopoisk_id;
        select_title = object.search || object.movie.title;

        if (isNaN(select_id)) {
          component.emptyForQuery(select_title);
          return;
        }

        var url = embed + atob('bWV0Lw==') + select_id;
        network.clear();
        network.timeout(10000);
        network["native"](component.proxyLink(url, prox, prox_enc, 'enc2t'), function (str) {
          parse(str);
        }, function (a, c) {
          if (a.status == 404 && (!a.responseText || a.responseText.indexOf('Сериал не найден :(') !== -1) || a.status == 0 && a.statusText !== 'timeout') {
            component.emptyForQuery(select_title);
          } else component.empty(network.errorDecode(a, c));
        }, false, {
          dataType: 'text',
          headers: headers
        });
      };

      this.extendChoice = function (saved) {
        Lampa.Arrays.extend(choice, saved, true);
      };
      /**
       * Сброс фильтра
       */


      this.reset = function () {
        component.reset();
        choice = {
          season: 0,
          voice: 0,
          voice_name: ''
        };
        filter();
        append(filtred());
        component.saveChoice(choice);
      };
      /**
       * Применить фильтр
       * @param {*} type
       * @param {*} a
       * @param {*} b
       */


      this.filter = function (type, a, b) {
        choice[a.stype] = b.index;
        if (a.stype == 'voice') choice.voice_name = filter_items.voice[b.index];
        component.reset();
        filter();
        append(filtred());
        component.saveChoice(choice);
      };
      /**
       * Уничтожить
       */


      this.destroy = function () {
        network.clear();
        extract = null;
      };

      function decode(h) {
        if (!h || 'string' != typeof h) return null;

        try {
          h = h.replace(/-/g, '+').replace(/_/g, '/');

          h = function (h) {
            var t = h.length % 4;
            if (!t) return h;
            var i = h;

            for (var e = t; e < 4; e++) {
              i += '=';
            }

            return i;
          }(h);

          h = atob(h);
          var r = '';
          var i = atob('eHUwdktUTDR3SkJ1VTJqNw==');

          for (var e = 0; e < h.length; e++) {
            var s = h.charCodeAt(e) ^ i.charCodeAt(e % i.length);
            r += String.fromCharCode(s);
          }

          return /^https?:\/\//.test(r) ? r : null;
        } catch (e) {
          return null;
        }
      }
      /**
       * Получить поток
       * @param {*} element
       */


      function parseStream(element, call, error, url, json) {
        var file = '';
        var quality = false;
        var subtitles = [];
        var video = json && json.h && decode(json.h);

        if (video) {
          file = component.fixLink(video, url);

          if (prox && !prox_cdn) {
            file = file.replace(/\/\/cdn(\d+)\./, '//s$1.');
          }
        }

        if (json && json.cc) {
          for (var label in json.cc) {
            var link = json.cc[label];

            if (link) {
              subtitles.push({
                label: label,
                url: component.processSubs(component.fixLink(link, url))
              });
            }
          }
        }

        if (file) {
          element.stream = file;
          element.qualitys = quality;
          element.subtitles = subtitles.length ? subtitles : false;
          call(element);
        } else error();
      }
      /**
       * Получить поток
       * @param {*} element
       */


      function getBaseStream(element, call, error) {
        if (element.stream) return call(element);
        var url = embed + atob('dmlkZW9zLnBocA==');
        url = Lampa.Utils.addUrlComponent(url, 'id=' + element.media.video_id);
        network.clear();
        network.timeout(10000);
        network["native"](component.proxyLink(url, prox, prox_enc, 'enc2t'), function (json) {
          parseStream(element, call, error, url, json);
        }, function (a, c) {
          error();
        }, false, {
          headers: headers
        });
      }
      /**
       * Получить поток
       * @param {*} element
       */


      function getStream(element, call, error) {
        getBaseStream(element, function (element) {
          var file = element.stream || '';
          if (element.qualitys || element.parsed || !endsWith(file, '.m3u8')) return call(element);
          network.clear();
          network.timeout(10000);
          network["native"](component.proxyLink(file, prox_cdn, prox_enc2, 'enc2t'), function (str) {
            var items = extractQuality(str, file);
            items = items.filter(function (elem) {
              return elem.quality > 0;
            });

            if (items.length) {
              file = items[0].file;
              var quality = {};
              items.forEach(function (item) {
                if (!quality[item.label]) quality[item.label] = item.file;
              });
              element.stream = file;
              element.qualitys = quality;
            }

            element.parsed = true;
            call(element);
          }, function (a, c) {
            call(element);
          }, false, {
            dataType: 'text'
          });
        }, error);
      }

      function extractQuality(str, url) {
        if (!str) return [];

        try {
          var items = component.parseM3U(str).filter(function (item) {
            return item.xstream;
          }).map(function (item) {
            var link = item.link;
            var quality = item.height;
            if (quality > 1440 && quality <= 2160) quality = 2160;else if (quality > 1080 && quality <= 1440) quality = 1440;else if (quality > 720 && quality <= 1080) quality = 1080;else if (quality > 480 && quality <= 720) quality = 720;else if (quality > 360 && quality <= 480) quality = 480;else if (quality > 240 && quality <= 360) quality = 360;
            return {
              label: quality ? quality + 'p' : '360p ~ 1080p',
              quality: quality,
              bandwidth: item.bandwidth,
              codecs: item.codecs,
              file: component.fixLink(link, url)
            };
          });
          items.sort(function (a, b) {
            if (b.quality > a.quality) return 1;
            if (b.quality < a.quality) return -1;
            if (b.bandwidth > a.bandwidth) return 1;
            if (b.bandwidth < a.bandwidth) return -1;
            if (b.label > a.label) return 1;
            if (b.label < a.label) return -1;
            return 0;
          });
          return items;
        } catch (e) {}

        return [];
      }

      function parse(str) {
        component.loading(false);
        str = (str || '').replace(/\n/g, '');
        var find = str.match(/window\.playerData\s*=\s*(\{.*?\});/);
        var json;

        try {
          json = find && Lampa.Arrays.decodeJson(find[1], {});
        } catch (e) {}

        var data = extractData(json);

        if (data) {
          extract = data;
          filter();
          append(filtred());
        } else {
          find = str.match(/>(Контент недоступен в вашем регионе[^<]*)</);
          if (find) component.empty(find[1]);else component.emptyForQuery(select_title);
        }
      }

      function extractData(json) {
        if (!(json && json.playlist && json.playlist.serial && json.playlist.serial.list && json.playlist.serial.list.length && json.playlist.serial.list.forEach)) return null;
        var voices = json.voices || {};
        var data = {};
        var s_index = json.playlist.current && json.playlist.current.startSeason || 1;
        json.playlist.serial.list.forEach(function (episodes) {
          var s_num = '' + s_index++;

          if (episodes && episodes.forEach) {
            var e_index = 1;
            var spe_index = 1;
            episodes.forEach(function (episode) {
              var spec_ep = episode && episode.spec_ep || 0;
              var e_num = spec_ep ? 'sp' + spe_index++ : '' + e_index++;

              if (episode && episode.voices && episode.voices.forEach) {
                if (episode.num != null) e_num = (spec_ep ? 'sp' : '') + episode.num;
                episode.voices.forEach(function (voice) {
                  if (!data[s_num]) data[s_num] = {};
                  if (!data[s_num][e_num]) data[s_num][e_num] = [];
                  data[s_num][e_num].push({
                    video_id: voice.video_id != null ? voice.video_id + '' : '',
                    voice_id: voice.voice_id != null ? voice.voice_id + '' : '',
                    voice_name: voice.voice_id != null ? voices[voice.voice_id] || 'voice ' + voice.voice_id : ''
                  });
                });
              }
            });
          }
        });
        return data;
      }
      /**
       * Построить фильтр
       */


      function filter() {
        filter_items = {
          season: [],
          season_num: [],
          voice: [],
          voice_info: []
        };

        for (var s_num in extract) {
          if (filter_items.season_num.indexOf(s_num) == -1) filter_items.season_num.push(s_num);
        }

        filter_items.season_num.sort(function (a, b) {
          return a - b;
        });
        filter_items.season_num.forEach(function (s_num) {
          filter_items.season.push(Lampa.Lang.translate('torrent_serial_season') + ' ' + s_num);
        });
        if (!filter_items.season[choice.season]) choice.season = 0;

        if (filter_items.season[choice.season]) {
          var _s_num = filter_items.season_num[choice.season];
          var episodes = extract[_s_num] || {};

          for (var e_num in episodes) {
            var translations = episodes[e_num] || [];
            translations.forEach(function (translation) {
              var v_id = translation.voice_id || '';

              if (!filter_items.voice_info.some(function (v) {
                return v.id == v_id;
              })) {
                filter_items.voice.push(translation.voice_name || '');
                filter_items.voice_info.push({
                  id: v_id
                });
              }
            });
          }
        }

        if (!filter_items.voice[choice.voice]) choice.voice = 0;

        if (choice.voice_name) {
          var inx = filter_items.voice.indexOf(choice.voice_name);
          if (inx == -1) choice.voice = 0;else if (inx !== choice.voice) {
            choice.voice = inx;
          }
        }

        component.filter(filter_items, choice);
      }
      /**
       * Отфильтровать файлы
       * @returns array
       */


      function filtred() {
        var filtred = [];

        if (filter_items.season[choice.season] && filter_items.voice_info[choice.voice]) {
          (function () {
            var s_num = filter_items.season_num[choice.season];
            var v_id = filter_items.voice_info[choice.voice].id;
            var voice = filter_items.voice[choice.voice];
            var episodes = extract[s_num] || {};

            var _loop = function _loop(e_num) {
              var translations = episodes[e_num] || [];
              translations.forEach(function (translation) {
                if (translation.voice_id == v_id) {
                  filtred.push({
                    title: component.formatEpisodeTitle(s_num, e_num),
                    quality: '360p ~ 1080p',
                    info: ' / ' + Lampa.Utils.shortText(voice, 50),
                    season: s_num,
                    episode: e_num,
                    media: translation
                  });
                }
              });
            };

            for (var e_num in episodes) {
              _loop(e_num);
            }
          })();
        }

        return filtred;
      }
      /**
       * Показать файлы
       */


      function append(items) {
        component.reset();
        var viewed = Lampa.Storage.cache('online_view', 5000, []);
        var last_episode = component.getLastEpisode(items);
        items.forEach(function (element) {
          if (element.season) {
            element.translate_episode_end = last_episode;
            element.translate_voice = filter_items.voice[choice.voice];
          }

          var hash = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title].join('') : object.movie.original_title);
          var view = component.watchView(element, hash, items);
          var item = Lampa.Template.get('online_mod', element);
          var hash_file = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title, filter_items.voice[choice.voice]].join('') : object.movie.original_title + element.title);
          element.timeline = view;
          item.append(Lampa.Timeline.render(view));

          if (Lampa.Timeline.details) {
            item.find('.online__quality').append(Lampa.Timeline.details(view, ' / '));
          }

          if (viewed.indexOf(hash_file) !== -1) item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
          item.on('hover:enter', function () {
            if (element.loading) return;
            if (object.movie.id) Lampa.Favorite.add('history', object.movie, 100);
            element.loading = true;
            getStream(element, function (element) {
              element.loading = false;
              var first = {
                anime_skip: skipOf(element),
                url: component.getDefaultQuality(element.qualitys, element.stream),
                quality: component.renameQualityMap(element.qualitys),
                subtitles: element.subtitles,
                timeline: element.timeline,
                title: element.season ? element.title : select_title + (element.title == select_title ? '' : ' / ' + element.title)
              };

              if (element.season && Lampa.Platform.version) {
                var playlist = [];
                items.forEach(function (elem) {
                  if (elem == element) {
                    playlist.push(first);
                  } else {
                    var cell = {
                      anime_skip: skipOf(elem),
                      url: function url(call) {
                        getStream(elem, function (elem) {
                          cell.url = component.getDefaultQuality(elem.qualitys, elem.stream);
                          cell.quality = component.renameQualityMap(elem.qualitys);
                          cell.subtitles = elem.subtitles;
                          call();
                        }, function () {
                          cell.url = '';
                          call();
                        });
                      },
                      timeline: elem.timeline,
                      title: elem.title
                    };
                    playlist.push(cell);
                  }
                });
                playWithoutPreroll(first, playlist);
              } else {
                playWithoutPreroll(first, [first]);
              }

              if (viewed.indexOf(hash_file) == -1) {
                viewed.push(hash_file);
                item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
                Lampa.Storage.set('online_view', viewed);
              }
            }, function () {
              element.loading = false;
              Lampa.Noty.show(Lampa.Lang.translate('online_mod_nolink'));
            });
          });
          component.append(item);
          component.contextmenu({
            item: item,
            view: view,
            viewed: viewed,
            hash_file: hash_file,
            element: element,
            file: function file(call) {
              getStream(element, function (element) {
                call({
                  file: element.stream,
                  quality: element.qualitys
                });
              }, function () {
                Lampa.Noty.show(Lampa.Lang.translate('online_mod_nolink'));
              });
            }
          });
        });
        component.start(true);
      }
    }

    fanserials.initSettings = function (show_all) {
      var balanser_name = 'FanSerials';
      var component_name = 'online_mod_fanserials';
      if (Lampa.SettingsApi.getComponent(component_name)) return;

      {
        var icon = "<svg><use xlink:href=\"#sprite-settings\"></use></svg>";
        Lampa.SettingsApi.addComponent({
          component: component_name,
          icon: icon,
          name: balanser_name
        });
        Lampa.SettingsApi.addParam({
          component: 'online_mod',
          param: {
            name: component_name + '_settings',
            type: 'button'
          },
          field: {
            name: "<div class=\"settings-folder\" style=\"padding:0!important\"><div style=\"width:1.8em;height:1.3em;padding-right:.5em\">".concat(icon, "</div><div style=\"font-size:1.3em\">").concat(balanser_name, "</div></div>")
          },
          onChange: function onChange() {
            Lampa.Settings.create(component_name, {
              onBack: function onBack() {
                Lampa.Settings.create('online_mod');
              }
            });
          }
        });
      }

      if (show_all) {
        Lampa.SettingsApi.addParam({
          component: component_name,
          param: {
            name: 'online_mod_proxy_fanserials',
            type: 'trigger',
            "default": false
          },
          field: {
            name: Lampa.Lang.translate('online_mod_proxy_balanser') + ' ' + balanser_name
          }
        });
        Lampa.SettingsApi.addParam({
          component: component_name,
          param: {
            name: 'online_mod_proxy_fanserials_cdn',
            type: 'trigger',
            "default": false
          },
          field: {
            name: Lampa.Lang.translate('online_mod_proxy_balanser') + ' FanSerials CDN'
          }
        });
      }
    };

    fanserials.hideSettings = function (body) {
      $('[data-component="online_mod_fanserials"]', body).hide();
    };

    function videoseed(component, _object, config) {
      var network = new Lampa.Reguest();
      var extract = {};
      var object = _object;
      var select_title = '';
      var prox = component.proxy('videoseed');
      var host = atob('aHR0cHM6Ly9raW5vc2VyaWFscy5uZXQ=');
      var ref = host + '/';
      var user_agent = Utils.baseUserAgent();
      var embed = atob('aHR0cHM6Ly9hcGkudmlkZW9zZWVkLnR2L2FwaXYyLnBocA==');
      var suffix = Utils.decodeSecret([56, 36, 14, 19, 12, 7, 35, 22, 22, 58, 127, 45, 82, 19, 83, 10, 118, 70, 66, 57, 121, 124, 93, 71, 0, 12, 126, 20, 64, 109, 122, 47, 3, 68, 80, 9, 34, 71]);
      var headers = Lampa.Platform.is('android') ? {
        'Origin': host,
        'Referer': ref,
        'User-Agent': user_agent
      } : {};
      var prox_enc = '';

      if (prox) {
        prox_enc += 'param/Origin=' + encodeURIComponent(host) + '/';
        prox_enc += 'param/Referer=' + encodeURIComponent(ref) + '/';
        prox_enc += 'param/User-Agent=' + encodeURIComponent(user_agent) + '/';
      }

      var filter_items = {};
      var choice = {
        season: 0,
        voice: 0,
        voice_name: ''
      };
      /**
       * Начать поиск
       * @param {Object} _object
       * @param {String} kinopoisk_id
       */

      this.search = function (_object, kinopoisk_id) {
        object = _object;
        select_title = object.search || object.movie.title;

        if (isNaN(kinopoisk_id)) {
          component.emptyForQuery(select_title);
          return;
        }

        var empty = function empty() {
          component.emptyForQuery(select_title);
        };

        var error = component.empty.bind(component);
        var api = embed;
        api = Lampa.Utils.addUrlComponent(api, 'item=' + (object.movie.number_of_seasons ? 'serial' : 'movie'));
        api = Lampa.Utils.addUrlComponent(api, 'kp=' + encodeURIComponent(kinopoisk_id));
        api = Lampa.Utils.addUrlComponent(api, suffix);
        network.clear();
        network.timeout(10000);
        network["native"](component.proxyLink(api, prox, prox_enc, 'enc2t'), function (json) {
          if (json && json.data && json.data[0] && json.data[0].iframe) {
            var url = host + Utils.parseURL(json.data[0].iframe).pathname;
            url = Lampa.Utils.addUrlComponent(url, 'token=' + Utils.randomHex(32));
            network.clear();
            network.timeout(10000);
            network["native"](component.proxyLink(url, prox, prox_enc, 'enc2t'), function (str) {
              parse(str || '', empty);
            }, function (a, c) {
              error(network.errorDecode(a, c));
            }, false, {
              dataType: 'text',
              headers: headers
            });
          } else empty();
        }, function (a, c) {
          error(network.errorDecode(a, c));
        }, false, {
          headers: headers
        });
      };

      this.extendChoice = function (saved) {
        Lampa.Arrays.extend(choice, saved, true);
      };
      /**
       * Сброс фильтра
       */


      this.reset = function () {
        component.reset();
        choice = {
          season: 0,
          voice: 0,
          voice_name: ''
        };
        filter();
        append(filtred());
        component.saveChoice(choice);
      };
      /**
       * Применить фильтр
       * @param {*} type
       * @param {*} a
       * @param {*} b
       */


      this.filter = function (type, a, b) {
        choice[a.stype] = b.index;
        if (a.stype == 'voice') choice.voice_name = filter_items.voice[b.index];
        component.reset();
        filter();
        append(filtred());
        component.saveChoice(choice);
      };
      /**
       * Уничтожить
       */


      this.destroy = function () {
        network.clear();
        extract = null;
      };

      function parse(str, empty) {
        str = (str || '').replace(/\n/g, '');
        var json;
        var find = str.match(/Playerjs\(({.*?})\);/) || str.match(/var +plr_config *= *({.*?});/);

        if (find) {
          try {
            json = find && (0, eval)('"use strict"; (function(){ var token = "", domain_name = ""; return ' + find[1] + '; })();');
          } catch (e) {}
        } else {
          find = str.match(/Playerjs\("([^"]*)"\);/) || str.match(/var +plr_config *= *"([^"]*)";/);
          var player = find && decode(find[1]);

          try {
            json = player && JSON.parse(player);
          } catch (e) {}
        }

        if (json && json.file && typeof json.file === 'string') {
          json.file = decode(json.file);

          try {
            json.file = JSON.parse(json.file);
          } catch (e) {
            json = {
              file: [json]
            };
          }
        }

        if (json && json.file && json.file.length && json.file.forEach) {
          component.loading(false);
          extract = json;
          filter();
          append(filtred());
        } else empty();
      }

      function decode(data) {
        if (!startsWith(data, '#')) return data;

        var enc = function enc(str) {
          return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (match, p1) {
            return String.fromCharCode('0x' + p1);
          }));
        };

        var dec = function dec(str) {
          return decodeURIComponent(atob(str).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          }).join(''));
        };

        var trashList = [atob('YTBCZnREaUZaVXNLV3A2d0o5VnloMmxIcWoxQ2JjOGVuTVlQQVQ3VGFialpqdkcySWZaRU9XYm9ZdDFvUTZPSw=='), atob('NnNlbFdvNUcwcjczNGttWm5hSHZZSmpFU3VpY1BJTGRYVGJ0WHUwcTR4Q3hWbmJaaDRKWFRKRElOeXNJRXY2aQ=='), atob('U0hiTkJZa085VkNoeTNtMjg1NnF3WEljS0ZUQXAwTTdXbjFyUllvY1lVbmFLeThXNkJsekdlUUhnMjFYNmZGbg=='), atob('QWw2aXhzYlZuQ1dlZHBSd0hjdjdHTGhNWTFUeTl6YXIwU1pmS29PNk9rM3c1ejRJbUVqNjFidkRCdEhQSXF0Mg=='), atob('WEV6bjVZUE9sRnM5VndjdThKMzRmdEh5R1FheDFXNzZoQUNlWjBEb0RNckg4TGQ1aGhqNVd6em5Md2c3amZnVg==')];
        var x = data.substring(2);
        trashList.forEach(function (trash) {
          x = x.replace('|||' + enc(trash), '');
        });

        try {
          x = dec(x);
        } catch (e) {
          x = '';
        }

        return x;
      }

      function extractVoices(str) {
        var voices = {};
        var items = extractItems(str);
        items.forEach(function (item) {
          var prev = voices[item.voice || ''];
          var prev_items = prev && prev.items || [];
          prev_items.push(item);

          if (!prev || item.quality > prev.quality) {
            voices[item.voice || ''] = {
              quality: item.quality,
              items: prev_items
            };
          }
        });
        return voices;
      }
      /**
       * Построить фильтр
       */


      function filter() {
        filter_items = {
          season: [],
          voice: []
        };
        var season_objs = [];
        extract.file.forEach(function (s) {
          if (s.folder) {
            s.title = s.title || s.comment || '';
            s.season_num = parseInt(s.title.match(/\d+/));
            season_objs.push(s);
          }
        });
        season_objs.sort(function (a, b) {
          var cmp = a.season_num - b.season_num;
          if (cmp) return cmp;
          if (a.title > b.title) return 1;
          if (a.title < b.title) return -1;
          return 0;
        });
        filter_items.season = season_objs.map(function (s) {
          return s.title;
        });
        if (!filter_items.season[choice.season]) choice.season = 0;
        var s = season_objs[choice.season];

        if (s && s.folder) {
          s.folder.forEach(function (e) {
            if (e.folder) {
              e.folder.forEach(function (v) {
                var voice = v.title || v.comment || '';
                if (filter_items.voice.indexOf(voice) == -1) filter_items.voice.push(voice);
              });
            } else if (typeof e.file === 'string') {
              e.file_voices = extractVoices(e.file);

              for (var voice in e.file_voices) {
                if (voice && filter_items.voice.indexOf(voice) == -1) filter_items.voice.push(voice);
              }
            }
          });
        }

        if (!filter_items.voice[choice.voice]) choice.voice = 0;

        if (choice.voice_name) {
          var inx = filter_items.voice.indexOf(choice.voice_name);
          if (inx == -1) choice.voice = 0;else if (inx !== choice.voice) {
            choice.voice = inx;
          }
        }

        component.filter(filter_items, choice);
      }
      /**
       * Получить потоки
       * @param {String} str
       * @param {String} voice
       * @returns array
       */


      function extractItems(str, voice) {
        if (!str) return [];

        try {
          if (!startsWith(str, '[')) str = '[]' + str;
          var list = component.parsePlaylist(str);
          list.forEach(function (el) {
            if (el.voice) el.voice = el.voice.trim();
          });

          if (voice) {
            var tmp = list.filter(function (el) {
              return el.voice == voice;
            });

            if (tmp.length) {
              list = tmp;
            } else {
              list = list.filter(function (el) {
                return typeof el.voice === 'undefined';
              });
            }
          }

          var items = list.map(function (item) {
            var quality = item.label.match(/(\d\d\d+)/);
            var file = item.links[0] || '';
            return {
              label: item.label,
              quality: quality ? parseInt(quality[1]) : NaN,
              voice: item.voice,
              file: file
            };
          });
          items.sort(function (a, b) {
            if (b.quality > a.quality) return 1;
            if (b.quality < a.quality) return -1;
            if (b.label > a.label) return 1;
            if (b.label < a.label) return -1;
            return 0;
          });
          return items;
        } catch (e) {}

        return [];
      }

      function parseSubs(str) {
        if (!str) return false;
        var subtitles = component.parsePlaylist(str).map(function (item) {
          var link = item.links[0] || '';
          return {
            label: item.label,
            url: component.processSubs(link)
          };
        });
        return subtitles.length ? subtitles : false;
      }
      /**
       * Отфильтровать файлы
       * @returns array
       */


      function filtred() {
        var filtred = [];
        extract.file.forEach(function (data) {
          if (data.folder) {
            var s_title = data.title || data.comment || '';

            if (s_title == filter_items.season[choice.season]) {
              var season_num = parseInt(s_title.match(/\d+/));
              data.folder.forEach(function (e) {
                var e_title = e.title || e.comment || '';
                var episode_num = parseInt(e_title.match(/\d+/));
                e_title = e_title.replace(/\d+/, '').replace(/серия/i, '').trim();

                if (e.folder) {
                  e.folder.forEach(function (v) {
                    var voice = v.title || v.comment || '';

                    if (voice == filter_items.voice[choice.voice] && v.file) {
                      var items = extractItems(v.file);
                      filtred.push({
                        title: component.formatEpisodeTitle(season_num, episode_num, e_title),
                        quality: items[0] && items[0].quality ? items[0].quality + 'p' : '360p ~ 1080p',
                        info: ' / ' + Lampa.Utils.shortText(voice, 50),
                        season: season_num,
                        episode: episode_num,
                        media: items,
                        subtitles: parseSubs(v.subtitle)
                      });
                    }
                  });
                } else if (e.file_voices) {
                  var voice = filter_items.voice[choice.voice] || '';
                  var v = e.file_voices[voice];

                  if (!v) {
                    voice = '';
                    v = e.file_voices[voice];
                  }

                  if (v) {
                    filtred.push({
                      title: component.formatEpisodeTitle(season_num, episode_num, e_title),
                      quality: v.quality ? v.quality + 'p' : '360p ~ 1080p',
                      info: voice ? ' / ' + Lampa.Utils.shortText(voice, 50) : '',
                      season: season_num,
                      episode: episode_num,
                      media: v.items,
                      subtitles: parseSubs(e.subtitle)
                    });
                  }
                }
              });
            }
          } else {
            if (!data.file_voices && data.file && typeof data.file === 'string') {
              data.file_voices = extractVoices(data.file);
            }

            if (data.file_voices) {
              var subtitles = parseSubs(data.subtitle);

              for (var voice in data.file_voices) {
                var v = data.file_voices[voice];
                filtred.push({
                  title: voice || data.title || data.comment || select_title,
                  quality: v.quality ? v.quality + 'p' : '360p ~ 1080p',
                  info: '',
                  media: v.items,
                  subtitles: subtitles
                });
              }
            }
          }
        });
        return filtred;
      }
      /**
       * Найти поток
       * @param {Object} element
       * @returns string
       */


      function getFile(element) {
        var file = '';
        var quality = false;
        var items = element.media;

        if (items && items.length) {
          file = items[0].file;
          quality = {};
          items.forEach(function (item) {
            quality[item.label] = item.file;
          });
        }

        return {
          file: file,
          quality: quality
        };
      }
      /**
       * Показать файлы
       */


      function append(items) {
        component.reset();
        var viewed = Lampa.Storage.cache('online_view', 5000, []);
        items.forEach(function (element) {
          var hash = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title].join('') : object.movie.original_title);
          var view = component.watchView(element, hash, items);
          var item = Lampa.Template.get('online_mod', element);
          var hash_file = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title, filter_items.voice[choice.voice]].join('') : object.movie.original_title + element.title);
          element.timeline = view;
          item.append(Lampa.Timeline.render(view));

          if (Lampa.Timeline.details) {
            item.find('.online__quality').append(Lampa.Timeline.details(view, ' / '));
          }

          if (viewed.indexOf(hash_file) !== -1) item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
          item.on('hover:enter', function () {
            if (object.movie.id) Lampa.Favorite.add('history', object.movie, 100);
            var extra = getFile(element);

            if (extra.file) {
              var playlist = [];
              var first = {
                url: component.getDefaultQuality(extra.quality, extra.file),
                quality: component.renameQualityMap(extra.quality),
                subtitles: element.subtitles,
                timeline: element.timeline,
                title: element.season ? element.title : select_title + (element.title == select_title ? '' : ' / ' + element.title)
              };

              if (element.season) {
                items.forEach(function (elem) {
                  var ex = getFile(elem);
                  playlist.push({
                    url: component.getDefaultQuality(ex.quality, ex.file),
                    quality: component.renameQualityMap(ex.quality),
                    subtitles: elem.subtitles,
                    timeline: elem.timeline,
                    title: elem.title
                  });
                });
              } else {
                playlist.push(first);
              }

              if (playlist.length > 1) first.playlist = playlist;
              playWithoutPreroll(first, playlist);

              if (viewed.indexOf(hash_file) == -1) {
                viewed.push(hash_file);
                item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
                Lampa.Storage.set('online_view', viewed);
              }
            } else Lampa.Noty.show(Lampa.Lang.translate('online_mod_nolink'));
          });
          component.append(item);
          component.contextmenu({
            item: item,
            view: view,
            element: element,
            viewed: viewed,
            hash_file: hash_file,
            file: function file(call) {
              call(getFile(element));
            }
          });
        });
        component.start(true);
      }
    }

    videoseed.initSettings = function (show_all) {
      var balanser_name = 'VideoSeed';
      var component_name = 'online_mod_videoseed';
      if (Lampa.SettingsApi.getComponent(component_name)) return;

      {
        var icon = "<svg><use xlink:href=\"#sprite-settings\"></use></svg>";
        Lampa.SettingsApi.addComponent({
          component: component_name,
          icon: icon,
          name: balanser_name
        });
        Lampa.SettingsApi.addParam({
          component: 'online_mod',
          param: {
            name: component_name + '_settings',
            type: 'button'
          },
          field: {
            name: "<div class=\"settings-folder\" style=\"padding:0!important\"><div style=\"width:1.8em;height:1.3em;padding-right:.5em\">".concat(icon, "</div><div style=\"font-size:1.3em\">").concat(balanser_name, "</div></div>")
          },
          onChange: function onChange() {
            Lampa.Settings.create(component_name, {
              onBack: function onBack() {
                Lampa.Settings.create('online_mod');
              }
            });
          }
        });
      }

      {
        Lampa.SettingsApi.addParam({
          component: component_name,
          param: {
            name: 'online_mod_proxy_videoseed',
            type: 'trigger',
            "default": false
          },
          field: {
            name: Lampa.Lang.translate('online_mod_proxy_balanser') + ' ' + balanser_name
          }
        });
      }
    };

    videoseed.hideSettings = function (body) {
      $('[data-component="online_mod_videoseed"]', body).hide();
    };

    function vibix(component, _object, config) {
      var network = new Lampa.Reguest();
      var extract = {};
      var object = _object;
      var select_title = '';
      var prox = component.proxy('vibix');
      var user_agent = Utils.baseUserAgent();
      var auth = Utils.decodeSecret([44, 23, 81, 32, 63, 32, 116, 90, 0, 115, 89, 14, 116, 10, 30, 49, 1, 61, 3, 115, 57, 64, 8, 57, 45, 21, 28, 88, 113, 14, 94, 29, 118, 56, 25, 102, 5, 15, 90, 29, 33, 68, 123, 6, 40, 35, 33, 91, 127, 62, 28, 65, 9, 49, 104, 55, 97, 14, 8, 46], atob('VmliaXhBdXRo'));
      var key = Utils.decodeSecret([60, 11, 99, 54, 44, 49, 45, 25, 5, 34, 58, 39, 72, 60, 99, 101, 34, 2, 4, 3, 25, 29, 94, 59, 45, 53, 44, 13, 115, 50, 0, 51], atob('VmliaXhBdXRo'));
      var sign_key = Utils.decodeSecret([60, 38, 113, 24, 14, 63, 62, 42, 85, 44, 52, 20, 72, 43, 52, 3, 109, 89, 117, 60, 10, 29, 65, 11, 40, 3, 102, 56, 5, 17, 36, 55], atob('VmliaXhBdXRo'));
      var headers = Lampa.Platform.is('android') ? {
        'User-Agent': user_agent,
        'Authorization': auth
      } : {};
      var prox_enc = '';

      if (prox) {
        prox_enc += 'param/User-Agent=' + encodeURIComponent(user_agent) + '/';
        prox_enc += 'param/Authorization=' + encodeURIComponent(auth) + '/';
      }

      var embed = atob('aHR0cHM6Ly92aWJpeC5vcmcvYXBpL3YxL3B1Ymxpc2hlci92aWRlb3Mv');
      var filter_items = {};
      var choice = {
        season: 0,
        voice: 0,
        voice_name: ''
      };

      function vibix_api_search(api, callback, error) {
        network.clear();
        network.timeout(15000);
        network["native"](component.proxyLink(embed + api, prox, prox_enc, 'enc2t'), function (json) {
          if (callback) callback(json);
        }, function (a, c) {
          if (a.status == 404 && (!a.responseText || a.responseText.indexOf('"Video not found"') !== -1)) {
            if (callback) callback('');
          } else if (error) error(network.errorDecode(a, c));
        }, false, {
          headers: headers
        });
      }
      /**
       * Начать поиск
       * @param {Object} _object
       * @param {String} kinopoisk_id
       */


      this.search = function (_object, kinopoisk_id) {
        object = _object;
        select_title = object.search || object.movie.title;

        var empty = function empty() {
          component.emptyForQuery(select_title);
        };

        var error = component.empty.bind(component);
        var api = (+kinopoisk_id ? 'kp/' : 'imdb/') + encodeURIComponent(kinopoisk_id);
        vibix_api_search(api, function (json) {
          getPage(json, function () {
            if (!object.clarification && object.movie.imdb_id && kinopoisk_id != object.movie.imdb_id) {
              vibix_api_search('imdb/' + encodeURIComponent(object.movie.imdb_id), function (json) {
                getPage(json, empty);
              }, error);
            } else empty();
          });
        }, error);
      };

      this.extendChoice = function (saved) {
        Lampa.Arrays.extend(choice, saved, true);
      };
      /**
       * Сброс фильтра
       */


      this.reset = function () {
        component.reset();
        choice = {
          season: 0,
          voice: 0,
          voice_name: ''
        };
        filter();
        append(filtred());
        component.saveChoice(choice);
      };
      /**
       * Применить фильтр
       * @param {*} type
       * @param {*} a
       * @param {*} b
       */


      this.filter = function (type, a, b) {
        choice[a.stype] = b.index;
        if (a.stype == 'voice') choice.voice_name = filter_items.voice[b.index];
        component.reset();
        filter();
        append(filtred());
        component.saveChoice(choice);
      };
      /**
       * Уничтожить
       */


      this.destroy = function () {
        network.clear();
        extract = null;
      };

      function parseIFrame(iframe_url) {
        var serial = iframe_url.match(/\/embed-serials\/(\d+)/);
        var movie = iframe_url.match(/\/embed\/(\d+)/);

        if (serial) {
          return {
            type: 'serial',
            id: serial[1]
          };
        } else if (movie) {
          return {
            type: 'movie',
            id: movie[1]
          };
        }

        return null;
      }

      function xorDecrypt(str) {
        var key_len = key.length;
        var len = str.length;
        var result = '';

        for (var i = 0; i < len; i++) {
          result += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key_len));
        }

        return result;
      }

      function binaryToUtf8(str) {
        if (typeof TextDecoder !== "undefined") {
          try {
            var arr = new Uint8Array(str.length);

            for (var i = 0; i < str.length; i++) {
              arr[i] = str.charCodeAt(i);
            }

            return new TextDecoder('utf-8').decode(arr);
          } catch (e) {}
        }

        try {
          return decodeURIComponent(escape(str));
        } catch (e) {
          return str;
        }
      }

      function decrypt(json) {
        try {
          var str = json.p;

          if (json.v == 1) {
            if (true) {
              str = str.split('').reverse().join('');
            }

            str = binaryToUtf8(xorDecrypt(atob(str)));
          }

          return JSON.parse(str);
        } catch (e) {
          return {};
        }
      }

      function sign(key, secret) {
        function encode(msg) {
          var x = 0;

          if (msg.length === 0) {
            return x.toString();
          }

          for (var i = 0; i < msg.length; i++) {
            var c = msg.charCodeAt(i);
            x = (x << 5) - x + c;
            x = x & x;
          }

          var y = Math.abs(x).toString(16);

          while (y.length < 8) {
            y = '0' + y;
          }

          var z = [y];

          for (var j = 0; j < msg.length; j += 3) {
            var part = msg.substring(j, j + 3);
            var r = 0;

            for (var k = 0; k < part.length; k++) {
              r += part.charCodeAt(k);
            }

            z.push(r.toString(16));
          }

          return z.join('');
        }

        var salt1 = '';
        var salt2 = '';

        if (key.length > 64) {
          key = encode(key);
        }

        while (key.length < 64) {
          key += "\0";
        }

        for (var i = 0; i < 64; i++) {
          salt1 += String.fromCharCode(key.charCodeAt(i) ^ 54);
          salt2 += String.fromCharCode(key.charCodeAt(i) ^ 92);
        }

        var sign0 = encode(salt1 + secret);
        return encode(salt2 + sign0);
      }

      function getPage(json, empty) {
        var info = json && json.iframe_url && parseIFrame(json.iframe_url);

        if (!info) {
          empty();
          return;
        }

        json.iframe_url = json.iframe_url.replace(/^(https?:\/\/)\d+\./, Utils.decodeSecret([73, 84, 65, 114, 83, 112, 126, 79, 112, 69, 92, 75], atob('ZGViYmx5ZA==')));
        var parsed = Utils.parseURL(json.iframe_url);
        var host = parsed.origin;
        var ref = parsed.origin + parsed.pathname;
        var headers2 = Lampa.Platform.is('android') ? {
          'User-Agent': user_agent,
          'Origin': host,
          'Referer': ref,
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin'
        } : {};
        var prox_enc2 = '';

        if (prox) {
          prox_enc2 += 'param/User-Agent=' + encodeURIComponent(user_agent) + '/';
          prox_enc2 += 'param/Origin=' + encodeURIComponent(host) + '/';
          prox_enc2 += 'param/Referer=' + encodeURIComponent(ref) + '/';
          prox_enc2 += 'param/Sec-Fetch-Dest=empty/';
          prox_enc2 += 'param/Sec-Fetch-Mode=cors/';
          prox_enc2 += 'param/Sec-Fetch-Site=same-origin/';
        }

        var domain = Utils.decodeSecret([4, 3, 5, 37, 9, 34, 97, 20, 47, 30, 24, 1], atob('ZGViYmx5ZA=='));
        var iframe_url = json.iframe_url;
        var timestamp = Math.floor(Date.now() / 1000);
        var nonce = Math.random().toString(36).substring(2, 15);
        var secret = [domain, iframe_url, timestamp.toString(), nonce].join('|');
        var sig = sign(sign_key, secret);
        var url = host + (info.type === 'movie' ? '/api/v1/embed/' : '/api/v1/embed-serials/') + info.id;
        url = Lampa.Utils.addUrlComponent(url, 'domain=' + encodeURIComponent(domain));
        url = Lampa.Utils.addUrlComponent(url, 'iframe_url=' + encodeURIComponent(iframe_url));
        url = Lampa.Utils.addUrlComponent(url, 'sig=' + encodeURIComponent(sig));
        url = Lampa.Utils.addUrlComponent(url, 'ts=' + timestamp);
        url = Lampa.Utils.addUrlComponent(url, 'nonce=' + encodeURIComponent(nonce));
        url = Lampa.Utils.addUrlComponent(url, 'nc=' + Math.floor(new Date().getTime() / 60000));
        network.clear();
        network.timeout(15000);
        network["native"](component.proxyLink(url, prox, prox_enc2, 'enc2t'), function (json) {
          if (json && Object.keys(json).length == 2 && typeof json.p === 'string' && json.v != null) {
            json = decrypt(json);
          }

          if (json && json.data && json.data.playlist && json.data.playlist.length && json.data.playlist.forEach) {
            component.loading(false);
            extract = json.data;
            filter();
            append(filtred());
          } else empty();
        }, function (a, c) {
          empty();
        }, false, {
          headers: headers2
        });
      }

      function extractVoices(str) {
        var voices = {};
        var items = extractItems(str);
        items.forEach(function (item) {
          var prev = voices[item.voice || ''];
          var prev_items = prev && prev.items || [];
          prev_items.push(item);

          if (!prev || item.quality > prev.quality) {
            voices[item.voice || ''] = {
              quality: item.quality,
              items: prev_items
            };
          }
        });
        return voices;
      }
      /**
       * Построить фильтр
       */


      function filter() {
        filter_items = {
          season: [],
          voice: []
        };
        var season_objs = [];
        extract.playlist.forEach(function (s) {
          if (s.folder) {
            s.title = s.title || s.comment || '';
            s.season_num = parseInt(s.title.match(/\d+/));
            season_objs.push(s);
          }
        });
        season_objs.sort(function (a, b) {
          var cmp = a.season_num - b.season_num;
          if (cmp) return cmp;
          if (a.title > b.title) return 1;
          if (a.title < b.title) return -1;
          return 0;
        });
        filter_items.season = season_objs.map(function (s) {
          return s.title;
        });
        if (!filter_items.season[choice.season]) choice.season = 0;
        var s = season_objs[choice.season];

        if (s && s.folder) {
          s.folder.forEach(function (e) {
            if (e.folder) {
              e.folder.forEach(function (v) {
                var voice = v.title || v.comment || '';
                if (filter_items.voice.indexOf(voice) == -1) filter_items.voice.push(voice);
              });
            } else if (typeof e.file === 'string') {
              e.file_voices = extractVoices(e.file);

              for (var voice in e.file_voices) {
                if (voice && filter_items.voice.indexOf(voice) == -1) filter_items.voice.push(voice);
              }
            }
          });
        }

        if (!filter_items.voice[choice.voice]) choice.voice = 0;

        if (choice.voice_name) {
          var inx = filter_items.voice.indexOf(choice.voice_name);
          if (inx == -1) choice.voice = 0;else if (inx !== choice.voice) {
            choice.voice = inx;
          }
        }

        component.filter(filter_items, choice);
      }
      /**
       * Получить потоки
       * @param {String} str
       * @param {String} voice
       * @returns array
       */


      function extractItems(str, voice) {
        if (!str) return [];

        try {
          if (!startsWith(str, '[')) str = '[]' + str;
          var list = component.parsePlaylist(str);
          list.forEach(function (el) {
            if (el.voice) el.voice = el.voice.trim();
          });

          if (voice) {
            var tmp = list.filter(function (el) {
              return el.voice == voice;
            });

            if (tmp.length) {
              list = tmp;
            } else {
              list = list.filter(function (el) {
                return typeof el.voice === 'undefined';
              });
            }
          }

          var items = list.map(function (item) {
            var label = item.label;

            if (startsWith(label, 'MP4 ')) {
              label = label.substring('MP4 '.length).trim();
            }

            var quality = label.match(/(\d\d\d+)/);
            var file = item.links[0] || '';
            return {
              label: label,
              quality: quality ? parseInt(quality[1]) : NaN,
              voice: item.voice,
              file: file
            };
          });
          items.sort(function (a, b) {
            if (b.quality > a.quality) return 1;
            if (b.quality < a.quality) return -1;
            if (b.label > a.label) return 1;
            if (b.label < a.label) return -1;
            return 0;
          });
          return items;
        } catch (e) {}

        return [];
      }

      function parseSubs(str) {
        if (!str) return false;
        var subtitles = component.parsePlaylist(str).map(function (item) {
          var link = item.links[0] || '';
          return {
            label: item.label,
            url: component.processSubs(link)
          };
        });
        return subtitles.length ? subtitles : false;
      }
      /**
       * Отфильтровать файлы
       * @returns array
       */


      function filtred() {
        var filtred = [];
        extract.playlist.forEach(function (data) {
          if (data.folder) {
            var s_title = data.title || data.comment || '';

            if (s_title == filter_items.season[choice.season]) {
              var season_num = parseInt(s_title.match(/\d+/));
              data.folder.forEach(function (e) {
                var e_title = e.title || e.comment || '';
                var episode_num = parseInt(e_title.match(/\d+/));
                e_title = e_title.replace(/\d+/, '').replace(/серия/i, '').trim();

                if (e.folder) {
                  e.folder.forEach(function (v) {
                    var voice = v.title || v.comment || '';

                    if (voice == filter_items.voice[choice.voice] && v.file) {
                      var items = extractItems(v.file);
                      filtred.push({
                        title: component.formatEpisodeTitle(season_num, episode_num, e_title),
                        quality: items[0] && items[0].quality ? items[0].quality + 'p' : '360p ~ 1080p',
                        info: ' / ' + Lampa.Utils.shortText(voice, 50),
                        season: season_num,
                        episode: episode_num,
                        media: items,
                        subtitles: parseSubs(v.subtitle)
                      });
                    }
                  });
                } else if (e.file_voices) {
                  var voice = filter_items.voice[choice.voice] || '';
                  var v = e.file_voices[voice];

                  if (!v) {
                    voice = '';
                    v = e.file_voices[voice];
                  }

                  if (v) {
                    filtred.push({
                      title: component.formatEpisodeTitle(season_num, episode_num, e_title),
                      quality: v.quality ? v.quality + 'p' : '360p ~ 1080p',
                      info: voice ? ' / ' + Lampa.Utils.shortText(voice, 50) : '',
                      season: season_num,
                      episode: episode_num,
                      media: v.items,
                      subtitles: parseSubs(e.subtitle)
                    });
                  }
                }
              });
            }
          } else {
            if (!data.file_voices && data.file && typeof data.file === 'string') {
              data.file_voices = extractVoices(data.file);
            }

            if (data.file_voices) {
              var subtitles = parseSubs(data.subtitle);

              for (var voice in data.file_voices) {
                var v = data.file_voices[voice];
                filtred.push({
                  title: voice || data.title || data.comment || select_title,
                  quality: v.quality ? v.quality + 'p' : '360p ~ 1080p',
                  info: '',
                  media: v.items,
                  subtitles: subtitles
                });
              }
            }
          }
        });
        return filtred;
      }
      /**
       * Найти поток
       * @param {Object} element
       * @returns string
       */


      function getFile(element) {
        var file = '';
        var quality = false;
        var items = element.media;

        if (items && items.length) {
          file = items[0].file;
          quality = {};
          items.forEach(function (item) {
            quality[item.label] = item.file;
          });
        }

        return {
          file: file,
          quality: quality
        };
      }
      /**
       * Показать файлы
       */


      function append(items) {
        component.reset();
        var viewed = Lampa.Storage.cache('online_view', 5000, []);
        items.forEach(function (element) {
          var hash = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title].join('') : object.movie.original_title);
          var view = component.watchView(element, hash, items);
          var item = Lampa.Template.get('online_mod', element);
          var hash_file = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title, filter_items.voice[choice.voice]].join('') : object.movie.original_title + element.title);
          element.timeline = view;
          item.append(Lampa.Timeline.render(view));

          if (Lampa.Timeline.details) {
            item.find('.online__quality').append(Lampa.Timeline.details(view, ' / '));
          }

          if (viewed.indexOf(hash_file) !== -1) item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
          item.on('hover:enter', function () {
            if (object.movie.id) Lampa.Favorite.add('history', object.movie, 100);
            var extra = getFile(element);

            if (extra.file) {
              var playlist = [];
              var first = {
                url: component.getDefaultQuality(extra.quality, extra.file),
                quality: component.renameQualityMap(extra.quality),
                subtitles: element.subtitles,
                timeline: element.timeline,
                title: element.season ? element.title : select_title + (element.title == select_title ? '' : ' / ' + element.title)
              };

              if (element.season) {
                items.forEach(function (elem) {
                  var ex = getFile(elem);
                  playlist.push({
                    url: component.getDefaultQuality(ex.quality, ex.file),
                    quality: component.renameQualityMap(ex.quality),
                    subtitles: elem.subtitles,
                    timeline: elem.timeline,
                    title: elem.title
                  });
                });
              } else {
                playlist.push(first);
              }

              if (playlist.length > 1) first.playlist = playlist;
              playWithoutPreroll(first, playlist);

              if (viewed.indexOf(hash_file) == -1) {
                viewed.push(hash_file);
                item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
                Lampa.Storage.set('online_view', viewed);
              }
            } else Lampa.Noty.show(Lampa.Lang.translate('online_mod_nolink'));
          });
          component.append(item);
          component.contextmenu({
            item: item,
            view: view,
            element: element,
            viewed: viewed,
            hash_file: hash_file,
            file: function file(call) {
              call(getFile(element));
            }
          });
        });
        component.start(true);
      }
    }

    vibix.initSettings = function (show_all) {
      var balanser_name = 'Vibix';
      var component_name = 'online_mod_vibix';
      if (Lampa.SettingsApi.getComponent(component_name)) return;

      {
        var icon = "<svg><use xlink:href=\"#sprite-settings\"></use></svg>";
        Lampa.SettingsApi.addComponent({
          component: component_name,
          icon: icon,
          name: balanser_name
        });
        Lampa.SettingsApi.addParam({
          component: 'online_mod',
          param: {
            name: component_name + '_settings',
            type: 'button'
          },
          field: {
            name: "<div class=\"settings-folder\" style=\"padding:0!important\"><div style=\"width:1.8em;height:1.3em;padding-right:.5em\">".concat(icon, "</div><div style=\"font-size:1.3em\">").concat(balanser_name, "</div></div>")
          },
          onChange: function onChange() {
            Lampa.Settings.create(component_name, {
              onBack: function onBack() {
                Lampa.Settings.create('online_mod');
              }
            });
          }
        });
      }

      {
        Lampa.SettingsApi.addParam({
          component: component_name,
          param: {
            name: 'online_mod_proxy_vibix',
            type: 'trigger',
            "default": false
          },
          field: {
            name: Lampa.Lang.translate('online_mod_proxy_balanser') + ' ' + balanser_name
          }
        });
      }
    };

    vibix.hideSettings = function (body) {
      $('[data-component="online_mod_vibix"]', body).hide();
    };

    function redheadsound(component, _object, config) {
      var network = new Lampa.Reguest();
      var extract = [];
      var object = _object;
      var select_title = '';
      var page_title = '';
      var prefer_dash = !!(config && config.prefer_dash);
      var prox = component.proxy('redheadsound');
      var host = 'https://redheadsound.studio';
      var ref = host + '/';
      var user_agent = Utils.baseUserAgent();
      var headers = Lampa.Platform.is('android') ? {
        'Origin': host,
        'Referer': ref,
        'User-Agent': user_agent
      } : {};
      var prox_enc = '';

      if (prox) {
        prox_enc += 'param/Origin=' + encodeURIComponent(host) + '/';
        prox_enc += 'param/Referer=' + encodeURIComponent(ref) + '/';
        prox_enc += 'param/User-Agent=' + encodeURIComponent(user_agent) + '/';
      }

      var embed = ref;
      var filter_items = {};
      var choice = {
        season: 0,
        voice: 0
      };
      var secret = atob('MWM2MzYyNTY3ZjNmNzQ5ZDVkOTZjOWVmYjZlM2UwYmRhYzY4NjI3OA==');
      var secret_timestamp = null;

      function decodeSecretToken(callback) {

        var timestamp = new Date().getTime();
        var cache_timestamp = timestamp - 1000 * 60 * 10;

        if (secret && secret_timestamp && secret_timestamp > cache_timestamp) {
          if (callback) callback();
          return;
        }

        network.clear();
        network.timeout(10000);
        network["native"](component.proxyLink(embed, prox), function (str) {
          str = (str || '').replace(/\n/g, '');
          var found = str.match(/\bdle_login_hash = '([^']+)'/);

          if (found) {
            secret = found[1];
            secret_timestamp = timestamp;
          }

          if (callback) callback();
        }, function (a, c) {
          if (callback) callback();
        }, false, {
          dataType: 'text'
        });
      }
      /**
       * Поиск
       * @param {Object} _object
       */


      this.search = function (_object, kinopoisk_id, data) {
        var _this = this;

        object = _object;
        select_title = object.search || object.movie.title;
        if (this.wait_similars && data && data[0].is_similars) return getPage(data[0]);
        var search_date = object.search_date || !object.clarification && (object.movie.release_date || object.movie.first_air_date || object.movie.last_air_date) || '0000';
        var search_year = parseInt((search_date + '').slice(0, 4));
        var orig_titles = [];

        if (object.movie.alternative_titles && object.movie.alternative_titles.results) {
          orig_titles = object.movie.alternative_titles.results.map(function (t) {
            return t.title;
          });
        }

        if (object.movie.original_title) orig_titles.push(object.movie.original_title);
        if (object.movie.original_name) orig_titles.push(object.movie.original_name);
        var url = embed + 'engine/ajax/controller.php?mod=search';

        var display = function display(links) {
          if (links && links.length && links.forEach) {
            var is_sure = false;
            var items = links.map(function (l) {
              var h4 = $(l.link);
              var link = $('a', h4);
              var titl = link.text().trim() || '';
              var year_link = $(l.year);
              var year = parseInt(year_link.text().trim() || '');
              return {
                year: year,
                title: titl,
                orig_title: '',
                link: link.attr('href') || ''
              };
            });
            var cards = items;

            if (cards.length) {
              if (orig_titles.length) {
                var tmp = cards.filter(function (c) {
                  return component.containsAnyTitle([c.orig_title, c.title], orig_titles);
                });

                if (tmp.length) {
                  cards = tmp;
                  is_sure = true;
                }
              }

              if (select_title) {
                var _tmp = cards.filter(function (c) {
                  return component.containsAnyTitle([c.title, c.orig_title], [select_title]);
                });

                if (_tmp.length) {
                  cards = _tmp;
                  is_sure = true;
                }
              }

              {
                var _tmp2 = cards.filter(function (c) {
                  return !endsWith(c.title, ' - обзор');
                });

                if (_tmp2.length) {
                  cards = _tmp2;
                }
              }

              if (cards.length > 1 && search_year) {
                var _tmp3 = cards.filter(function (c) {
                  return c.year == search_year;
                });

                if (!_tmp3.length) _tmp3 = cards.filter(function (c) {
                  return c.year && c.year > search_year - 2 && c.year < search_year + 2;
                });
                if (_tmp3.length) cards = _tmp3;
              }
            }

            if (cards.length == 1 && is_sure) {
              if (search_year && cards[0].year) {
                is_sure = cards[0].year > search_year - 2 && cards[0].year < search_year + 2;
              }

              if (is_sure) {
                is_sure = false;

                if (orig_titles.length) {
                  is_sure |= component.equalAnyTitle([cards[0].orig_title, cards[0].title], orig_titles);
                }

                if (select_title) {
                  is_sure |= component.equalAnyTitle([cards[0].title, cards[0].orig_title], [select_title]);
                }
              }
            }

            if (cards.length == 1 && is_sure) getPage(cards[0]);else if (items.length) {
              _this.wait_similars = true;
              items.forEach(function (c) {
                c.is_similars = true;
              });
              component.similars(items);
              component.loading(false);
            } else component.emptyForQuery(select_title);
          } else component.emptyForQuery(select_title);
        };

        var query_search = function query_search(query, data, callback) {
          var postdata = 'query=' + encodeURIComponent(query);
          postdata += '&skin=rhs_new';
          postdata += '&user_hash=' + secret;
          network.clear();
          network.timeout(10000);
          network["native"](component.proxyLink(url, prox), function (str) {
            str = (str || '').replace(/\n/g, '');
            var pos = str.indexOf('<div class="move-item">');

            if (pos !== -1) {
              str.substring(pos + '<div class="move-item">'.length).split('<div class="move-item">').forEach(function (item) {
                var link = item.match(/<div class="move-item__content">\s*(<h4 class="title">\s*<a [^>]*>[^<]*<\/a>[^<]*<\/h4>)/);
                var year = item.match(/(<span class="year [^>]*>\s*(<a [^>]*>[^<]*<\/a>)?[^<]*<\/span>)/);

                if (link) {
                  data.push({
                    link: link[1],
                    year: year && year[1] || ''
                  });
                }
              });
            }

            if (callback) callback(data);
          }, function (a, c) {
            component.empty(network.errorDecode(a, c));
          }, postdata, {
            dataType: 'text'
          });
        };

        var query_title_search = function query_title_search() {
          query_search(component.cleanTitle(select_title), [], function (data) {
            if (data && data.length && data.forEach) display(data);else display([]);
          });
        };

        var apiSearch = function apiSearch() {
          query_title_search();
        };

        decodeSecretToken(function () {
          return apiSearch();
        });
      };

      function getPage(card) {
        page_title = card.title || card.orig_title || select_title;
        var url = component.fixLink(card.link, ref);
        network.clear();
        network.timeout(10000);
        network["native"](component.proxyLink(url, prox), function (str) {
          str = (str || '').replace(/\n/g, '');
          var player = str.match(/\bvideoUrl = '(http[^']*)'/);
          var player_link = player && player[1];

          if (player_link) {
            network.clear();
            network.timeout(10000);
            network["native"](component.proxyLink(player_link, prox, prox_enc), function (str) {
              parse(str);
            }, function (a, c) {
              component.empty(network.errorDecode(a, c));
            }, false, {
              dataType: 'text',
              headers: headers
            });
          } else component.emptyForQuery(select_title);
        }, function (a, c) {
          component.empty(network.errorDecode(a, c));
        }, false, {
          dataType: 'text'
        });
      }

      this.extendChoice = function (saved) {
        Lampa.Arrays.extend(choice, saved, true);
      };
      /**
       * Сброс фильтра
       */


      this.reset = function () {
        component.reset();
        choice = {
          season: 0,
          voice: 0
        };
        filter();
        append(filtred());
        component.saveChoice(choice);
      };
      /**
       * Применить фильтр
       * @param {*} type
       * @param {*} a
       * @param {*} b
       */


      this.filter = function (type, a, b) {
        choice[a.stype] = b.index;
        component.reset();
        filter();
        append(filtred());
        component.saveChoice(choice);
      };
      /**
       * Уничтожить
       */


      this.destroy = function () {
        network.clear();
        extract = null;
      };

      /**
       * Построить фильтр
       */


      function filter() {
        filter_items = {
          season: [],
          voice: []
        };
        component.filter(filter_items, choice);
      }
      /**
       * Отфильтровать файлы
       * @returns array
       */


      function filtred() {
        var filtred = [];
        extract.forEach(function (data) {
          var file = data.sources && (prefer_dash && data.sources.shakadash && data.sources.shakadash.src || data.sources.hls && data.sources.hls.src) || '';
          filtred.push({
            title: data.title || data.comment || select_title,
            quality: '360p ~ 1080p',
            info: '',
            file: file
          });
        });
        return filtred;
      }
      /**
       * Найти поток
       * @param {Object} element
       * @returns string
       */


      function getFile(element) {
        return {
          file: element.file,
          quality: false,
          subtitles: false
        };
      }
      /**
       * Показать файлы
       */


      function append(items) {
        component.reset();
        var viewed = Lampa.Storage.cache('online_view', 5000, []);
        items.forEach(function (element) {
          var hash = Lampa.Utils.hash(object.movie.original_title + page_title + element.title);
          var view = Lampa.Timeline.view(hash);
          var item = Lampa.Template.get('online_mod', element);
          var hash_file = Lampa.Utils.hash(object.movie.original_title + page_title + element.title);
          element.timeline = view;
          item.append(Lampa.Timeline.render(view));

          if (Lampa.Timeline.details) {
            item.find('.online__quality').append(Lampa.Timeline.details(view, ' / '));
          }

          if (viewed.indexOf(hash_file) !== -1) item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
          item.on('hover:enter', function () {
            if (object.movie.id) Lampa.Favorite.add('history', object.movie, 100);
            var extra = getFile(element);

            if (extra.file) {
              var playlist = [];
              var first = {
                url: component.getDefaultQuality(extra.quality, extra.file),
                quality: component.renameQualityMap(extra.quality),
                subtitles: extra.subtitles,
                timeline: element.timeline,
                title: items.length > 1 ? element.title : select_title + (element.title == select_title ? '' : ' / ' + element.title)
              };

              if (items.length > 1) {
                items.forEach(function (elem) {
                  var ex = getFile(elem);
                  playlist.push({
                    url: component.getDefaultQuality(ex.quality, ex.file),
                    quality: component.renameQualityMap(ex.quality),
                    subtitles: ex.subtitles,
                    timeline: elem.timeline,
                    title: elem.title
                  });
                });
              } else {
                playlist.push(first);
              }

              if (playlist.length > 1) first.playlist = playlist;
              playWithoutPreroll(first, playlist);

              if (viewed.indexOf(hash_file) == -1) {
                viewed.push(hash_file);
                item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
                Lampa.Storage.set('online_view', viewed);
              }
            } else Lampa.Noty.show(Lampa.Lang.translate('online_mod_nolink'));
          });
          component.append(item);
          component.contextmenu({
            item: item,
            view: view,
            element: element,
            viewed: viewed,
            hash_file: hash_file,
            file: function file(call) {
              call(getFile(element));
            }
          });
        });
        component.start(true);
      }
    }

    redheadsound.initSettings = function (show_all) {
      var balanser_name = 'RedHeadSound';
      var component_name = 'online_mod_redheadsound';
      if (Lampa.SettingsApi.getComponent(component_name)) return;

      {
        var icon = "<svg><use xlink:href=\"#sprite-settings\"></use></svg>";
        Lampa.SettingsApi.addComponent({
          component: component_name,
          icon: icon,
          name: balanser_name
        });
        Lampa.SettingsApi.addParam({
          component: 'online_mod',
          param: {
            name: component_name + '_settings',
            type: 'button'
          },
          field: {
            name: "<div class=\"settings-folder\" style=\"padding:0!important\"><div style=\"width:1.8em;height:1.3em;padding-right:.5em\">".concat(icon, "</div><div style=\"font-size:1.3em\">").concat(balanser_name, "</div></div>")
          },
          onChange: function onChange() {
            Lampa.Settings.create(component_name, {
              onBack: function onBack() {
                Lampa.Settings.create('online_mod');
              }
            });
          }
        });
      }

      {
        Lampa.SettingsApi.addParam({
          component: component_name,
          param: {
            name: 'online_mod_proxy_redheadsound',
            type: 'trigger',
            "default": false
          },
          field: {
            name: Lampa.Lang.translate('online_mod_proxy_balanser') + ' ' + balanser_name
          }
        });
      }
    };

    redheadsound.hideSettings = function (body) {
      $('[data-component="online_mod_redheadsound"]', body).hide();
    };

    function cdnvideohub(component, _object, config) {
      var network = new Lampa.Reguest();
      var extract = {};
      var object = _object;
      var select_title = '';
      var prefer_http = Lampa.Storage.field('online_mod_prefer_http') === true;
      var prox = component.proxy('cdnvideohub');
      var user_agent = Utils.baseUserAgent();
      var prox_enc = '';

      if (prox) {
        prox_enc += 'param/Origin=/';
        prox_enc += 'param/Referer=/';
        prox_enc += 'param/User-Agent=' + encodeURIComponent(user_agent) + '/';
      }

      var embed = atob('aHR0cHM6Ly9wbGFwaS5jZG52aWRlb2h1Yi5jb20vYXBpL3YxL3BsYXllci9zdi8=');
      var filter_items = {};
      var choice = {
        season: 0,
        voice: 0,
        voice_name: ''
      };
      /**
       * Начать поиск
       * @param {Object} _object
       * @param {String} kinopoisk_id
       */

      this.search = function (_object, kinopoisk_id) {
        object = _object;
        select_title = object.search || object.movie.title;

        if (isNaN(kinopoisk_id)) {
          component.emptyForQuery(select_title);
          return;
        }

        var url = Lampa.Utils.addUrlComponent(embed + atob('cGxheWxpc3Q/cHViPTEyJmFnZ3I9a3A='), 'id=' + kinopoisk_id);
        network.clear();
        network.timeout(10000);
        network["native"](component.proxyLink(url, prox, prox_enc), function (json) {
          parse(json);
        }, function (a, c) {
          if (a.status == 500 && !a.responseText || a.status == 0 && a.statusText !== 'timeout') {
            parse(null);
          } else component.empty(network.errorDecode(a, c));
        });
      };

      this.extendChoice = function (saved) {
        Lampa.Arrays.extend(choice, saved, true);
      };
      /**
       * Сброс фильтра
       */


      this.reset = function () {
        component.reset();
        choice = {
          season: 0,
          voice: 0,
          voice_name: ''
        };
        filter();
        append(filtred());
        component.saveChoice(choice);
      };
      /**
       * Применить фильтр
       * @param {*} type
       * @param {*} a
       * @param {*} b
       */


      this.filter = function (type, a, b) {
        choice[a.stype] = b.index;
        if (a.stype == 'voice') choice.voice_name = filter_items.voice[b.index];
        component.reset();
        filter();
        append(filtred());
        component.saveChoice(choice);
      };
      /**
       * Уничтожить
       */


      this.destroy = function () {
        network.clear();
        extract = null;
      };

      function parse(json) {
        component.loading(false);

        if (json && json.items && json.items.length && json.items.forEach) {
          var seasons = [];
          var items = json.items;
          items.sort(function (a, b) {
            var cmp = (a.season || 0) - (b.season || 0);
            if (cmp) return cmp;
            cmp = (a.episode || 0) - (b.episode || 0);
            if (cmp) return cmp;
            if ((a.voiceStudio || a.voiceType || '') > (b.voiceStudio || b.voiceType || '')) return 1;
            if ((a.voiceStudio || a.voiceType || '') < (b.voiceStudio || b.voiceType || '')) return -1;
            cmp = (a.vkId || 0) - (b.vkId || 0);
            return cmp;
          });
          items.forEach(function (data) {
            if (data.season != null) {
              var s = seasons.filter(function (s) {
                return s.id === data.season;
              })[0];

              if (!s) {
                s = {
                  id: data.season,
                  title: Lampa.Lang.translate('torrent_serial_season') + ' ' + data.season,
                  voices: []
                };
                seasons.push(s);
              }

              var voice = data.voiceStudio || data.voiceType || '';
              if (s.voices.indexOf(voice) == -1) s.voices.push(voice);
            }
          });
          extract = {
            title_name: json.titleName || json.title_name || select_title,
            items: items,
            seasons: seasons
          };
          filter();
          append(filtred());
        } else component.emptyForQuery(select_title);
      }
      /**
       * Построить фильтр
       */


      function filter() {
        filter_items = {
          season: extract.seasons.map(function (s) {
            return s.title;
          }),
          voice: []
        };
        if (!filter_items.season[choice.season]) choice.season = 0;
        var s = extract.seasons[choice.season];
        if (s) filter_items.voice = s.voices;
        if (!filter_items.voice[choice.voice]) choice.voice = 0;

        if (choice.voice_name) {
          var inx = filter_items.voice.indexOf(choice.voice_name);
          if (inx == -1) choice.voice = 0;else if (inx !== choice.voice) {
            choice.voice = inx;
          }
        }

        component.filter(filter_items, choice);
      }
      /**
       * Отфильтровать файлы
       * @returns array
       */


      function filtred() {
        var filtred = [];

        if (extract.seasons.length) {
          var season_id = extract.seasons[choice.season] && extract.seasons[choice.season].id;
          extract.items.forEach(function (data) {
            var voice = data.voiceStudio || data.voiceType || '';

            if (data.season == season_id && voice == filter_items.voice[choice.voice]) {
              filtred.push({
                title: component.formatEpisodeTitle(season_id, data.episode),
                quality: '360p ~ 1080p',
                info: ' / ' + Lampa.Utils.shortText(voice, 50) + (data.vkId ? ' / id: ' + data.vkId : ''),
                data_id: data.vkId,
                season: '' + season_id,
                episode: data.episode,
                media: data
              });
            }
          });
        } else {
          extract.items.forEach(function (data) {
            filtred.push({
              title: data.voiceStudio || data.voiceType || extract.title_name,
              quality: '360p ~ 1080p',
              info: data.vkId ? ' / id: ' + data.vkId : '',
              data_id: data.vkId,
              media: data
            });
          });
        }

        return filtred;
      }
      /**
       * Получить потоки
       * @param {String} str
       * @returns array
       */


      function extractItems(sources) {
        if (!sources) return [];
        var items = [];
        /* 4K и 2K перепутаны */

        if (sources.mpeg2kUrl) {
          items.push({
            label: '4K',
            quality: 2160,
            file: sources.mpeg2kUrl
          });
        }

        if (sources.mpeg4kUrl) {
          items.push({
            label: '2K',
            quality: 1440,
            file: sources.mpeg4kUrl
          });
        }

        if (sources.mpegQhdUrl) {
          items.push({
            label: '1440p',
            quality: 1440,
            file: sources.mpegQhdUrl
          });
        }

        if (sources.mpegFullHdUrl) {
          items.push({
            label: '1080p',
            quality: 1080,
            file: sources.mpegFullHdUrl
          });
        }

        if (sources.mpegHighUrl) {
          items.push({
            label: '720p',
            quality: 720,
            file: sources.mpegHighUrl
          });
        }

        if (sources.mpegMediumUrl) {
          items.push({
            label: '480p',
            quality: 480,
            file: sources.mpegMediumUrl
          });
        }

        if (sources.mpegLowUrl) {
          items.push({
            label: '360p',
            quality: 360,
            file: sources.mpegLowUrl
          });
        }

        if (sources.mpegLowestUrl) {
          items.push({
            label: '240p',
            quality: 240,
            file: sources.mpegLowestUrl
          });
        }

        if (sources.mpegTinyUrl) {
          items.push({
            label: '144p',
            quality: 144,
            file: sources.mpegTinyUrl
          });
        }

        if (!items.length && sources.hlsUrl) {
          items.push({
            label: 'HLS',
            quality: NaN,
            file: sources.hlsUrl
          });
        }

        items.forEach(function (item) {
          item.file = component.proxyLink(component.fixLinkProtocol(item.file, prefer_http, true), prox, prox_enc);
        });
        return items;
      }
      /**
       * Получить поток
       * @param {*} element
       */


      function getStream(element, call, error) {
        if (element.stream) return call(element);
        if (!element.data_id) return error();
        var url = embed + 'video/' + element.data_id;
        network.clear();
        network.timeout(10000);
        network["native"](component.proxyLink(url, prox, prox_enc), function (json) {
          if (json && json.sources) {
            var file = '',
                quality = false;
            var items = extractItems(json.sources);

            if (items && items.length) {
              file = items[0].file;
              quality = {};
              items.forEach(function (item) {
                quality[item.label] = item.file;
              });
            }

            if (file) {
              element.stream = file;
              element.qualitys = quality;
              call(element);
            } else error();
          } else error();
        }, function (a, c) {
          error();
        });
      }
      /**
       * Показать файлы
       */


      function append(items) {
        component.reset();
        var viewed = Lampa.Storage.cache('online_view', 5000, []);
        items.forEach(function (element) {
          var hash = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title].join('') : object.movie.original_title);
          var view = component.watchView(element, hash, items);
          var item = Lampa.Template.get('online_mod', element);
          var hash_file = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title, filter_items.voice[choice.voice]].join('') : object.movie.original_title + element.data_id);
          element.timeline = view;
          item.append(Lampa.Timeline.render(view));

          if (Lampa.Timeline.details) {
            item.find('.online__quality').append(Lampa.Timeline.details(view, ' / '));
          }

          if (viewed.indexOf(hash_file) !== -1) item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
          item.on('hover:enter', function () {
            if (element.loading) return;
            if (object.movie.id) Lampa.Favorite.add('history', object.movie, 100);
            element.loading = true;
            getStream(element, function (element) {
              element.loading = false;
              var first = {
                anime_skip: skipOf(element),
                url: component.getDefaultQuality(element.qualitys, element.stream),
                quality: component.renameQualityMap(element.qualitys),
                timeline: element.timeline,
                title: element.season ? element.title : select_title + (element.title == select_title ? '' : ' / ' + element.title)
              };

              if (element.season && Lampa.Platform.version) {
                var playlist = [];
                items.forEach(function (elem) {
                  if (elem == element) {
                    playlist.push(first);
                  } else {
                    var cell = {
                      anime_skip: skipOf(elem),
                      url: function url(call) {
                        getStream(elem, function (elem) {
                          cell.url = component.getDefaultQuality(elem.qualitys, elem.stream);
                          cell.quality = component.renameQualityMap(elem.qualitys);
                          call();
                        }, function () {
                          cell.url = '';
                          call();
                        });
                      },
                      timeline: elem.timeline,
                      title: elem.title
                    };
                    playlist.push(cell);
                  }
                });
                playWithoutPreroll(first, playlist);
              } else {
                playWithoutPreroll(first, [first]);
              }

              if (viewed.indexOf(hash_file) == -1) {
                viewed.push(hash_file);
                item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
                Lampa.Storage.set('online_view', viewed);
              }
            }, function () {
              element.loading = false;
              Lampa.Noty.show(Lampa.Lang.translate('online_mod_nolink'));
            });
          });
          component.append(item);
          component.contextmenu({
            item: item,
            view: view,
            element: element,
            viewed: viewed,
            hash_file: hash_file,
            file: function file(call) {
              getStream(element, function (element) {
                call({
                  file: element.stream,
                  quality: element.qualitys
                });
              }, function () {
                Lampa.Noty.show(Lampa.Lang.translate('online_mod_nolink'));
              });
            }
          });
        });
        component.start(true);
      }
    }

    cdnvideohub.initSettings = function (show_all) {
      var balanser_name = 'CDNVideoHub';
      var component_name = 'online_mod_cdnvideohub';
      if (Lampa.SettingsApi.getComponent(component_name)) return;

      if (show_all) {
        var icon = "<svg><use xlink:href=\"#sprite-settings\"></use></svg>";
        Lampa.SettingsApi.addComponent({
          component: component_name,
          icon: icon,
          name: balanser_name
        });
        Lampa.SettingsApi.addParam({
          component: 'online_mod',
          param: {
            name: component_name + '_settings',
            type: 'button'
          },
          field: {
            name: "<div class=\"settings-folder\" style=\"padding:0!important\"><div style=\"width:1.8em;height:1.3em;padding-right:.5em\">".concat(icon, "</div><div style=\"font-size:1.3em\">").concat(balanser_name, "</div></div>")
          },
          onChange: function onChange() {
            Lampa.Settings.create(component_name, {
              onBack: function onBack() {
                Lampa.Settings.create('online_mod');
              }
            });
          }
        });
      }

      if (show_all) {
        Lampa.SettingsApi.addParam({
          component: component_name,
          param: {
            name: 'online_mod_proxy_cdnvideohub',
            type: 'trigger',
            "default": false
          },
          field: {
            name: Lampa.Lang.translate('online_mod_proxy_balanser') + ' ' + balanser_name
          }
        });
      }
    };

    cdnvideohub.hideSettings = function (body) {
      $('[data-component="online_mod_cdnvideohub"]', body).hide();
    };

    function anilibria(component, _object, config) {
      var network = new Lampa.Reguest();
      var extract = {};
      var object = _object;
      var select_title = '';
      var prox = component.proxy('anilibria');
      var embed = 'https://api.anilibria.tv/v3/';
      var filter_items = {};
      var choice = {
        season: 0,
        voice: 0
      };
      /**
       * Поиск
       * @param {Object} _object
       */

      this.search = function (_object, kinopoisk_id, data) {
        var _this = this;

        object = _object;
        select_title = object.search || object.movie.title;
        if (this.wait_similars && data && data[0].is_similars) return getRelease(data[0]);
        var search_year = object.search_date;
        var orig_titles = [];

        if (object.movie.alternative_titles && object.movie.alternative_titles.results) {
          orig_titles = object.movie.alternative_titles.results.map(function (t) {
            return t.title;
          });
        }

        if (object.movie.original_title) orig_titles.push(object.movie.original_title);
        if (object.movie.original_name) orig_titles.push(object.movie.original_name);

        var display = function display(items) {
          if (items && items.length && items.forEach) {
            var is_sure = false;
            items.forEach(function (c) {
              c.ru_title = c.names && c.names.ru;
              c.en_title = c.names && c.names.en;
              c.alt_title = c.names && c.names.alternative;
              c.year = c.season && c.season.year && parseInt(c.season.year) || 0;
            });
            var cards = items;

            if (cards.length) {
              if (orig_titles.length) {
                var tmp = cards.filter(function (c) {
                  return component.containsAnyTitle([c.en_title, c.ru_title, c.alt_title], orig_titles);
                });

                if (tmp.length) {
                  cards = tmp;
                  is_sure = true;
                }
              }

              if (select_title) {
                var _tmp = cards.filter(function (c) {
                  return component.containsAnyTitle([c.ru_title, c.en_title, c.alt_title], [select_title]);
                });

                if (_tmp.length) {
                  cards = _tmp;
                  is_sure = true;
                }
              }

              if (cards.length > 1 && search_year) {
                var _tmp2 = cards.filter(function (c) {
                  return c.year == search_year;
                });

                if (!_tmp2.length) _tmp2 = cards.filter(function (c) {
                  return c.year && c.year > search_year - 2 && c.year < search_year + 2;
                });
                if (_tmp2.length) cards = _tmp2;
              }
            }

            if (cards.length == 1 && is_sure) {
              if (search_year && cards[0].year) {
                is_sure = cards[0].year > search_year - 2 && cards[0].year < search_year + 2;
              }

              if (is_sure) {
                is_sure = false;

                if (orig_titles.length) {
                  is_sure |= component.equalAnyTitle([cards[0].en_title, cards[0].ru_title, cards[0].alt_title], orig_titles);
                }

                if (select_title) {
                  is_sure |= component.equalAnyTitle([cards[0].ru_title, cards[0].en_title, cards[0].alt_title], [select_title]);
                }
              }
            }

            if (cards.length == 1 && is_sure) {
              getRelease(cards[0]);
            } else {
              _this.wait_similars = true;
              items.forEach(function (c) {
                c.is_similars = true;

                if (!(c.type && c.type.string === 'MOVIE')) {
                  c.episodes_count = c.player && c.player.episodes && c.player.episodes.last;
                }
              });
              component.similars(items);
              component.loading(false);
            }
          } else component.emptyForQuery(select_title);
        };

        var url = embed + 'title/search';
        url = Lampa.Utils.addUrlComponent(url, 'filter=names,season,type,player');
        url = Lampa.Utils.addUrlComponent(url, 'limit=20');
        url = Lampa.Utils.addUrlComponent(url, 'search=' + encodeURIComponent(select_title));
        network.clear();
        network.timeout(1000 * 30);
        network.silent(component.proxyLink(url, prox), function (json) {
          display(json && json.list);
        }, function (a, c) {
          component.empty(network.errorDecode(a, c));
        });
      };

      this.extendChoice = function (saved) {
        Lampa.Arrays.extend(choice, saved, true);
      };
      /**
       * Сброс фильтра
       */


      this.reset = function () {
        component.reset();
        choice = {
          season: 0,
          voice: 0
        };
        filter();
        append(filtred());
        component.saveChoice(choice);
      };
      /**
       * Применить фильтр
       * @param {*} type
       * @param {*} a
       * @param {*} b
       */


      this.filter = function (type, a, b) {
        choice[a.stype] = b.index;
        component.reset();
        filter();
        append(filtred());
        component.saveChoice(choice);
      };
      /**
       * Уничтожить
       */


      this.destroy = function () {
        network.clear();
        extract = null;
      };

      function getRelease(json) {
        if (json.player && json.player.host && json.player.list && Object.keys(json.player.list).length) {
          success(json);
        } else {
          component.emptyForQuery(select_title);
          Lampa.Noty.show(Lampa.Lang.translate('online_mod_blockedlink_copyright'));
        }
      }

      function success(json) {
        component.loading(false);
        extract = json;
        filter();
        append(filtred());
      }
      /**
       * Построить фильтр
       */


      function filter() {
        filter_items = {
          season: [],
          voice: []
        };
        component.filter(filter_items, choice);
      }
      /**
       * Получить потоки
       * @param {String} host
       * @param {Object} hls
       * @returns array
       */


      function extractItems(host, hls) {
        var items = [];

        if (hls) {
          if (hls.fhd) {
            items.push({
              label: '1080p',
              quality: 1080,
              file: host + hls.fhd
            });
          }

          if (hls.hd) {
            items.push({
              label: '720p',
              quality: 720,
              file: host + hls.hd
            });
          }

          if (hls.sd) {
            items.push({
              label: '480p',
              quality: 480,
              file: host + hls.sd
            });
          }
        }

        return items;
      }
      /**
       * Отфильтровать файлы
       * @returns array
       */


      function filtred() {
        var filtred = [];

        if (extract.player && extract.player.host && extract.player.list && Object.keys(extract.player.list).length) {
          var host = 'https://' + extract.player.host;

          if (extract.type && extract.type.string === 'MOVIE' && Object.keys(extract.player.list).length === 1) {
            for (var ID in extract.player.list) {
              var episode = extract.player.list[ID];
              var items = extractItems(host, episode.hls);
              filtred.push({
                title: extract.ru_title || extract.en_title || select_title,
                orig_title: extract.en_title || extract.ru_title || select_title,
                quality: items[0] ? items[0].label : '360p ~ 1080p',
                info: '',
                media: items
              });
            }
          } else {
            for (var _ID in extract.player.list) {
              var _episode = extract.player.list[_ID];

              var _items = extractItems(host, _episode.hls);

              filtred.push({
                title: component.formatEpisodeTitle(null, _episode.episode, _episode.name),
                orig_title: extract.en_title || extract.ru_title || select_title,
                quality: _items[0] ? _items[0].label : '360p ~ 1080p',
                info: '',
                season: 1,
                episode: _episode.episode,
                // a release has its own numbering (season 2 is its own "season 1"): matched from the menu only
                watch_info: { src: 'anilibria:' + (extract.id || extract.code || extract.en_title || extract.ru_title || '') },
                media: _items
              });
            }
          }
        }

        return filtred;
      }
      /**
       * Найти поток
       * @param {Object} element
       * @returns string
       */


      function getFile(element) {
        var file = '';
        var quality = false;
        var items = element.media;

        if (items && items.length) {
          file = items[0].file;
          quality = {};
          items.forEach(function (item) {
            quality[item.label] = item.file;
          });
        }

        return {
          file: file,
          quality: quality
        };
      }
      /**
       * Показать файлы
       */


      function append(items) {
        component.reset();
        var viewed = Lampa.Storage.cache('online_view', 5000, []);
        items.forEach(function (element) {
          var hash = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title, element.orig_title].join('') : object.movie.original_title + element.orig_title);
          var view = component.watchView(element, hash, items);
          var item = Lampa.Template.get('online_mod', element);
          var hash_file = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title, element.orig_title].join('') : object.movie.original_title + element.orig_title + element.title);
          element.timeline = view;
          item.append(Lampa.Timeline.render(view));

          if (Lampa.Timeline.details) {
            item.find('.online__quality').append(Lampa.Timeline.details(view, ' / '));
          }

          if (viewed.indexOf(hash_file) !== -1) item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
          item.on('hover:enter', function () {
            if (object.movie.id) Lampa.Favorite.add('history', object.movie, 100);
            var extra = getFile(element);

            if (extra.file) {
              var playlist = [];
              var first = {
                url: component.getDefaultQuality(extra.quality, extra.file),
                quality: component.renameQualityMap(extra.quality),
                timeline: element.timeline,
                title: element.title
              };

              if (element.season) {
                items.forEach(function (elem) {
                  var ex = getFile(elem);
                  playlist.push({
                    url: component.getDefaultQuality(ex.quality, ex.file),
                    quality: component.renameQualityMap(ex.quality),
                    timeline: elem.timeline,
                    title: elem.title
                  });
                });
              } else {
                playlist.push(first);
              }

              if (playlist.length > 1) first.playlist = playlist;
              playWithoutPreroll(first, playlist);

              if (viewed.indexOf(hash_file) == -1) {
                viewed.push(hash_file);
                item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
                Lampa.Storage.set('online_view', viewed);
              }
            } else Lampa.Noty.show(Lampa.Lang.translate('online_mod_nolink'));
          });
          component.append(item);
          component.contextmenu({
            item: item,
            view: view,
            element: element,
            viewed: viewed,
            hash_file: hash_file,
            file: function file(call) {
              call(getFile(element));
            }
          });
        });
        component.start(true);
      }
    }

    anilibria.initSettings = function (show_all) {
      var balanser_name = 'AniLibria';
      var component_name = 'online_mod_anilibria';
      if (Lampa.SettingsApi.getComponent(component_name)) return;

      {
        var icon = "<svg><use xlink:href=\"#sprite-settings\"></use></svg>";
        Lampa.SettingsApi.addComponent({
          component: component_name,
          icon: icon,
          name: balanser_name
        });
        Lampa.SettingsApi.addParam({
          component: 'online_mod',
          param: {
            name: component_name + '_settings',
            type: 'button'
          },
          field: {
            name: "<div class=\"settings-folder\" style=\"padding:0!important\"><div style=\"width:1.8em;height:1.3em;padding-right:.5em\">".concat(icon, "</div><div style=\"font-size:1.3em\">").concat(balanser_name, "</div></div>")
          },
          onChange: function onChange() {
            Lampa.Settings.create(component_name, {
              onBack: function onBack() {
                Lampa.Settings.create('online_mod');
              }
            });
          }
        });
      }

      {
        Lampa.SettingsApi.addParam({
          component: component_name,
          param: {
            name: 'online_mod_proxy_anilibria',
            type: 'trigger',
            "default": false
          },
          field: {
            name: Lampa.Lang.translate('online_mod_proxy_balanser') + ' ' + balanser_name
          }
        });
      }
    };

    anilibria.hideSettings = function (body) {
      $('[data-component="online_mod_anilibria"]', body).hide();
    };

    function anilibria2(component, _object, config) {
      var network = new Lampa.Reguest();
      var extract = {};
      var object = _object;
      var select_title = '';
      var prox = component.proxy('anilibria2');
      var embed = 'https://api.anilibria.app/api/v1/';
      var filter_items = {};
      var choice = {
        season: 0,
        voice: 0
      };
      /**
       * Поиск
       * @param {Object} _object
       */

      this.search = function (_object, kinopoisk_id, data) {
        var _this = this;

        object = _object;
        select_title = object.search || object.movie.title;
        if (this.wait_similars && data && data[0].is_similars) return getRelease(data[0]);
        var search_year = object.search_date;
        var orig_titles = [];

        if (object.movie.alternative_titles && object.movie.alternative_titles.results) {
          orig_titles = object.movie.alternative_titles.results.map(function (t) {
            return t.title;
          });
        }

        if (object.movie.original_title) orig_titles.push(object.movie.original_title);
        if (object.movie.original_name) orig_titles.push(object.movie.original_name);

        var display = function display(items) {
          if (items && items.length && items.forEach) {
            var is_sure = false;
            items.forEach(function (c) {
              c.ru_title = c.name && c.name.main;
              c.en_title = c.name && c.name.english;
              c.alt_title = c.name && c.name.alternative;
            });
            var cards = items;

            if (cards.length) {
              if (orig_titles.length) {
                var tmp = cards.filter(function (c) {
                  return component.containsAnyTitle([c.en_title, c.ru_title, c.alt_title], orig_titles);
                });

                if (tmp.length) {
                  cards = tmp;
                  is_sure = true;
                }
              }

              if (select_title) {
                var _tmp = cards.filter(function (c) {
                  return component.containsAnyTitle([c.ru_title, c.en_title, c.alt_title], [select_title]);
                });

                if (_tmp.length) {
                  cards = _tmp;
                  is_sure = true;
                }
              }

              if (cards.length > 1 && search_year) {
                var _tmp2 = cards.filter(function (c) {
                  return c.year == search_year;
                });

                if (!_tmp2.length) _tmp2 = cards.filter(function (c) {
                  return c.year && c.year > search_year - 2 && c.year < search_year + 2;
                });
                if (_tmp2.length) cards = _tmp2;
              }
            }

            if (cards.length == 1 && is_sure) {
              if (search_year && cards[0].year) {
                is_sure = cards[0].year > search_year - 2 && cards[0].year < search_year + 2;
              }

              if (is_sure) {
                is_sure = false;

                if (orig_titles.length) {
                  is_sure |= component.equalAnyTitle([cards[0].en_title, cards[0].ru_title, cards[0].alt_title], orig_titles);
                }

                if (select_title) {
                  is_sure |= component.equalAnyTitle([cards[0].ru_title, cards[0].en_title, cards[0].alt_title], [select_title]);
                }
              }
            }

            if (cards.length == 1 && is_sure) {
              getRelease(cards[0]);
            } else {
              _this.wait_similars = true;
              items.forEach(function (c) {
                c.is_similars = true;

                if (!(c.type && c.type.value === 'MOVIE')) {
                  c.episodes_count = c.episodes_total;
                }
              });
              component.similars(items);
              component.loading(false);
            }
          } else component.emptyForQuery(select_title);
        };

        var url = embed + 'app/search/releases';
        url = Lampa.Utils.addUrlComponent(url, 'query=' + encodeURIComponent(select_title));
        network.clear();
        network.timeout(1000 * 15);
        network.silent(component.proxyLink(url, prox), function (json) {
          display(json);
        }, function (a, c) {
          component.empty(network.errorDecode(a, c));
        });
      };

      this.extendChoice = function (saved) {
        Lampa.Arrays.extend(choice, saved, true);
      };
      /**
       * Сброс фильтра
       */


      this.reset = function () {
        component.reset();
        choice = {
          season: 0,
          voice: 0
        };
        filter();
        append(filtred());
        component.saveChoice(choice);
      };
      /**
       * Применить фильтр
       * @param {*} type
       * @param {*} a
       * @param {*} b
       */


      this.filter = function (type, a, b) {
        choice[a.stype] = b.index;
        component.reset();
        filter();
        append(filtred());
        component.saveChoice(choice);
      };
      /**
       * Уничтожить
       */


      this.destroy = function () {
        network.clear();
        extract = null;
      };

      function getRelease(json) {
        var url = embed + 'anime/releases/' + json.id;
        network.clear();
        network.timeout(1000 * 15);
        network.silent(component.proxyLink(url, prox), function (json) {
          if (json && json.episodes && json.episodes.length) {
            json.ru_title = json.name && json.name.main;
            json.en_title = json.name && json.name.english;
            json.alt_title = json.name && json.name.alternative;
            success(json);
          } else component.emptyForQuery(select_title);

          if (json && json.is_blocked_by_copyrights) Lampa.Noty.show(Lampa.Lang.translate('online_mod_blockedlink_copyright'));else if (json && json.is_blocked_by_geo) Lampa.Noty.show(Lampa.Lang.translate('online_mod_blockedlink'));
        }, function (a, c) {
          component.empty(network.errorDecode(a, c));
        });
      }

      function success(json) {
        component.loading(false);
        extract = json;
        filter();
        append(filtred());
      }
      /**
       * Построить фильтр
       */


      function filter() {
        filter_items = {
          season: [],
          voice: []
        };
        component.filter(filter_items, choice);
      }
      /**
       * Получить потоки
       * @param {String} host
       * @param {Object} hls
       * @returns array
       */


      function extractItems(episode) {
        var items = [];

        if (episode.hls_1080) {
          items.push({
            label: '1080p',
            quality: 1080,
            file: episode.hls_1080
          });
        }

        if (episode.hls_720) {
          items.push({
            label: '720p',
            quality: 720,
            file: episode.hls_720
          });
        }

        if (episode.hls_480) {
          items.push({
            label: '480p',
            quality: 480,
            file: episode.hls_480
          });
        }

        return items;
      }
      /**
       * Отфильтровать файлы
       * @returns array
       */


      function filtred() {
        var filtred = [];

        if (extract.episodes && extract.episodes.length) {
          if (extract.type && extract.type.value === 'MOVIE' && extract.episodes.length === 1) {
            extract.episodes.forEach(function (episode) {
              var items = extractItems(episode);
              filtred.push({
                title: extract.ru_title || extract.en_title || select_title,
                orig_title: extract.en_title || extract.ru_title || select_title,
                quality: items[0] ? items[0].label : '360p ~ 1080p',
                info: '',
                media: items
              });
            });
          } else {
            extract.episodes.forEach(function (episode) {
              var items = extractItems(episode);
              filtred.push({
                title: component.formatEpisodeTitle(null, episode.ordinal, episode.name),
                orig_title: extract.en_title || extract.ru_title || select_title,
                quality: items[0] ? items[0].label : '360p ~ 1080p',
                info: '',
                season: 1,
                episode: episode.ordinal,
                watch_info: { src: 'anilibria2:' + (extract.id || extract.alias || extract.en_title || extract.ru_title || '') },
                media: items
              });
            });
          }
        }

        return filtred;
      }
      /**
       * Найти поток
       * @param {Object} element
       * @returns string
       */


      function getFile(element) {
        var file = '';
        var quality = false;
        var items = element.media;

        if (items && items.length) {
          file = items[0].file;
          quality = {};
          items.forEach(function (item) {
            quality[item.label] = item.file;
          });
        }

        return {
          file: file,
          quality: quality
        };
      }
      /**
       * Показать файлы
       */


      function append(items) {
        component.reset();
        var viewed = Lampa.Storage.cache('online_view', 5000, []);
        items.forEach(function (element) {
          var hash = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title, element.orig_title].join('') : object.movie.original_title + element.orig_title);
          var view = component.watchView(element, hash, items);
          var item = Lampa.Template.get('online_mod', element);
          var hash_file = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title, element.orig_title].join('') : object.movie.original_title + element.orig_title + element.title);
          element.timeline = view;
          item.append(Lampa.Timeline.render(view));

          if (Lampa.Timeline.details) {
            item.find('.online__quality').append(Lampa.Timeline.details(view, ' / '));
          }

          if (viewed.indexOf(hash_file) !== -1) item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
          item.on('hover:enter', function () {
            if (object.movie.id) Lampa.Favorite.add('history', object.movie, 100);
            var extra = getFile(element);

            if (extra.file) {
              var playlist = [];
              var first = {
                anime_skip: skipOf(element),
                url: component.getDefaultQuality(extra.quality, extra.file),
                quality: component.renameQualityMap(extra.quality),
                timeline: element.timeline,
                title: element.title
              };

              if (element.season) {
                items.forEach(function (elem) {
                  var ex = getFile(elem);
                  playlist.push({
                    anime_skip: skipOf(elem),
                    url: component.getDefaultQuality(ex.quality, ex.file),
                    quality: component.renameQualityMap(ex.quality),
                    timeline: elem.timeline,
                    title: elem.title
                  });
                });
              } else {
                playlist.push(first);
              }

              if (playlist.length > 1) first.playlist = playlist;
              playWithoutPreroll(first, playlist);

              if (viewed.indexOf(hash_file) == -1) {
                viewed.push(hash_file);
                item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
                Lampa.Storage.set('online_view', viewed);
              }
            } else Lampa.Noty.show(Lampa.Lang.translate('online_mod_nolink'));
          });
          component.append(item);
          component.contextmenu({
            item: item,
            view: view,
            element: element,
            viewed: viewed,
            hash_file: hash_file,
            file: function file(call) {
              call(getFile(element));
            }
          });
        });
        component.start(true);
      }
    }

    anilibria2.initSettings = function (show_all) {
      var balanser_name = 'AniLibria.top';
      var component_name = 'online_mod_anilibria2';
      if (Lampa.SettingsApi.getComponent(component_name)) return;

      {
        var icon = "<svg><use xlink:href=\"#sprite-settings\"></use></svg>";
        Lampa.SettingsApi.addComponent({
          component: component_name,
          icon: icon,
          name: balanser_name
        });
        Lampa.SettingsApi.addParam({
          component: 'online_mod',
          param: {
            name: component_name + '_settings',
            type: 'button'
          },
          field: {
            name: "<div class=\"settings-folder\" style=\"padding:0!important\"><div style=\"width:1.8em;height:1.3em;padding-right:.5em\">".concat(icon, "</div><div style=\"font-size:1.3em\">").concat(balanser_name, "</div></div>")
          },
          onChange: function onChange() {
            Lampa.Settings.create(component_name, {
              onBack: function onBack() {
                Lampa.Settings.create('online_mod');
              }
            });
          }
        });
      }

      {
        Lampa.SettingsApi.addParam({
          component: component_name,
          param: {
            name: 'online_mod_proxy_anilibria2',
            type: 'trigger',
            "default": false
          },
          field: {
            name: Lampa.Lang.translate('online_mod_proxy_balanser') + ' ' + balanser_name
          }
        });
      }
    };

    anilibria2.hideSettings = function (body) {
      $('[data-component="online_mod_anilibria2"]', body).hide();
    };

    function animelib(component, _object, config) {
      var network = new Lampa.Reguest();
      var extract = {};
      var object = _object;
      var select_title = '';
      var prox = component.proxy('animelib');
      var host = 'https://anilib.me';
      var ref = host + '/';
      var user_agent = Utils.baseUserAgent();
      var embed = 'https://api2.mangalib.me/api/';
      var prox_enc = '';

      if (prox) {
        prox_enc += 'param/Origin=' + encodeURIComponent(host) + '/';
        prox_enc += 'param/Referer=' + encodeURIComponent(ref) + '/';
        prox_enc += 'param/User-Agent=' + encodeURIComponent(user_agent) + '/';
      }

      var servers = [{
        name: Lampa.Lang.translate('online_mod_server_main'),
        url: 'https://video1.anilib.me/.%D0%B0s/'
      }, {
        name: Lampa.Lang.translate('online_mod_server_reserve') + ' 1',
        url: 'https://video2.anilib.me/.%D0%B0s/'
      }, {
        name: Lampa.Lang.translate('online_mod_server_reserve') + ' 2',
        url: 'https://video3.anilib.me/.%D0%B0s/'
      }];
      var filter_items = {};
      var choice = {
        season: 0,
        voice: 0,
        voice_name: '',
        server: 0
      };
      /**
       * Поиск
       * @param {Object} _object
       */

      this.search = function (_object, kinopoisk_id, data) {
        var _this = this;

        object = _object;
        select_title = object.search || object.movie.title;
        if (this.wait_similars && data && data[0].is_similars) return getEpisodes(data[0]);
        var search_year = object.search_date;
        var orig_titles = [];

        if (object.movie.alternative_titles && object.movie.alternative_titles.results) {
          orig_titles = object.movie.alternative_titles.results.map(function (t) {
            return t.title;
          });
        }

        if (object.movie.original_title) orig_titles.push(object.movie.original_title);
        if (object.movie.original_name) orig_titles.push(object.movie.original_name);

        var display = function display(items) {
          if (items && items.length && items.forEach) {
            var is_sure = false;
            items.forEach(function (c) {
              c.orig_title = c.name;
              c.ru_title = c.rus_name;
              c.en_title = c.eng_name;
              var year = c.releaseDate || '0000';
              c.year = parseInt((year + '').slice(0, 4));
            });
            var cards = items;

            if (cards.length) {
              if (orig_titles.length) {
                var tmp = cards.filter(function (c) {
                  return component.containsAnyTitle([c.orig_title, c.en_title, c.ru_title], orig_titles);
                });

                if (tmp.length) {
                  cards = tmp;
                  is_sure = true;
                }
              }

              if (select_title) {
                var _tmp = cards.filter(function (c) {
                  return component.containsAnyTitle([c.ru_title, c.en_title, c.orig_title], [select_title]);
                });

                if (_tmp.length) {
                  cards = _tmp;
                  is_sure = true;
                }
              }

              if (cards.length > 1 && search_year) {
                var _tmp2 = cards.filter(function (c) {
                  return c.year == search_year;
                });

                if (!_tmp2.length) _tmp2 = cards.filter(function (c) {
                  return c.year && c.year > search_year - 2 && c.year < search_year + 2;
                });
                if (_tmp2.length) cards = _tmp2;
              }
            }

            if (cards.length == 1 && is_sure) {
              if (search_year && cards[0].year) {
                is_sure = cards[0].year > search_year - 2 && cards[0].year < search_year + 2;
              }

              if (is_sure) {
                is_sure = false;

                if (orig_titles.length) {
                  is_sure |= component.equalAnyTitle([cards[0].orig_title, cards[0].en_title, cards[0].ru_title], orig_titles);
                }

                if (select_title) {
                  is_sure |= component.equalAnyTitle([cards[0].ru_title, cards[0].en_title, cards[0].orig_title], [select_title]);
                }
              }
            }

            if (cards.length == 1 && is_sure) {
              getEpisodes(cards[0]);
            } else {
              _this.wait_similars = true;
              items.forEach(function (c) {
                c.is_similars = true;
              });
              component.similars(items);
              component.loading(false);
            }
          } else component.emptyForQuery(select_title);
        };

        var url = embed + 'anime?fields[]=rate_avg&fields[]=rate&fields[]=releaseDate';
        url = Lampa.Utils.addUrlComponent(url, 'q=' + encodeURIComponent(select_title));
        network.clear();
        network.timeout(1000 * 15);
        network.silent(component.proxyLink(url, prox, prox_enc), function (json) {
          display(json && json.data);
        }, function (a, c) {
          component.empty(network.errorDecode(a, c));
        });
      };

      this.extendChoice = function (saved) {
        Lampa.Arrays.extend(choice, saved, true);
      };
      /**
       * Сброс фильтра
       */


      this.reset = function () {
        component.reset();
        choice = {
          season: 0,
          voice: 0,
          voice_name: '',
          server: 0
        };
        filter();
        append(filtred());
        component.saveChoice(choice);
      };
      /**
       * Применить фильтр
       * @param {*} type
       * @param {*} a
       * @param {*} b
       */


      this.filter = function (type, a, b) {
        choice[a.stype] = b.index;
        if (a.stype == 'voice') choice.voice_name = filter_items.voice[b.index];
        component.reset();
        filter();
        append(filtred());
        component.saveChoice(choice);
      };
      /**
       * Уничтожить
       */


      this.destroy = function () {
        network.clear();
        extract = null;
      };

      function getEpisodes(json) {
        var url = embed + 'episodes';
        url = Lampa.Utils.addUrlComponent(url, 'anime_id=' + encodeURIComponent(json.slug_url));
        network.clear();
        network.timeout(1000 * 15);
        network.silent(component.proxyLink(url, prox, prox_enc), function (episodes) {
          if (episodes && episodes.data && episodes.data.length) {
            json.episodes = episodes.data;
            getPlayers(json.episodes[0], function () {
              if (json.episodes[0].players && json.episodes[0].players.length) success(json);else component.emptyForQuery(select_title);
            });
          } else component.emptyForQuery(select_title);
        }, function (a, c) {
          component.empty(network.errorDecode(a, c));
        });
      }

      function getPlayers(episode, callback) {
        if (episode.players) {
          callback();
          return;
        }

        var url = embed + 'episodes/' + episode.id;
        network.clear();
        network.timeout(1000 * 15);
        network.silent(component.proxyLink(url, prox, prox_enc), function (json) {
          if (json && json.data && json.data.players) {
            episode.players = json.data.players.filter(function (p) {
              return p.player === 'Animelib';
            });
          }

          callback();
        }, function (a, c) {
          callback();
        });
      }

      function success(json) {
        component.loading(false);
        extract = json;
        extract.is_film = extract.episodes && extract.episodes.length === 1 && extract.type && ['Фильм', 'Неизвестный'].indexOf(extract.type.label) !== -1;
        filter();
        append(filtred());
      }
      /**
       * Построить фильтр
       */


      function filter() {
        filter_items = {
          season: [],
          voice: [],
          voice_info: [],
          server: servers.map(function (s) {
            return s.name;
          })
        };

        if (!extract.is_film) {
          extract.episodes.forEach(function (e) {
            if (e.players) {
              e.players.forEach(function (p) {
                if (p.team && !filter_items.voice_info.some(function (v) {
                  return v.id == p.team.id;
                })) {
                  filter_items.voice.push(p.team.name);
                  filter_items.voice_info.push(p.team);
                }
              });
            }
          });
        }

        if (!filter_items.voice[choice.voice]) choice.voice = 0;

        if (choice.voice_name) {
          var inx = filter_items.voice.indexOf(choice.voice_name);
          if (inx == -1) choice.voice = 0;else if (inx !== choice.voice) {
            choice.voice = inx;
          }
        }

        component.filter(filter_items, choice);
      }
      /**
       * Получить потоки
       * @param {Object} player
       * @returns array
       */


      function extractItems(player) {
        try {
          var items = [];

          if (player && player.video && player.video.quality) {
            var server = servers[choice.server] || servers[0];
            items = player.video.quality.map(function (q) {
              return {
                label: q.quality ? q.quality + 'p' : '360p ~ 1080p',
                quality: q.quality,
                file: q.href ? component.proxyLink(server.url + q.href, prox, prox_enc) : ''
              };
            });
            items.sort(function (a, b) {
              if (b.quality > a.quality) return 1;
              if (b.quality < a.quality) return -1;
              if (b.label > a.label) return 1;
              if (b.label < a.label) return -1;
              return 0;
            });
          }

          return items;
        } catch (e) {}

        return [];
      }

      function extractSubs(player) {
        try {
          var subtitles = [];

          if (player && player.subtitles) {
            subtitles = player.subtitles.map(function (item) {
              return {
                label: item.format || item.filename || '',
                url: component.processSubs(item.src || '')
              };
            });
          }

          return subtitles.length ? subtitles : false;
        } catch (e) {}

        return false;
      }
      /**
       * Отфильтровать файлы
       * @returns array
       */


      function filtred() {
        var filtred = [];
        var server = servers[choice.server] || servers[0];

        if (extract.episodes) {
          if (extract.is_film) {
            extract.episodes.forEach(function (episode) {
              if (episode.players) {
                episode.players.forEach(function (player) {
                  var voice_name = player && player.team && player.team.name || '';
                  var voice_id = player && player.team && player.team.id || null;
                  var items = extractItems(player);
                  filtred.push({
                    title: voice_name || extract.ru_title || extract.en_title || extract.orig_title || select_title,
                    orig_title: extract.orig_title || extract.en_title || extract.ru_title || select_title,
                    quality: items[0] ? items[0].label : '???',
                    info: ' / ' + server.name,
                    media: {
                      episode: episode,
                      player: player,
                      voice_id: voice_id
                    }
                  });
                });
              }
            });
          } else {
            var voice_id = filter_items.voice_info[choice.voice] && filter_items.voice_info[choice.voice].id;
            extract.episodes.forEach(function (episode) {
              var player = null;

              if (episode.players && episode.players.length) {
                player = episode.players.filter(function (p) {
                  return p.team && p.team.id == voice_id;
                })[0] || episode.players[0];
              }

              var voice_name = player && player.team && player.team.name || '???';
              var items = extractItems(player);
              filtred.push({
                title: component.formatEpisodeTitle(null, episode.item_number, episode.name),
                orig_title: extract.orig_title || extract.en_title || extract.ru_title || select_title,
                quality: items[0] ? items[0].label : '???',
                info: ' / ' + voice_name + ' / ' + server.name,
                season: 1,
                episode: episode.item_number,
                watch_info: { src: 'animelib:' + (extract.id || extract.slug_url || extract.slug || extract.orig_title || extract.en_title || '') },
                media: {
                  episode: episode,
                  player: player,
                  voice_id: voice_id
                }
              });
            });
          }
        }

        return filtred;
      }
      /**
       * Получить поток
       * @param {*} element
       */


      function getStream(element, call, error) {
        if (element.stream) return call(element);
        var episode = element.media.episode;
        var old_player = element.media.player;
        getPlayers(episode, function () {
          var player = element.media.player;

          if (!player) {
            var voice_id = element.media.voice_id;

            if (episode.players && episode.players.length) {
              player = episode.players.filter(function (p) {
                return p.team && p.team.id == voice_id;
              })[0] || episode.players[0];
            }
          }

          var items = extractItems(player);
          var file = '';
          var quality = false;

          if (items && items.length) {
            file = items[0].file;
            quality = {};
            items.forEach(function (item) {
              quality[item.label] = item.file;
            });
          }

          if (!old_player && player) {
            var voice_name = player && player.team && player.team.name || '???';
            var server = servers[choice.server] || servers[0];
            element.quality = items[0] ? items[0].label : '???';
            element.info = ' / ' + voice_name + ' / ' + server.name;
            var dst = element.template && element.template.find('.online__quality');

            if (dst && dst.length) {
              var src = Lampa.Template.get('online_mod', element).find('.online__quality');

              if (src && src.length) {
                if (Lampa.Timeline.details) {
                  src.append(Lampa.Timeline.details(element.timeline, ' / '));
                }

                dst[0].innerHTML = src[0].innerHTML;
              }
            }
          }

          if (file) {
            element.stream = file;
            element.qualitys = quality;
            element.subtitles = extractSubs(player);
            call(element);
          } else error();
        });
      }
      /**
       * Показать файлы
       */


      function append(items) {
        component.reset();
        var viewed = Lampa.Storage.cache('online_view', 5000, []);
        var last_episode = component.getLastEpisode(items);
        items.forEach(function (element) {
          if (element.season) {
            element.translate_episode_end = last_episode;
            element.translate_voice = filter_items.voice[choice.voice];
          }

          var hash = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title, element.orig_title].join('') : object.movie.original_title + element.orig_title);
          var view = component.watchView(element, hash, items);
          var item = Lampa.Template.get('online_mod', element);
          var hash_file = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title, element.orig_title, filter_items.voice[choice.voice]].join('') : object.movie.original_title + element.orig_title + element.title);
          element.timeline = view;
          element.template = item;
          item.append(Lampa.Timeline.render(view));

          if (Lampa.Timeline.details) {
            item.find('.online__quality').append(Lampa.Timeline.details(view, ' / '));
          }

          if (viewed.indexOf(hash_file) !== -1) item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
          item.on('hover:enter', function () {
            if (element.loading) return;
            if (object.movie.id) Lampa.Favorite.add('history', object.movie, 100);
            element.loading = true;
            getStream(element, function (element) {
              element.loading = false;
              var first = {
                url: component.getDefaultQuality(element.qualitys, element.stream),
                quality: component.renameQualityMap(element.qualitys),
                subtitles: element.subtitles,
                timeline: element.timeline,
                title: element.season ? element.title : select_title + (element.title == select_title ? '' : ' / ' + element.title)
              };

              if (element.season && Lampa.Platform.version) {
                var playlist = [];
                items.forEach(function (elem) {
                  if (elem == element) {
                    playlist.push(first);
                  } else {
                    var cell = {
                      url: function url(call) {
                        getStream(elem, function (elem) {
                          cell.url = component.getDefaultQuality(elem.qualitys, elem.stream);
                          cell.quality = component.renameQualityMap(elem.qualitys);
                          cell.subtitles = elem.subtitles;
                          call();
                        }, function () {
                          cell.url = '';
                          call();
                        });
                      },
                      timeline: elem.timeline,
                      title: elem.title
                    };
                    playlist.push(cell);
                  }
                });
                playWithoutPreroll(first, playlist);
              } else {
                playWithoutPreroll(first, [first]);
              }

              if (viewed.indexOf(hash_file) == -1) {
                viewed.push(hash_file);
                item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
                Lampa.Storage.set('online_view', viewed);
              }
            }, function () {
              element.loading = false;
              Lampa.Noty.show(Lampa.Lang.translate('online_mod_nolink'));
            });
          });
          component.append(item);
          component.contextmenu({
            item: item,
            view: view,
            viewed: viewed,
            hash_file: hash_file,
            element: element,
            file: function file(call) {
              getStream(element, function (element) {
                call({
                  file: element.stream,
                  quality: element.qualitys
                });
              }, function () {
                Lampa.Noty.show(Lampa.Lang.translate('online_mod_nolink'));
              });
            }
          });
        });
        component.start(true);
      }
    }

    animelib.initSettings = function (show_all) {
      var balanser_name = 'AnimeLib';
      var component_name = 'online_mod_animelib';
      if (Lampa.SettingsApi.getComponent(component_name)) return;

      {
        var icon = "<svg><use xlink:href=\"#sprite-settings\"></use></svg>";
        Lampa.SettingsApi.addComponent({
          component: component_name,
          icon: icon,
          name: balanser_name
        });
        Lampa.SettingsApi.addParam({
          component: 'online_mod',
          param: {
            name: component_name + '_settings',
            type: 'button'
          },
          field: {
            name: "<div class=\"settings-folder\" style=\"padding:0!important\"><div style=\"width:1.8em;height:1.3em;padding-right:.5em\">".concat(icon, "</div><div style=\"font-size:1.3em\">").concat(balanser_name, "</div></div>")
          },
          onChange: function onChange() {
            Lampa.Settings.create(component_name, {
              onBack: function onBack() {
                Lampa.Settings.create('online_mod');
              }
            });
          }
        });
      }

      {
        Lampa.SettingsApi.addParam({
          component: component_name,
          param: {
            name: 'online_mod_proxy_animelib',
            type: 'trigger',
            "default": false
          },
          field: {
            name: Lampa.Lang.translate('online_mod_proxy_balanser') + ' ' + balanser_name
          }
        });
      }
    };

    animelib.hideSettings = function (body) {
      $('[data-component="online_mod_animelib"]', body).hide();
    };

    function kodik(component, _object, config) {
      var network = new Lampa.Reguest();
      var extract = {};
      var object = _object;
      var select_title = '';
      var prefer_http = Lampa.Storage.field('online_mod_prefer_http') === true;
      var prefer_mp4 = false;
      var kodik_id_nets = [];
      var kodik_destroyed = false;
      var kodik_merged = false;
      var prox = component.proxy('kodik');
      var token = Utils.decodeSecret([124, 125, 1, 86, 90, 64, 12, 123, 108, 59, 122, 125, 82, 3, 90, 23, 90, 122, 60, 110, 43, 123, 84, 3, 91, 71, 88, 112, 111, 57, 122, 121], atob('ZmluZCB5b3VyIG93biB0b2tlbg=='));
      var embed = 'https://kodik-api.com/search';
      var last_player = '';
      var last_info = '';
      var filter_items = {};
      var choice = {
        season: 0,
        voice: 0,
        voice_name: ''
      };

      function kodik_api_search(api, callback, error) {
        network.clear();
        network.timeout(15000);
        network["native"](component.proxyLink(embed + api, prox), function (json) {
          if (callback) callback(json);
        }, function (a, c) {
          if (error) error(network.errorDecode(a, c));
        });
      }
      /**
       * Части франшизы (порядок просмотра) — каждая со своими сезонами и переводами
       * @param {Array} ids
       */

      function kodik_api_search_parts(ids, callback) {
        var parts = ids.map(function (id) {
          return {
            id: id,
            results: []
          };
        });
        var next = 0;
        var active = 0;
        var closed = false;
        var timer = setTimeout(done, 15000);

        function done() {
          if (closed) return;
          closed = true;
          clearTimeout(timer);
          callback(parts);
        }

        function tick() {
          if (closed) return;
          while (active < 4 && next < ids.length) {
            (function (i) {
              active++;
              var params = Lampa.Utils.addUrlComponent('', 'token=' + token);
              params = Lampa.Utils.addUrlComponent(params, 'limit=100');
              params = Lampa.Utils.addUrlComponent(params, 'with_episodes=true');
              params = Lampa.Utils.addUrlComponent(params, 'shikimori_id=' + encodeURIComponent(ids[i]));
              if (!ids[i]) {
                active--;
                tick();
                return;
              }
              var net = new Lampa.Reguest();
              kodik_id_nets.push(net);
              net.timeout(15000);
              net["native"](component.proxyLink(embed + params, prox), function (json) {
                parts[i] = {
                  id: ids[i],
                  results: json && json.results || []
                };
                active--;
                tick();
              }, function () {
                parts[i] = {
                  id: ids[i],
                  results: []
                };
                active--;
                tick();
              });
            })(next++);
          }
          if (!active && next >= ids.length) done();
        }

        tick();
      }
      /**
       * Собрать все части в один список сезонов: у Kodik каждый сезон/OVA — отдельный тайтл,
       * поэтому сезоны перенумеровываются по порядку просмотра.
       * @param {Array} parts
       * @param {Number} preselect shikimori_id части, на которой открыть
       */

      function mergeParts(parts, preselect_index, preselect_id) {
        var items = [];
        var seasons = [];
        var starts = [];
        var seen = {};
        var wanted = 0;
        var wanted_id = 0;

        parts.forEach(function (part, part_index) {
          var rows = part.results || [];
          // Empty parts and two urls with one shikimori id must not shift the season order.
          if (!rows.length || !part.id || seen[part.id]) return;
          seen[part.id] = true;

          // Rows of one id may differ (a compilation row has no seasons): take the union.
          var keys = [];
          rows.forEach(function (c) {
            Object.keys(c.seasons || {}).forEach(function (k) {
              var s = c.seasons[k];
              if (keys.indexOf(k) < 0 && s && s.episodes && Object.keys(s.episodes).length) keys.push(k);
            });
          });
          keys.sort(function (x, y) {
            return x - y;
          });

          var map = {};
          var title = rows[0].title || select_title;

          starts[part_index] = seasons.length + 1;

          if (!keys.length) {
            // Single video (OVA/film): a season with one episode.
            var single = seasons.length + 1;
            seasons.push({
              id: single,
              title: title,
              single: true
            });
            map.single = single;
            if (part.id === preselect_id) wanted_id = single;
          } else {
            keys.forEach(function (k) {
              var sid = seasons.length + 1;
              map[k] = sid;
              var merged = {
                id: sid,
                title: title + (keys.length > 1 ? ' / ' + k : '')
              };
              // only beside other seasons is "0" the specials; a lone "0" is the show itself
              if (keys.length > 1) merged.kodik_key = k;
              seasons.push(merged);
              if (part.id === preselect_id) wanted_id = sid;
            });
          }

          rows.forEach(function (c) {
            if (!c.link) return;
            var mine = {};

            if (!keys.length) mine[map.single] = {
              episodes: {
                1: c.link
              }
            };else keys.forEach(function (k) {
              var season = c.seasons && c.seasons[k];
              if (season && season.episodes && Object.keys(season.episodes).length) mine[map[k]] = season;
            });
            if (!Object.keys(mine).length) return;
            var copy = {};
            for (var f in c) copy[f] = c[f];
            copy.seasons = mine;
            items.push(copy);
          });
        });

        if (!seasons.length) return false;

        // Drop seasons no row produced (every link missing).
        var used = {};
        items.forEach(function (c) {
          Object.keys(c.seasons).forEach(function (k) {
            used[k] = true;
          });
        });
        seasons = seasons.filter(function (season) {
          return used[season.id];
        });
        if (!seasons.length) return false;

        wanted = used[wanted_id] ? wanted_id : 0;

        // Part absent in Kodik (some OVAs): the special usually sits as episode 0 of the next part.
        if (!wanted && preselect_index >= 0) {
          for (var p = preselect_index + 1; p < starts.length && !wanted; p++) {
            if (used[starts[p]]) wanted = starts[p];
          }
          for (var q = preselect_index; q >= 0 && !wanted; q--) {
            if (used[starts[q]]) wanted = starts[q];
          }
        }

        extract = {
          items: items,
          seasons: seasons
        };
        kodik_merged = true;
        choice.season = 0;
        choice.voice = 0;
        choice.voice_name = '';
        if (wanted) {
          seasons.forEach(function (season, i) {
            if (season.id === wanted) choice.season = i;
          });
        }
        filter();
        append(filtred());
        return true;
      }
      /**
       * Поиск
       * @param {Object} _object
       */


      this.search = function (_object, kinopoisk_id, data) {
        var _this = this;

        object = _object;
        select_title = object.search || object.movie.title;
        if (this.wait_similars && data && data[0].is_similars) return success(data[0]);
        var search_year = object.search_date;
        var orig_titles = [];

        if (object.movie.alternative_titles && object.movie.alternative_titles.results) {
          orig_titles = object.movie.alternative_titles.results.map(function (t) {
            return t.title;
          });
        }

        if (object.movie.original_title) orig_titles.push(object.movie.original_title);
        if (object.movie.original_name) orig_titles.push(object.movie.original_name);

        // Список вариантов без угадывания: вкус «порядка просмотра» — сезоны и OVA отдельными пунктами
        var display = function display(results, empty) {
          if (results && results.length && results.forEach) {
            var is_sure = false;
            var is_imdb = false;
            var elements = {};
            results.forEach(function (c) {
              var id;
              if (c.shikimori_id) id = 'sm_' + c.shikimori_id;else if (c.worldart_link) id = 'wa_' + c.worldart_link;else if (c.kinopoisk_id) id = 'kp_' + c.kinopoisk_id;else if (c.imdb_id) id = 'im_' + c.imdb_id;else if (c.id) id = 'k_' + c.id;else id = '';
              if (!id) return;
              id += c.title;
              var list = elements[id] || [];
              list.push(c);
              elements[id] = list;
            });
            var items = [];

            for (var ID in elements) {
              var list = elements[ID];
              items.push({
                title: list[0].title,
                orig_title: list[0].title_orig,
                other_title: list[0].other_title,
                year: list[0].year,
                kinopoisk_id: list[0].kinopoisk_id,
                imdb_id: list[0].imdb_id,
                episodes_count: list[0].episodes_count,
                media: list[0]
              });
            }

            if (!object.clarification && (object.movie.imdb_id || +kinopoisk_id)) {
              var imdb_id = object.movie.imdb_id;
              var kp_id = +kinopoisk_id;
              var tmp = items.filter(function (c) {
                return imdb_id && c.imdb_id == imdb_id || kp_id && c.kinopoisk_id == kp_id;
              });

              if (tmp.length) {
                items = tmp;
                is_sure = true;
                is_imdb = true;
              }
            }

            var cards = items;

            if (cards.length) {
              if (orig_titles.length) {
                var _tmp = cards.filter(function (c) {
                  return component.containsAnyTitle([c.orig_title, c.title, c.other_title], orig_titles);
                });

                if (_tmp.length) {
                  cards = _tmp;
                  is_sure = true;
                }
              }

              if (select_title) {
                var _tmp2 = cards.filter(function (c) {
                  return component.containsAnyTitle([c.title, c.orig_title, c.other_title], [select_title]);
                });

                if (_tmp2.length) {
                  cards = _tmp2;
                  is_sure = true;
                }
              }

              if (!is_sure) cards = [];
              items = cards;

              if (cards.length > 1 && search_year) {
                var _tmp3 = cards.filter(function (c) {
                  return c.year == search_year;
                });

                if (!_tmp3.length) _tmp3 = cards.filter(function (c) {
                  return c.year && c.year > search_year - 2 && c.year < search_year + 2;
                });
                if (_tmp3.length) cards = _tmp3;
              }
            }

            if (cards.length == 1 && is_sure && !is_imdb) {
              if (search_year && cards[0].year) {
                is_sure = cards[0].year > search_year - 2 && cards[0].year < search_year + 2;
              }

              if (is_sure) {
                is_sure = false;

                if (orig_titles.length) {
                  is_sure |= component.equalAnyTitle([cards[0].orig_title, cards[0].title, cards[0].other_title], orig_titles);
                }

                if (select_title) {
                  is_sure |= component.equalAnyTitle([cards[0].title, cards[0].orig_title, cards[0].other_title], [select_title]);
                }
              }
            }

            if (cards.length == 1 && is_sure) {
              success(cards[0]);
            } else if (items.length) {
              _this.wait_similars = true;
              items.forEach(function (c) {
                c.is_similars = true;
              });
              component.similars(items);
              component.loading(false);
            } else empty();
          } else empty();
        };

        var kodik_search_by_title = function kodik_search_by_title(callback, error) {
          var params = Lampa.Utils.addUrlComponent('', 'token=' + token);
          params = Lampa.Utils.addUrlComponent(params, 'limit=100');
          params = Lampa.Utils.addUrlComponent(params, 'translation_type=voice');
          params = Lampa.Utils.addUrlComponent(params, 'title=' + encodeURIComponent(select_title));
          kodik_api_search(params, callback, error);
        };

        var kodik_search_by_title_part = function kodik_search_by_title_part(callback, error) {
          var params = Lampa.Utils.addUrlComponent('', 'token=' + token);
          params = Lampa.Utils.addUrlComponent(params, 'limit=100');
          params = Lampa.Utils.addUrlComponent(params, 'translation_type=voice');
          var words = component.cleanTitle(select_title || '').replace(/[\s—\-+]+/g, ' ').trim().split(' ');
          words.sort(function (a, b) {
            return b.length - a.length;
          });
          var title = words.splice(0, 1).join(' ');

          if (title !== select_title) {
            params = Lampa.Utils.addUrlComponent(params, 'title=' + encodeURIComponent(title));
            kodik_api_search(params, callback, error);
          } else callback({});
        };

        var kodik_search_by_id = function kodik_search_by_id(callback, error) {
          if (!object.clarification && (object.movie.imdb_id || +kinopoisk_id)) {
            var params = Lampa.Utils.addUrlComponent('', 'token=' + token);
            params = Lampa.Utils.addUrlComponent(params, 'limit=100');
            var kp_params = +kinopoisk_id ? Lampa.Utils.addUrlComponent(params, 'kinopoisk_id=' + encodeURIComponent(+kinopoisk_id)) : '';
            var imdb_params = object.movie.imdb_id ? Lampa.Utils.addUrlComponent(params, 'imdb_id=' + encodeURIComponent(object.movie.imdb_id)) : '';
            kodik_api_search(kp_params || imdb_params, function (json) {
              if (json.results && json.results.length) callback(json);else if (kp_params && imdb_params) {
                kodik_api_search(imdb_params, callback, error);
              } else callback({});
            }, error);
          } else callback({});
        };

        var error = component.empty.bind(component);
        var kodik_search_usual = function () {
          kodik_search_by_id(function (json) {
            display(json && json.results, function () {
              kodik_search_by_title_part(function (json) {
                display(json && json.results, function () {
                  kodik_search_by_title(function (json) {
                    display(json && json.results, function () {
                      component.emptyForQuery(select_title);
                    });
                  }, error);
                });
              }, error);
            });
          }, error);
        }; // Аниме с «порядком просмотра»: ищем по всем частям сразу, показываем их списком (сезоны и OVA)
        // Ветка срабатывает, если на карточку плагин yummyani положил shikimori-id частей.


        // Аниме с «порядком просмотра»: все сезоны и OVA франшизы одним списком.
        // Для Kodik каждый сезон/OVA — отдельный тайтл, поэтому сезоны склеиваем мы.
        var yani_ids = !object.clarification && object.movie.yani_order_urls && object.movie.yani_order_urls.length && window.YummyAnime && window.YummyAnime.shikimoriIds;
        // Выбор из «Порядка просмотра»: открываем именно эту часть — её озвучки или серии.
        var part = +object.movie.yani_part_index;
        var single_id = +object.movie.yani_only_shikimori || 0;
        if (!object.clarification && part >= 0 && single_id) {
          kodik_api_search_parts([single_id], function (parts) {
            if (kodik_destroyed) return;
            var rows = parts[0] && parts[0].results;
            if (rows && rows.length) return success({ media: rows[0] });
            // Такой записи в Kodik нет (спешл внутри сезона): открываем соседнюю часть,
            // там он и живёт — обычно нулевой серией.
            var titleFallback = function () {
              kodik_search_by_title(function (json) {
                display(json && json.results, function () {
                  component.emptyForQuery(select_title);
                });
              }, component.empty.bind(component));
            };
            if (!yani_ids || part < 0) return titleFallback();
            window.YummyAnime.shikimoriIds(object.movie, function (ids) {
              if (kodik_destroyed) return;
              kodik_api_search_parts(ids, function (all) {
                if (kodik_destroyed) return;
                for (var p = part + 1; p < all.length && p < ids.length; p++) {
                  if (all[p] && all[p].results.length) return success({ media: all[p].results[0] });
                }
                for (var q = part; q >= 0; q--) {
                  if (all[q] && all[q].results.length) return success({ media: all[q].results[0] });
                }
                titleFallback();
              });
            });
          });
        } else if (yani_ids) {
          window.YummyAnime.shikimoriIds(object.movie, function (ids) {
            if (!ids.length) return kodik_search_usual();
            kodik_api_search_parts(ids, function (parts) {
              if (kodik_destroyed) return;
              // Plain open: start on the part this page is about.
              if (!mergeParts(parts, +(object.movie.yani_part_index), +object.movie.yani_only_shikimori || +(object.movie.yani_shikimori || [])[0] || 0)) return kodik_search_usual();
              component.loading(false);
            });
          });
        } else kodik_search_usual();
      };

      this.extendChoice = function (saved) {
        Lampa.Arrays.extend(choice, saved, true);
      };
      /**
       * Сброс фильтра
       */


      this.reset = function () {
        component.reset();
        choice = {
          season: 0,
          voice: 0,
          voice_name: ''
        };
        filter();
        append(filtred());
        component.saveChoice(choice);
      };
      /**
       * Применить фильтр
       * @param {*} type
       * @param {*} a
       * @param {*} b
       */


      this.filter = function (type, a, b) {
        choice[a.stype] = b.index;
        if (a.stype == 'voice') choice.voice_name = filter_items.voice[b.index];
        component.reset();
        filter();
        append(filtred());
        component.saveChoice(choice);
      };
      /**
       * Уничтожить
       */


      this.destroy = function () {
        network.clear();
        kodik_destroyed = true;
        kodik_id_nets.forEach(function (n) {
          n.clear();
        });
        kodik_id_nets = [];
        extract = null;
      };

      function success(json) {
        var media = json.media || {};
        var params = Lampa.Utils.addUrlComponent('', 'token=' + token);
        params = Lampa.Utils.addUrlComponent(params, 'limit=100');
        params = Lampa.Utils.addUrlComponent(params, 'with_episodes=true');
        if (media.shikimori_id) params = Lampa.Utils.addUrlComponent(params, 'shikimori_id=' + encodeURIComponent(media.shikimori_id));else if (media.worldart_link) params = Lampa.Utils.addUrlComponent(params, 'worldart_link=' + encodeURIComponent(media.worldart_link));else if (media.kinopoisk_id) params = Lampa.Utils.addUrlComponent(params, 'kinopoisk_id=' + encodeURIComponent(media.kinopoisk_id));else if (media.imdb_id) params = Lampa.Utils.addUrlComponent(params, 'imdb_id=' + encodeURIComponent(media.imdb_id));else if (media.id) params = Lampa.Utils.addUrlComponent(params, 'id=' + encodeURIComponent(media.id));else {
          component.emptyForQuery(select_title);
          return;
        }
        var error = component.empty.bind(component);
        kodik_api_search(params, function (json) {
          component.loading(false);
          extractData(json && json.results ? json.results.filter(function (c) {
            return c.title === media.title;
          }) : []);
          filter();
          append(filtred());
        }, error);
      }
      /**
       * Получить данные о фильме
       * @param {Array} items
       */


      function extractData(items) {
        var seasons = [];
        items.forEach(function (c) {
          if (c.seasons) {
            var _loop = function _loop(season_id) {
              var season = c.seasons[season_id];

              if (season) {
                if (!seasons.some(function (s) {
                  return s.id === season_id;
                })) {
                  seasons.push({
                    id: season_id,
                    title: Lampa.Lang.translate('torrent_serial_season') + ' ' + season_id + (season.title ? ' - ' + season.title : '')
                  });
                }
              }
            };

            for (var season_id in c.seasons) {
              _loop(season_id);
            }
          }
        });
        seasons.sort(function (a, b) {
          return a.id - b.id;
        });
        kodik_merged = false;
        extract = {
          items: items,
          seasons: seasons
        };
      }
      /**
       * Построить фильтр
       */


      function filter() {
        filter_items = {
          season: extract.seasons.map(function (s) {
            return s.title;
          }),
          voice: [],
          voice_info: [],
          voice_note: []
        };
        if (!filter_items.season[choice.season]) choice.season = 0;

        if (extract.seasons.length) {
          var season_id = extract.seasons[choice.season] && extract.seasons[choice.season].id;
          var eps_by = {};
          extract.items.forEach(function (c) {
            if (!(c.seasons && c.seasons[season_id])) return;

            if (c.translation && !filter_items.voice_info.some(function (v) {
              return v.id == c.translation.id;
            })) {
              filter_items.voice.push(c.translation.title);
              filter_items.voice_info.push(c.translation);
            }
            // Episodes this voice has in the selected season (rows repeat episodes per quality).
            if (c.translation) {
              var seen_eps = eps_by[c.translation.id] || (eps_by[c.translation.id] = {});
              Object.keys(c.seasons[season_id].episodes || {}).forEach(function (e) {
                seen_eps[e] = true;
              });
            }
          });
          filter_items.voice_info.forEach(function (v) {
            filter_items.voice_note.push(episodeRanges(Object.keys(eps_by[v.id] || {}).map(Number)));
          });
        }

        if (!filter_items.voice[choice.voice]) choice.voice = 0;

        if (choice.voice_name) {
          var inx = filter_items.voice.indexOf(choice.voice_name);
          if (inx == -1) choice.voice = 0;else if (inx !== choice.voice) {
            choice.voice = inx;
          }
        }

        component.filter(filter_items, choice);
      }
      /**
       * Отфильтровать файлы
       * @returns array
       */


      // For watch.stacked: where a merged season sits among the franchise's TV parts
      function watchPart(season_id, ex) {
        ex = ex || extract;
        if (!ex) return { index: -2, bounds: [0], first: 0 };
        return watch.kodikPart(ex.seasons, ex.items, (watch.altOf(object.movie) || {}).ys || 0, season_id);
      }




      function filtred() {
        var filtred = [];

        if (extract.seasons.length) {
          var season_id = extract.seasons[choice.season] && extract.seasons[choice.season].id;
          var voice_name = filter_items.voice[choice.voice];
          var voice_id = filter_items.voice_info[choice.voice] && filter_items.voice_info[choice.voice].id;
          var translation = extract.items.filter(function (c) {
            return c.seasons && c.seasons[season_id] && c.translation && c.translation.id == voice_id;
          })[0];

          if (translation) {
            var episodes = translation.seasons[season_id] && translation.seasons[season_id].episodes || {};

            // the list the rows came from, and the place kept until YummyAnime's parts change
            var ex = extract;
            var memo = null;
            var part = kodik_merged ? function () {
              var alt = watch.altOf(object.movie);
              if (!memo || memo.alt !== alt) memo = { alt: alt, part: watchPart(season_id, ex) };
              return memo.part;
            } : null;
            for (var episode_id in episodes) {
              var link = episodes[episode_id];
              filtred.push({
                // Merged franchise: season numbers are ours, so show only the episode.
                title: component.formatEpisodeTitle(kodik_merged ? null : season_id, episode_id),
                orig_title: translation.title_orig || translation.title || select_title,
                quality: translation.quality || '360p ~ 1080p',
                info: ' / ' + voice_name,
                season: '' + season_id,
                episode: parseInt(episode_id),
                shikimori: translation.shikimori_id || '',
                kodik_voice: voice_name,
                watch_info: kodik_merged ? { src: 'shiki:' + translation.shikimori_id, part: part } : translation.shikimori_id ? { src: 'shiki:' + translation.shikimori_id } : null,
                link: link
              });
            }
          }
        } else {
          extract.items.forEach(function (c) {
            if (c.seasons) return;
            filtred.push({
              title: c.translation && c.translation.title || select_title,
              orig_title: c.title_orig || c.title || select_title,
              quality: c.quality || '360p ~ 1080p',
              info: '',
              link: c.link
            });
          });
        }

        return filtred;
      }
      /**
       * Получить поток
       * @param {*} element
       */


      function getStream(element, call, error) {
        if (element.stream) return call(element);
        if (!element.link) return error();
        var link_match = element.link.match(/^((https?:)?\/\/[^\/]+)\/.*$/);
        var link_origin = component.fixLinkProtocol(link_match ? link_match[1] : '//kodikplayer.com', false);
        var url = component.fixLinkProtocol(element.link, false);
        network.clear();
        network.timeout(10000);
        network["native"](component.proxyLink(url, prox), function (str) {
          str = (str || '').replace(/\n/g, '');
          var urlParams = str.match(/\burlParams = '([^']+)'/);
          var type = str.match(/\b(?:videoInfo|vInfo)\.type = '([^']+)'/);
          var hash = str.match(/\b(?:videoInfo|vInfo)\.hash = '([^']+)'/);
          var id = str.match(/\b(?:videoInfo|vInfo)\.id = '([^']+)'/);
          var player = str.match(/<script [^>]*\bsrc="(\/assets\/js\/app\.player_single[^"]+)"/);
          var json;

          try {
            json = urlParams && urlParams[1] && JSON.parse(urlParams[1]);
          } catch (e) {}

          var postdata = '';

          if (json && type && hash && id) {
            postdata = 'd=' + json.d;
            postdata += '&d_sign=' + json.d_sign;
            postdata += '&pd=' + json.pd;
            postdata += '&pd_sign=' + json.pd_sign;
            postdata += '&ref=' + json.ref;
            postdata += '&ref_sign=' + json.ref_sign;
            postdata += '&bad_user=true';
            postdata += '&cdn_is_working=true';
            postdata += '&type=' + type[1];
            postdata += '&hash=' + hash[1];
            postdata += '&id=' + id[1];
            postdata += '&info=%7B%7D';
          }

          if (postdata && player) {
            var getLinks = function getLinks() {
              network.clear();
              network.timeout(10000);
              network["native"](component.proxyLink(last_info, prox), function (json) {
                if (json && json.links) {
                  var items = extractItems(json.links),
                      file = '',
                      quality = false;

                  if (items && items.length) {
                    file = items[0].file;
                    quality = {};
                    items.forEach(function (item) {
                      quality[item.label] = item.file;
                    });
                  }

                  if (file) {
                    element.stream = file;
                    element.qualitys = quality;
                    call(element);
                  } else error();
                } else error();
              }, function (a, c) {
                error();
              }, postdata);
            };

            var player_url = link_origin + player[1];

            if (player_url !== last_player) {
              network.clear();
              network.timeout(10000);
              network["native"](component.proxyLink(player_url, prox), function (str) {
                str = (str || '').replace(/\n/g, '');
                var info_match = str.match(/\$\.ajax\({type: *"POST", *url: *atob\("([^"]+)"\)/);
                var info;

                try {
                  info = info_match && atob(info_match[1]);
                } catch (e) {}

                if (info && startsWith(info, '/')) {
                  last_info = link_origin + info;
                  last_player = player_url;
                  getLinks();
                } else error();
              }, function (a, c) {
                error();
              }, false, {
                dataType: 'text'
              });
            } else getLinks();
          } else error();
        }, function (a, c) {
          error();
        }, false, {
          dataType: 'text'
        });
      }

      function extractItems(playlists) {
        try {
          var items = [];
          Object.keys(playlists).forEach(function (key) {
            var obj = playlists[key];
            var quality = parseInt(key);
            var link = decode(obj && obj[0] && obj[0].src || '');
            link = component.fixLinkProtocol(link, prefer_http, true);
            if (prefer_mp4) ;
            items.push({
              label: quality ? quality + 'p' : '360p ~ 1080p',
              quality: quality,
              file: component.proxyStream(link, 'kodik')
            });
          });
          items.sort(function (a, b) {
            if (b.quality > a.quality) return 1;
            if (b.quality < a.quality) return -1;
            if (b.label > a.label) return 1;
            if (b.label < a.label) return -1;
            return 0;
          });
          return items;
        } catch (e) {}

        return [];
      }

      function decode(str) {
        try {
          if (startsWith(str, 'http') || startsWith(str, '//')) return str;
          return atob(str.replace(/[a-zA-Z]/g, function (x) {
            return String.fromCharCode((x <= 'Z' ? 90 : 122) >= (x = x.charCodeAt(0) + 18) ? x : x - 26);
          }));
        } catch (e) {
          return '';
        }
      }
      /**
       * Показать файлы
       */


      function append(items) {
        component.reset();
        var viewed = Lampa.Storage.cache('online_view', 5000, []);
        var last_episode = component.getLastEpisode(items);
        items.forEach(function (element) {
          if (element.season) {
            element.translate_episode_end = last_episode;
            element.translate_voice = filter_items.voice[choice.voice];
          }

          var hash = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title, element.orig_title].join('') : object.movie.original_title + element.orig_title);
          var view = component.watchView(element, hash, items);
          var item = Lampa.Template.get('online_mod', element);
          var hash_file = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title, element.orig_title, filter_items.voice[choice.voice]].join('') : object.movie.original_title + element.orig_title + element.title);
          element.timeline = view;
          item.append(Lampa.Timeline.render(view));

          if (Lampa.Timeline.details) {
            item.find('.online__quality').append(Lampa.Timeline.details(view, ' / '));
          }

          if (viewed.indexOf(hash_file) !== -1) item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
          item.on('hover:enter', function () {
            if (element.loading) return;
            if (object.movie.id) Lampa.Favorite.add('history', object.movie, 100);
            element.loading = true;
            var cancelled = false;
            Lampa.Loading.start(function () {
              cancelled = true;
              element.loading = false;
              Lampa.Loading.stop();
            });
            getStream(element, function (element) {
              Lampa.Loading.stop();
              element.loading = false;
              if (cancelled) return;
              var first = {
                anime_skip: skipOf(element),
                url: component.getDefaultQuality(element.qualitys, element.stream),
                quality: component.renameQualityMap(element.qualitys),
                timeline: element.timeline,
                title: element.season ? element.title : select_title + (element.title == select_title ? '' : ' / ' + element.title)
              };

              if (element.season && Lampa.Platform.version) {
                var playlist = [];
                items.forEach(function (elem) {
                  if (elem == element) {
                    playlist.push(first);
                  } else {
                    var cell = {
                      anime_skip: skipOf(elem),
                      url: function url(call) {
                        getStream(elem, function (elem) {
                          cell.url = component.getDefaultQuality(elem.qualitys, elem.stream);
                          cell.quality = component.renameQualityMap(elem.qualitys);
                          call();
                        }, function () {
                          cell.url = '';
                          call();
                        });
                      },
                      timeline: elem.timeline,
                      title: elem.title
                    };
                    playlist.push(cell);
                  }
                });
                playWithoutPreroll(first, playlist);
              } else {
                playWithoutPreroll(first, [first]);
              }

              if (viewed.indexOf(hash_file) == -1) {
                viewed.push(hash_file);
                item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
                Lampa.Storage.set('online_view', viewed);
              }
            }, function () {
              Lampa.Loading.stop();
              element.loading = false;
              if (!cancelled) Lampa.Noty.show(Lampa.Lang.translate('online_mod_nolink'));
            });
          });
          component.append(item);
          component.contextmenu({
            item: item,
            view: view,
            viewed: viewed,
            hash_file: hash_file,
            element: element,
            file: function file(call) {
              getStream(element, function (element) {
                call({
                  file: element.stream,
                  quality: element.qualitys
                });
              }, function () {
                Lampa.Noty.show(Lampa.Lang.translate('online_mod_nolink'));
              });
            }
          });
        });
        component.start(true);
      }
    }

    kodik.initSettings = function (show_all) {
      var balanser_name = 'Kodik';
      var component_name = 'online_mod_kodik';
      if (Lampa.SettingsApi.getComponent(component_name)) return;

      {
        var icon = "<svg><use xlink:href=\"#sprite-settings\"></use></svg>";
        Lampa.SettingsApi.addComponent({
          component: component_name,
          icon: icon,
          name: balanser_name
        });
        Lampa.SettingsApi.addParam({
          component: 'online_mod',
          param: {
            name: component_name + '_settings',
            type: 'button'
          },
          field: {
            name: "<div class=\"settings-folder\" style=\"padding:0!important\"><div style=\"width:1.8em;height:1.3em;padding-right:.5em\">".concat(icon, "</div><div style=\"font-size:1.3em\">").concat(balanser_name, "</div></div>")
          },
          onChange: function onChange() {
            Lampa.Settings.create(component_name, {
              onBack: function onBack() {
                Lampa.Settings.create('online_mod');
              }
            });
          }
        });
      }

      {
        Lampa.SettingsApi.addParam({
          component: component_name,
          param: {
            name: 'online_mod_proxy_kodik',
            type: 'trigger',
            "default": false
          },
          field: {
            name: Lampa.Lang.translate('online_mod_proxy_balanser') + ' ' + balanser_name
          }
        });
      }
    };

    kodik.hideSettings = function (body) {
      $('[data-component="online_mod_kodik"]', body).hide();
    };

    function alloha(component, _object, config) {
      var network = new Lampa.Reguest();
      var extract = {};
      var object = _object;
      var select_title = '';
      var server = Utils.helperServer();
      var filter_items = {};
      var choice = {
        season: 0,
        voice: 0,
        voice_name: '',
        audio: 0,
        audio_name: ''
      };

      function alloha_api_search(api, callback, error) {
        network.clear();
        network.timeout(10000);
        network["native"]('https://onomovie.ru/api/players?' + api, function (json) {
          var player = (json && json.data || []).filter(function (p) {
            return p.type === 'Alloha' && p.iframeUrl;
          })[0];
          if (callback) callback(player && player.iframeUrl);
        }, function (a, c) {
          if (error) error(network.errorDecode(a, c));
        });
      }
      /**
       * Начать поиск
       * @param {Object} _object
       * @param {String} kinopoisk_id
       */


      this.search = function (_object, kinopoisk_id) {
        object = _object;
        select_title = object.search || object.movie.title;
        var error = component.empty.bind(component);
        if (!server) return component.empty(Lampa.Lang.translate('online_mod_alloha_no_server'));
        var kp = parseInt(kinopoisk_id, 10) || 0;
        var imdb = object.movie.imdb_id || '';
        if (!kp && !imdb) return component.emptyForQuery(select_title);
        var api = kp ? 'kinopoisk=' + kp : 'imdb=' + imdb;
        alloha_api_search(api, function (iframe) {
          if (iframe) return getPage(iframe);
          if (kp && imdb && imdb != kp) {
            alloha_api_search('imdb=' + imdb, function (iframe) {
              if (iframe) getPage(iframe);else component.emptyForQuery(select_title);
            }, error);
          } else component.emptyForQuery(select_title);
        }, error);
      };

      // The helper fetches the player page (it needs a Referer) and returns its fileList as JSON.
      function getPage(iframe) {
        network.clear();
        network.timeout(20000);
        network["native"](server + '/tracks?url=' + encodeURIComponent(iframe), function (res) {
          var pl = res;
          if (typeof res === 'string') {
            try { pl = JSON.parse(res); } catch (e) { pl = null; }
          }
          extract = {
            iframe: iframe,
            pl: pl && pl.all ? pl : {},
            audios: {},
            subs: {},
            tracks: {}
          };

          if (pl && pl.all && Object.keys(pl.all).length) {
            component.loading(false);
            filter();
            append(filtred());
            probeAudios();
          } else component.emptyForQuery(select_title);
        }, function (a, c) {
          component.empty(network.errorDecode(a, c));
        }, false, {
          dataType: 'text'
        });
      }

      this.extendChoice = function (saved) {
        Lampa.Arrays.extend(choice, saved, true);
      };
      /**
       * Сброс фильтра
       */


      this.reset = function () {
        component.reset();
        choice = {
          season: 0,
          voice: 0,
          voice_name: '',
          audio: 0,
          audio_name: ''
        };
        filter();
        append(filtred());
        probeAudios();
        component.saveChoice(choice);
      };
      /**
       * Применить фильтр
       * @param {*} type
       * @param {*} a
       * @param {*} b
       */


      this.filter = function (type, a, b) {
        choice[a.stype] = b.index;
        if (a.stype == 'voice') {
          choice.voice_name = filter_items.voice[b.index];
          // A new voice asks for its track again.
          choice.audio = 0;
          choice.audio_name = '';
        }
        if (a.stype == 'audio') choice.audio_name = filter_items.audio[b.index];
        component.reset();
        filter();
        append(filtred());
        probeAudios();
        component.saveChoice(choice);
      };
      /**
       * Уничтожить
       */


      this.destroy = function () {
        network.clear();
        extract = null;
      };

      function parse(str, url) {
        str = (str || '').replace(/\n/g, '');
        var fileList = str.match(/ fileList = JSON\.parse\('(\{.*\})'\);/);
        var pl = fileList && Lampa.Arrays.decodeJson(fileList[1], {});
        extract = {
          iframe: url,
          pl: {},
          audios: {},
          subs: {},
          tracks: {}
        };

        if (pl && pl.all && Object.keys(pl.all).length) {
          extract.pl = pl;
          component.loading(false);
          filter();
          append(filtred());
          probeAudios();
        } else component.emptyForQuery(select_title);
      }
      /**
       * Построить фильтр
       */


      function filter() {
        filter_items = {
          season: [],
          season_num: [],
          voice: [],
          voice_info: [],
          voice_note: []
        };

        if (extract.pl.type === 'serial') {
          for (var s_num in extract.pl.all) {
            if (filter_items.season_num.indexOf(s_num) == -1) filter_items.season_num.push(s_num);
          }
        }

        filter_items.season_num.sort(function (a, b) {
          return a - b;
        });
        filter_items.season_num.forEach(function (s_num) {
          filter_items.season.push(Lampa.Lang.translate('torrent_serial_season') + ' ' + s_num);
        });
        if (!filter_items.season[choice.season]) choice.season = 0;

        if (filter_items.season[choice.season]) {
          var _s_num = filter_items.season_num[choice.season];
          var episodes = extract.pl.all[_s_num] || {};
          var eps_by = {};
          var uhd_by = {};

          for (var e_num in episodes) {
            var translations = episodes[e_num] || {};

            var _loop = function _loop(v_id) {
              if (!filter_items.voice_info.some(function (v) {
                return v.id == v_id;
              })) {
                filter_items.voice.push(translations[v_id].translation);
                filter_items.voice_info.push({
                  id: v_id
                });
              }
              (eps_by[v_id] = eps_by[v_id] || []).push(parseInt(e_num, 10));
              if (translations[v_id].uhd) uhd_by[v_id] = true;
            };

            for (var v_id in translations) {
              _loop(v_id);
            }
          }

          filter_items.voice_info.forEach(function (v) {
            filter_items.voice_note.push([uhd_by[v.id] ? '4K' : '', episodeRanges(eps_by[v.id] || [])].filter(Boolean).join(', '));
          });
        }

        if (!filter_items.voice[choice.voice]) choice.voice = 0;

        if (choice.voice_name) {
          var inx = filter_items.voice.indexOf(choice.voice_name);
          if (inx == -1) choice.voice = 0;else if (inx !== choice.voice) {
            choice.voice = inx;
          }
        }

        // The inner tracks of the chosen voice get their own filter row, shown only when there is a choice.
        filter_items.audio = [];
        var audios = filter_items.voice_info[choice.voice] && extract.audios && extract.audios[filter_items.voice_info[choice.voice].id];
        if (Array.isArray(audios) && audios.length > 1) {
          audios.forEach(function (a) {
            filter_items.audio.push(a.label);
          });
        }
        if (!filter_items.audio[choice.audio]) choice.audio = 0;
        if (choice.audio_name) {
          var a_inx = filter_items.audio.indexOf(choice.audio_name);
          // A track picked in the player may carry another episode's number ("(English) 9" vs "10").
          for (var j = 0; j < filter_items.audio.length && a_inx == -1; j++) {
            if (bareLabel(filter_items.audio[j]) === bareLabel(choice.audio_name)) a_inx = j;
          }
          choice.audio = a_inx != -1 ? a_inx : 0;
        }

        component.filter(filter_items, choice);
      }
      /**
       * Отфильтровать файлы
       * @returns array
       */


      function filtred() {
        var filtred = [];

        if (extract.pl.type === 'serial') {
          if (filter_items.season[choice.season] && filter_items.voice_info[choice.voice]) {
            var s_num = filter_items.season_num[choice.season];
            var v_id = filter_items.voice_info[choice.voice].id;
            var voice = filter_items.voice[choice.voice];
            var episodes = extract.pl.all[s_num] || {};

            for (var e_num in episodes) {
              var translations = episodes[e_num] || {};

              if (translations[v_id]) {
                var media = translations[v_id];
                filtred.push({
                  title: component.formatEpisodeTitle(s_num, e_num),
                  quality: (media.uhd ? '360p ~ 2160p' : '360p ~ 1080p') + (media.quality ? ' / ' + media.quality : ''),
                  // The chosen track is not named here: whether an episode has it is known only once it plays.
                  info: ' / ' + Lampa.Utils.shortText(voice, 50),
                  season: s_num,
                  episode: e_num,
                  media: media,
                  // the «По сериям» screen asks the helper for this voice's real qualities
                  quality_base: extract.iframe.replace(/&(translation|season|episode|audio)=[^&]*/g, ''),
                  quality_tid: media.id_translation,
                  quality_uhd: !!media.uhd,
                  alloha_skips: server + '/skips?url=' + encodeURIComponent(extract.iframe.replace(/&(translation|season|episode|audio)=[^&]*/g, '') + '&translation=' + media.id_translation + '&season=' + s_num + '&episode=' + e_num),
                  // The helper picks the track by label: Alloha renumbers tracks from episode to episode.
                  // A voice without the "Дорожка" row keeps a track picked in the player.
                  audio: filter_items.audio.length ? filter_items.audio[choice.audio] : choice.audio_name || undefined
                });
              }
            }
          }
        } else {
          for (var type in extract.pl.all) {
            var _translations = extract.pl.all[type] || {};

            for (var translation in _translations) {
              var qualities = _translations[translation] || {};

              for (var quality in qualities) {
                var _media = qualities[quality];
                filtred.push({
                  title: (_media.translation || select_title) + (_media.directors_cut ? Lampa.Lang.translate('online_mod_directors_cut') : ''),
                  quality: (_media.uhd ? '360p ~ 2160p' : '360p ~ 1080p') + (_media.quality ? ' / ' + _media.quality : ''),
                  info: '',
                  media: _media
                });
              }
            }
          }
        }

        return filtred;
      }

      // A standalone voice file can carry several audio tracks; the helper lists them once per voice.
      function probeAudios() {
        // the «По сериям» probe walks every voice: no track request per voice
        if (component.watch_probe) return;
        if (!extract || !extract.pl || extract.pl.type !== 'serial') return;
        if (!filter_items || !filter_items.voice_info || !filter_items.voice_info[choice.voice]) return;
        var v_id = filter_items.voice_info[choice.voice].id;
        if (v_id == null || !extract.audios || extract.audios[v_id] !== undefined) return;
        var season_num = filter_items.season_num[choice.season];
        var episodes = (extract.pl.all && extract.pl.all[season_num]) || {};
        var media = null;
        var firstEpisode = null;
        for (var e_num in episodes) {
          var translations = episodes[e_num] || {};
          if (translations[v_id]) { media = translations[v_id]; firstEpisode = e_num; break; }
        }
        if (!media || media.id_file != null) return;
        extract.audios[v_id] = 'pending';
        var url = extract.iframe.replace(/&(translation|season|episode|audio)=[^&]*/g, '') + '&translation=' + media.id_translation;
        if (season_num) url += '&season=' + season_num + '&episode=' + firstEpisode;
        var currentExtract = extract;
        var currentSeason = choice.season;
        var probe = new Lampa.Reguest();
        probe.timeout(20000);
        probe["native"](server + '/audios?url=' + encodeURIComponent(url), function (res) {
          if (extract !== currentExtract || !extract || !extract.audios) return;
          var arr = res;
          if (typeof res === 'string') {
            try { arr = JSON.parse(res); } catch (e) { arr = null; }
          }
          if (!Array.isArray(arr)) arr = [];
          // Tracks are asked for by label, so unnamed ones are dropped; the default goes first so a fresh choice lands on it.
          arr = arr.filter(function (a) {
            return a && a.label;
          });
          arr.sort(function (a, b) {
            return (b["default"] ? 1 : 0) - (a["default"] ? 1 : 0);
          });
          extract.audios[v_id] = arr;
          if (arr.length > 1 && choice.season === currentSeason && filter_items.voice_info[choice.voice] && filter_items.voice_info[choice.voice].id == v_id) {
            filter();
            // The list already plays the default track; it is rebuilt (losing focus) only for a remembered other one.
            if (choice.audio) append(filtred());
          }
        }, function () {
          if (extract !== currentExtract || !extract || !extract.audios) return;
          extract.audios[v_id] = [];
        }, false, {
          dataType: 'text'
        });
      }
      /**
       * Получить поток
       * @param {*} element
       */


      function getStream(element, call, error) {
        if (element.stream) return call(element);
        if (!(element.media && extract.iframe)) return error();
        var url = extract.iframe.replace(/&(translation|season|episode|audio)=[^&]*/g, '') + '&translation=' + element.media.id_translation;
        if (element.season) url += '&season=' + element.season + '&episode=' + element.episode;
        if (element.audio != null) url += '&audio=' + encodeURIComponent(element.audio);
        element.stream = server + '/stream.m3u8?url=' + encodeURIComponent(url);
        element.sub_url = url;
        element.subtitles = false;
        network.clear();
        network.timeout(40000);
        network["native"](server + '/qualities?url=' + encodeURIComponent(url), function (res) {
          var map = res;
          if (typeof res === 'string') {
            try { map = JSON.parse(res); } catch (e) { map = null; }
          }
          element.qualitys = map && Object.keys(map).length ? map : false;
          // Alloha marks the voices and episodes that have 4K; elsewhere the list stops at 1080p.
          if (element.qualitys && !element.media.uhd) {
            delete element.qualitys['2160p'];
            delete element.qualitys['1440p'];
          }
          call(element);
        }, function () {
          element.qualitys = false;
          call(element);
        }, false, {
          dataType: 'text'
        });
      }
      // Subtitles and tracks are listed per episode, when it is about to play: that resolve is the one
      // playback needs anyway. Not per voice: later episodes can be another file with other tracks
      // (measured: RHS has 9 tracks up to S2E5 and a single one from S2E6).
      function listKey(element) {
        return element.media ? element.media.id : null;
      }

      function loadList(path, store, element, done) {
        var key = listKey(element);
        if (!element.sub_url || !extract || !extract[store] || Array.isArray(extract[store][key])) return done();
        var currentExtract = extract;
        var req = new Lampa.Reguest();
        req.timeout(15000);
        req["native"](server + path + '?url=' + encodeURIComponent(element.sub_url), function (res) {
          var arr = res;
          if (typeof res === 'string') {
            try { arr = JSON.parse(res); } catch (e) { arr = null; }
          }
          if (extract === currentExtract && extract) extract[store][key] = Array.isArray(arr) ? arr.filter(function (s) {
            return s && s.label;
          }) : [];
          done();
        }, function () {
          // Not remembered: a cooldown on this episode must not cost the voice its list.
          done();
        }, false, {
          dataType: 'text'
        });
      }
      // The second call reuses the episode the first one resolved, so it costs no extra /bnsi.
      function loadSubs(element, done) {
        loadList('/subs', 'subs', element, function () {
          loadList('/audios', 'tracks', element, done);
        });
      }

      function bareLabel(s) {
        return String(s || '').replace(/\s+\d+$/, '');
      }
      // The player's audio track menu lists the file's tracks; picking one swaps the stream in place,
      // the way Lampa switches quality, because each Alloha track is its own stream.
      function voiceoversFor(element, data, items) {
        var list = extract && extract.tracks && extract.tracks[listKey(element)];
        if (!element.sub_url || !Array.isArray(list) || list.length < 2) return undefined;
        var cur = -1;
        list.forEach(function (a, i) {
          if (cur == -1 && element.audio && bareLabel(a.label) === bareLabel(element.audio)) cur = i;
        });
        // No track asked for, or this episode lacks it: the helper plays the default one.
        if (cur == -1) list.forEach(function (a, i) {
          if (cur == -1 && a["default"]) cur = i;
        });
        return list.map(function (a, i) {
          var track = {
            name: a.label,
            selected: i == cur
          };
          // The menu turns `enabled` off on every track and on for the picked one, the way Lampa's own
          // track lists work. An onSelect on the item would replace the menu's handler, which moves
          // the check mark and gives the controls back to the player.
          Object.defineProperty(track, 'enabled', {
            set: function set(v) {
              if (!v || i == cur) return;
              cur = i;
              switchAudio(element, data, items, a.label);
            },
            get: function get() {
              return i == cur;
            }
          });
          return track;
        });
      }

      // Points a playlist entry and its quality menu (kept by reference) at another track.
      // Returns the quality key and url of `now`, or of the entry's own url when `now` is not in it.
      function retarget(e, data, label, now) {
        var src = e.sub_url.replace(/&audio=[^&]*/g, '') + '&audio=' + encodeURIComponent(label);
        var hit = { name: '', url: server + '/stream.m3u8?url=' + encodeURIComponent(src) };
        for (var k in data.quality || {}) {
          var old = data.quality[k];
          var qm = String(old || '').match(/[?&]q=(\d+)/);
          if (!qm) continue;
          var next = server + '/play.m3u8?q=' + qm[1] + '&url=' + encodeURIComponent(src);
          if (old === now || !hit.name && old === data.url) {
            hit.name = k;
            hit.url = next;
          }
          data.quality[k] = next;
        }
        data.url = hit.url;
        e.audio = label;
        e.sub_url = src;
        e.stream = null;
        return hit;
      }

      function switchAudio(element, data, items, label) {
        if (!(Lampa.PlayerPanel && Lampa.PlayerPanel.listener)) return;
        var now = Lampa.Player.playdata && Lampa.Player.playdata() ? Lampa.Player.playdata().url : data.url;
        var hit = retarget(element, data, label, now);
        // The playlist resolves its entries ahead of time, so the ones already resolved are rewritten;
        // the rest resolve later with the new track.
        items.forEach(function (e) {
          if (e === element) return;
          if (e.cell && e.sub_url && typeof e.cell.url === 'string') {
            retarget(e, e.cell, label, null);
            e.cell.voiceovers = voiceoversFor(e, e.cell, items);
          } else {
            e.audio = label;
            e.stream = null;
          }
        });
        choice.audio_name = label;
        var inx = -1;
        (filter_items.audio || []).forEach(function (t, i) {
          if (inx == -1 && bareLabel(t) === bareLabel(label)) inx = i;
        });
        choice.audio = inx == -1 ? 0 : inx;
        component.saveChoice(choice);
        Lampa.PlayerPanel.listener.send('quality', {
          name: hit.name || 'auto',
          url: hit.url
        });
      }

      // `like`: another episode whose list stands in for this one's.
      function subsFor(element, like) {
        var list = extract && extract.subs && extract.subs[listKey(like || element)];
        if (!element.sub_url || !Array.isArray(list) || !list.length) return false;
        // ExoPlayer (DDD) turns on the first sideloaded track, and Alloha lists a forced track with a
        // handful of cues (signs only) first, so the full subtitles go ahead of it.
        list = list.filter(function (s) {
          return !/forced/i.test(s.label);
        }).concat(list.filter(function (s) {
          return /forced/i.test(s.label);
        }));
        return list.map(function (s) {
          return {
            label: s.label,
            url: server + '/sub.vtt?label=' + encodeURIComponent(s.label) + '&url=' + encodeURIComponent(element.sub_url)
          };
        });
      }
      /**
       * Показать файлы
       */


      function append(items) {
        component.reset();
        var viewed = Lampa.Storage.cache('online_view', 5000, []);
        var last_episode = component.getLastEpisode(items);
        items.forEach(function (element) {
          if (element.season) {
            element.translate_episode_end = last_episode;
            element.translate_voice = filter_items.voice[choice.voice];
          }

          var hash = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title].join('') : object.movie.original_title);
          var view = component.watchView(element, hash, items);
          var item = Lampa.Template.get('online_mod', element);
          var hash_file = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title, filter_items.voice[choice.voice]].join('') : object.movie.original_title + element.title);
          element.timeline = view;
          item.append(Lampa.Timeline.render(view));

          if (Lampa.Timeline.details) {
            item.find('.online__quality').append(Lampa.Timeline.details(view, ' / '));
          }

          if (viewed.indexOf(hash_file) !== -1) item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
          item.on('hover:enter', function () {
            if (element.loading) return;
            if (object.movie.id) Lampa.Favorite.add('history', object.movie, 100);
            element.loading = true;
            getStream(element, function (element) {
              loadSubs(element, function () {
              element.loading = false;
              var first = {
                anime_skip: skipOf(element),
                url: component.getDefaultQuality(element.qualitys, element.stream, '2160'),
                quality: component.renameQualityMap(element.qualitys),
                subtitles: subsFor(element),
                timeline: element.timeline,
                title: element.season ? element.title : select_title + (element.title == select_title ? '' : ' / ' + element.title)
              };
              first.voiceovers = voiceoversFor(element, first, items);
              first.voiceoverPath = server.replace(/^https?:\/\/[^\/]+/, '') + '/voiceovers';
              element.cell = first;

              if (element.season && Lampa.Platform.version) {
                var playlist = [];
                items.forEach(function (elem) {
                  if (elem == element) {
                    playlist.push(first);
                  } else {
                    var cell = {
                      anime_skip: skipOf(elem),
                      url: function url(call) {
                        getStream(elem, function (elem) {
                          // An external player gets the whole season resolved up front, and a resolve per
                          // episode there would hit Alloha's throttle.
                          // shortcut: its other episodes reuse the started episode's subtitle list, which can
                          // name subtitles a later file lacks; list them per episode if it ever resolves lazily.
                          var external = isExternalAndroidPlayer();
                          var ready = function ready() {
                            cell.url = component.getDefaultQuality(elem.qualitys, elem.stream, '2160');
                            cell.quality = component.renameQualityMap(elem.qualitys);
                            cell.subtitles = subsFor(elem, external && element);
                            cell.voiceovers = voiceoversFor(elem, cell, items);
                            call();
                          };
                          if (external) ready();else loadSubs(elem, ready);
                        }, function () {
                          cell.url = '';
                          call();
                        });
                      },
                      timeline: elem.timeline,
                      title: elem.title
                    };
                    elem.cell = cell;
                    playlist.push(cell);
                  }
                });
                playWithoutPreroll(first, playlist);
              } else {
                playWithoutPreroll(first, [first]);
              }

              if (viewed.indexOf(hash_file) == -1) {
                viewed.push(hash_file);
                item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
                Lampa.Storage.set('online_view', viewed);
              }
              });
            }, function () {
              element.loading = false;
              Lampa.Noty.show(Lampa.Lang.translate('online_mod_nolink'));
            });
          });
          component.append(item);
          component.contextmenu({
            item: item,
            view: view,
            viewed: viewed,
            hash_file: hash_file,
            element: element,
            file: function file(call) {
              getStream(element, function (element) {
                call({
                  file: element.stream,
                  quality: element.qualitys
                });
              }, function () {
                Lampa.Noty.show(Lampa.Lang.translate('online_mod_nolink'));
              });
            }
          });
        });
        component.start(true);
      }
    }

    // One server serves Alloha, Turbo and HDrezka in a browser; its field sits in each section so nobody has to look for it under Alloha.
    function addHelperServerParam(component_name) {
      Lampa.SettingsApi.addParam({
        component: component_name,
        param: {
          name: 'online_mod_alloha_server',
          placeholder: 'https://xxx.trycloudflare.com',
          type: 'input',
          values: '',
          "default": ''
        },
        field: {
          name: Lampa.Lang.translate('online_mod_helper_server'),
          description: Lampa.Lang.translate('online_mod_helper_server_descr')
        }
      });
    }

    function helperSettings(balanser_name, component_name) {
      if (Lampa.SettingsApi.getComponent(component_name)) return;

      {
        var icon = "<svg><use xlink:href=\"#sprite-settings\"></use></svg>";
        Lampa.SettingsApi.addComponent({
          component: component_name,
          icon: icon,
          name: balanser_name
        });
        Lampa.SettingsApi.addParam({
          component: 'online_mod',
          param: {
            name: component_name + '_settings',
            type: 'button'
          },
          field: {
            name: "<div class=\"settings-folder\" style=\"padding:0!important\"><div style=\"width:1.8em;height:1.3em;padding-right:.5em\">".concat(icon, "</div><div style=\"font-size:1.3em\">").concat(balanser_name, "</div></div>")
          },
          onChange: function onChange() {
            Lampa.Settings.create(component_name, {
              onBack: function onBack() {
                Lampa.Settings.create('online_mod');
              }
            });
          }
        });
      }

      addHelperServerParam(component_name);
    }

    alloha.initSettings = function () { helperSettings('Alloha', 'online_mod_alloha'); };

    alloha.hideSettings = function (body) {
      $('[data-component="online_mod_alloha"]', body).hide();
    };

    // Turbo (obrut.show via onomovie). Uses the Alloha helper server: obrut hides its playlist
    // behind a "confirm you are human" checkbox, which the user ticks once in a window served
    // through the helper; the helper then keeps that approval and reads playlists itself.
    function turbo(component, _object, config) {
      var network = new Lampa.Reguest();
      var extract = {
        embed: '',
        seasons: null,
        movie: null
      };
      var object = _object;
      var select_title = '';
      var server = Utils.helperServer();
      var filter_items = {};
      var choice = {
        season: 0,
        voice: 0,
        voice_name: ''
      };
      var poll = null;

      function getJson(url, ok, err) {
        network.clear();
        network.timeout(25000);
        network["native"](url, function (res) {
          if (typeof res === 'string') {
            try {
              res = JSON.parse(res);
            } catch (e) {
              res = null;
            }
          }
          ok(res);
        }, function (a, c) {
          err(network.errorDecode(a, c));
        }, false, {
          dataType: 'text'
        });
      }

      this.search = function (_object, kinopoisk_id) {
        object = _object;
        select_title = object.search || object.movie.title;
        if (!server) return component.empty(Lampa.Lang.translate('online_mod_turbo_no_server'));
        var kp = parseInt(kinopoisk_id, 10) || 0;
        var imdb = object.movie.imdb_id || '';
        if (!kp && !imdb) return component.emptyForQuery(select_title);
        var none = function () {
          component.emptyForQuery(select_title);
        };
        var find = function (api, next) {
          getJson('https://onomovie.ru/api/players?' + api, function (json) {
            var p = (json && json.data || []).filter(function (x) {
              return x.type === 'Turbo' && x.iframeUrl;
            })[0];
            p ? load(p.iframeUrl) : next();
          }, component.empty.bind(component));
        };
        find(kp ? 'kinopoisk=' + kp : 'imdb=' + imdb, function () {
          kp && imdb ? find('imdb=' + imdb, none) : none();
        });
      };

      function load(embed) {
        extract.embed = embed;
        getJson(server + '/turbo/playlist?url=' + encodeURIComponent(embed), function (res) {
          // No approval yet, or it expired: ask for the checkbox again instead of failing.
          if (res && res.verify) return verify(embed);
          if (!(res && res.file && res.file.length)) return component.emptyForQuery(select_title);
          shape(res.file);
          component.loading(false);
          filter();
          append(filtred());
        }, component.empty.bind(component));
      }

      function verify(embed) {
        // the «По сериям» probe opens no window: the source's own screen asks
        if (component.watch_probe) return component.empty(Lampa.Lang.translate('online_mod_turbo_captcha'));
        component.loading(false);
        var controller = Lampa.Controller.enabled().name;
        var link = server + '/turbo/verify?url=' + encodeURIComponent(embed);
        // A TV remote cannot tick a checkbox inside an iframe: the phone opens the same check through the server, which keeps the approval.
        var html = $('<div style="display:flex;gap:1.5em;height:70vh"><style>.turbo-qr svg,.turbo-qr img{display:block;width:100%;height:auto}</style><iframe src="' + link + '" style="flex:1;min-width:0;height:100%;border:0;border-radius:.6em;background:#111"></iframe><div class="turbo-qr-box" style="width:15em;flex-shrink:0;text-align:center"><div class="turbo-qr" style="background:#fff;padding:.7em;border-radius:.6em"></div><div style="margin-top:1em;line-height:1.4">' + Lampa.Lang.translate('online_mod_turbo_qr') + '</div></div></div>');
        if (Lampa.Utils.qrcode) Lampa.Utils.qrcode(link, html.find('.turbo-qr'), function () {
          html.find('.turbo-qr-box').remove();
        });else html.find('.turbo-qr-box').remove();
        var stop = function () {
          clearInterval(poll);
          poll = null;
          Lampa.Modal.close();
          Lampa.Controller.toggle(controller);
        };
        Lampa.Modal.open({
          title: Lampa.Lang.translate('online_mod_turbo_captcha'),
          html: html,
          size: 'large',
          onBack: function onBack() {
            stop();
            component.empty(Lampa.Lang.translate('online_mod_turbo_waiting'));
          }
        });
        poll = setInterval(function () {
          var net = new Lampa.Reguest();
          net.timeout(10000);
          net["native"](server + '/turbo/status', function (res) {
            if (typeof res === 'string') {
              try {
                res = JSON.parse(res);
              } catch (e) {
                res = null;
              }
            }
            if (!poll || !(res && res.approved)) return;
            stop();
            component.loading(true);
            load(embed);
          }, function () {}, false, {
            dataType: 'text'
          });
        }, 2000);
      }

      // Series: seasons → episodes → voices. Films: a flat voice list, sometimes one level down.
      function shape(file) {
        var first = file[0] || {};
        var node = (first.folder || [])[0] || {};
        extract.seasons = null;
        extract.movie = null;
        if (!first.folder && first.file) extract.movie = file;else if (!node.folder) extract.movie = first.folder || [];else extract.seasons = file;
      }

      function episodeNum(ep, i) {
        var m = String(ep.title || '').match(/(\d+)/);
        return m ? parseInt(m[1], 10) : i + 1;
      }

      this.extendChoice = function (saved) {
        Lampa.Arrays.extend(choice, saved, true);
      };

      this.reset = function () {
        component.reset();
        choice = {
          season: 0,
          voice: 0,
          voice_name: ''
        };
        filter();
        append(filtred());
        component.saveChoice(choice);
      };

      this.filter = function (type, a, b) {
        choice[a.stype] = b.index;
        if (a.stype == 'voice') choice.voice_name = filter_items.voice[b.index];
        component.reset();
        filter();
        append(filtred());
        component.saveChoice(choice);
      };

      this.destroy = function () {
        clearInterval(poll);
        poll = null;
        network.clear();
        extract = null;
      };

      function filter() {
        filter_items = {
          season: [],
          voice: [],
          voice_note: []
        };

        if (extract.seasons) {
          filter_items.season = extract.seasons.map(function (s, i) {
            return String(s.title || '').replace(/^Season/i, Lampa.Lang.translate('torrent_serial_season')) || Lampa.Lang.translate('torrent_serial_season') + ' ' + (i + 1);
          });
          if (!filter_items.season[choice.season]) choice.season = 0;
          var eps = {};
          (extract.seasons[choice.season].folder || []).forEach(function (ep, i) {
            var n = episodeNum(ep, i);
            (ep.folder || []).forEach(function (v) {
              if (filter_items.voice.indexOf(v.title) == -1) filter_items.voice.push(v.title);
              (eps[v.title] = eps[v.title] || []).push(n);
            });
          });
          filter_items.voice.forEach(function (name) {
            filter_items.voice_note.push(episodeRanges(eps[name] || []));
          });
        }

        if (!filter_items.voice[choice.voice]) choice.voice = 0;

        if (choice.voice_name) {
          var inx = filter_items.voice.indexOf(choice.voice_name);
          if (inx == -1) choice.voice = 0;else if (inx !== choice.voice) choice.voice = inx;
        }

        component.filter(filter_items, choice);
      }

      function qualityLabels(file) {
        return String(file || '').split(',').map(function (part) {
          return (part.match(/^\s*\[([^\]]+)\]/) || [])[1];
        }).filter(function (l) {
          return l && !/auto/i.test(l);
        });
      }

      function filtred() {
        var filtred = [];

        if (extract.seasons) {
          var season = extract.seasons[choice.season];
          var voice = filter_items.voice[choice.voice];
          if (!season || !voice) return filtred;
          (season.folder || []).forEach(function (ep, i) {
            var media = (ep.folder || []).filter(function (v) {
              return v.title === voice;
            })[0];
            if (!media) return;
            var n = episodeNum(ep, i);
            var labels = qualityLabels(media.file);
            filtred.push({
              title: component.formatEpisodeTitle(choice.season + 1, n),
              quality: labels.length ? labels[labels.length - 1] : '',
              info: ' / ' + Lampa.Utils.shortText(voice, 50),
              season: choice.season + 1,
              episode: n,
              file: media.file
            });
          });
        } else if (extract.movie) {
          extract.movie.forEach(function (media) {
            var labels = qualityLabels(media.file);
            filtred.push({
              title: media.title || select_title,
              quality: labels.length ? labels[labels.length - 1] : '',
              info: '',
              file: media.file
            });
          });
        }

        return filtred;
      }

      // "[720p]url,[Auto]url" → one link is resolved and the other qualities are derived from it; the player loads it directly.
      // CDN links carry an hourly expiry, so a resolved set is reused for 30 minutes only.
      function getStream(element, call, error) {
        // shortcut: a playlist cell keeps the link it resolved first, so returning to an episode after an hour in the same player session gets an expired link; re-open the episode from the list if that shows up.
        if (element.stream && Date.now() - (element.stream_time || 0) < 30 * 60 * 1000) return call(element);
        var parts = [];
        String(element.file || '').split(',').forEach(function (part) {
          var m = part.match(/^\s*\[([^\]]+)\]\s*(\S+)/);
          if (m) parts.push({ label: m[1], url: m[2] });
        });
        if (!parts.length) return error();
        var pick = null;
        parts.forEach(function (p) {
          if (!pick && /auto/i.test(p.label)) pick = p;
        });
        if (!pick) {
          var best = -Infinity;
          parts.forEach(function (p) {
            var n = parseInt(p.label, 10);
            if (!isNaN(n) && n > best) { best = n; pick = p; }
          });
        }
        if (!pick) pick = parts[0];
        var hasAutoPart = false;
        parts.forEach(function (p) { if (/auto/i.test(p.label)) hasAutoPart = true; });
        var pickIsAuto = /auto/i.test(pick.label);
        var net = new Lampa.Reguest();
        net.timeout(20000);
        net["native"](server + '/turbo/stream?json=1&u=' + encodeURIComponent(pick.url), function (res) {
          if (typeof res === 'string') {
            try {
              res = JSON.parse(res);
            } catch (e) {
              res = null;
            }
          }
          if (!res || !res.url) return error();
          var base = res.url.slice(0, res.url.lastIndexOf('/') + 1);
          var map = {};
          var auto = '';
          if (pickIsAuto) auto = res.url;
          parts.forEach(function (p) {
            if (/auto/i.test(p.label)) return;
            var n = parseInt(p.label, 10);
            if (isNaN(n)) return;
            if (p.label === pick.label) map[p.label] = res.url;
            else map[p.label] = base + n + '.mp4:hls:manifest.m3u8';
          });
          if (!pickIsAuto && hasAutoPart) auto = base + 'hls.m3u8';
          var labels = Object.keys(map).sort(function (a, b) {
            return parseInt(b, 10) - parseInt(a, 10);
          });
          element.stream = auto || labels.length && map[labels[0]] || '';
          element.stream_time = Date.now();
          element.qualitys = labels.length ? map : false;
          element.subtitles = false;
          element.stream ? call(element) : error();
        }, function () { error(); }, false, { dataType: 'text' });
      }

      function append(items) {
        component.reset();
        var viewed = Lampa.Storage.cache('online_view', 5000, []);
        var last_episode = component.getLastEpisode(items);
        items.forEach(function (element) {
          if (element.season) {
            element.translate_episode_end = last_episode;
            element.translate_voice = filter_items.voice[choice.voice];
          }

          var hash = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title].join('') : object.movie.original_title);
          var view = component.watchView(element, hash, items);
          var item = Lampa.Template.get('online_mod', element);
          var hash_file = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title, filter_items.voice[choice.voice]].join('') : object.movie.original_title + element.title);
          element.timeline = view;
          item.append(Lampa.Timeline.render(view));

          if (Lampa.Timeline.details) {
            item.find('.online__quality').append(Lampa.Timeline.details(view, ' / '));
          }

          if (viewed.indexOf(hash_file) !== -1) item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
          item.on('hover:enter', function () {
            if (element.loading) return;
            if (object.movie.id) Lampa.Favorite.add('history', object.movie, 100);
            element.loading = true;
            getStream(element, function (element) {
              element.loading = false;
              var first = {
                anime_skip: skipOf(element),
                url: component.getDefaultQuality(element.qualitys, element.stream, undefined, true),
                quality: component.renameQualityMap(element.qualitys),
                subtitles: element.subtitles,
                timeline: element.timeline,
                title: element.season ? element.title : select_title + (element.title == select_title ? '' : ' / ' + element.title)
              };

              if (element.season && Lampa.Platform.version) {
                var playlist = [];
                items.forEach(function (elem) {
                  if (elem == element) {
                    playlist.push(first);
                  } else {
                    var cell = {
                      anime_skip: skipOf(elem),
                      url: function url(call) {
                        getStream(elem, function (elem) {
                          cell.url = component.getDefaultQuality(elem.qualitys, elem.stream, undefined, true);
                          cell.quality = component.renameQualityMap(elem.qualitys);
                          cell.subtitles = elem.subtitles;
                          call();
                        }, function () {
                          cell.url = '';
                          call();
                        });
                      },
                      timeline: elem.timeline,
                      title: elem.title
                    };
                    playlist.push(cell);
                  }
                });
                playWithoutPreroll(first, playlist);
              } else {
                playWithoutPreroll(first, [first]);
              }

              if (viewed.indexOf(hash_file) == -1) {
                viewed.push(hash_file);
                item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
                Lampa.Storage.set('online_view', viewed);
              }
            }, function () {
              element.loading = false;
              Lampa.Noty.show(Lampa.Lang.translate('online_mod_nolink'));
            });
          });
          component.append(item);
          component.contextmenu({
            item: item,
            view: view,
            viewed: viewed,
            hash_file: hash_file,
            element: element,
            file: function file(call) {
              getStream(element, function (element) {
                call({
                  file: element.stream,
                  quality: element.qualitys
                });
              }, function () {
                Lampa.Noty.show(Lampa.Lang.translate('online_mod_nolink'));
              });
            }
          });
        });
        component.start(true);
      }
    }

    turbo.initSettings = function () {
      helperSettings('Turbo', 'online_mod_turbo');
    };

    turbo.hideSettings = function (body) {
      $('[data-component="online_mod_turbo"]', body).hide();
    };


    function kinopub(component, _object, config) {
      var network = new Lampa.Reguest();
      var extract = {};
      var object = _object;
      var select_title = '';
      var prefer_http = Lampa.Storage.field('online_mod_prefer_http') === true;
      var prox = component.proxy('kinopub');
      var embed = 'https://api.srvkp.com/v1/';
      var token = Utils.decodeSecret([56, 32, 0, 66, 18, 86, 49, 1, 70, 63, 40, 46, 83, 78, 22, 78, 119, 66, 20, 51, 33, 59, 16, 28, 91, 86, 41, 2, 64, 47, 125, 125]);
      var server = 'ru';
      var hls_type = 'hls';
      var replace_mask = /\/(pd|http|hls4|hls2|hls)\/[^\/]*/;
      var filter_items = {};
      var choice = {
        season: 0,
        voice: 0,
        voice_name: ''
      };
      var secret = '';

      function decodeSecretToken(callback) {
        {
          if (callback) callback();
          return;
        }
      }

      function kinopub_api_search(api, callback, error) {
        network.clear();
        network.timeout(10000);
        network["native"](component.proxyLink(embed + api, prox), function (json) {
          if (callback) callback(json);
        }, function (a, c) {
          if (error) error(network.errorDecode(a, c));
        });
      }
      /**
       * Поиск
       * @param {Object} _object
       */


      this.search = function (_object, kinopoisk_id, data) {
        var _this = this;

        object = _object;
        select_title = object.search || object.movie.title;
        if (this.wait_similars && data && data[0].is_similars) return success(data[0]);
        var search_date = object.search_date || !object.clarification && (object.movie.release_date || object.movie.first_air_date || object.movie.last_air_date) || '0000';
        var search_year = parseInt((search_date + '').slice(0, 4));
        var orig_titles = [];

        if (object.movie.alternative_titles && object.movie.alternative_titles.results) {
          orig_titles = object.movie.alternative_titles.results.map(function (t) {
            return t.title;
          });
        }

        if (object.movie.original_title) orig_titles.push(object.movie.original_title);
        if (object.movie.original_name) orig_titles.push(object.movie.original_name);

        var display = function display(items) {
          if (items && items.length && items.forEach) {
            var is_sure = false;
            var is_imdb = false;
            items.forEach(function (c) {
              var titles = (c.title || '').split(' / ');

              if (titles.length === 2) {
                c.full_title = c.title;
                c.title = titles[0].trim();
                c.orig_title = titles[1].trim();
              }
            });

            if (!object.clarification && (object.movie.imdb_id || +object.movie.kinopoisk_id)) {
              var imdb_id = object.movie.imdb_id && parseInt(object.movie.imdb_id.substring(2));
              var kp_id = +object.movie.kinopoisk_id;
              var tmp = items.filter(function (c) {
                return imdb_id && c.imdb == imdb_id || kp_id && c.kinopoisk == kp_id;
              });

              if (tmp.length) {
                items = tmp;
                is_sure = true;
                is_imdb = true;
              }
            }

            var cards = items;

            if (cards.length) {
              if (orig_titles.length) {
                var _tmp = cards.filter(function (c) {
                  return component.containsAnyTitle([c.orig_title, c.title, c.full_title], orig_titles);
                });

                if (_tmp.length) {
                  cards = _tmp;
                  is_sure = true;
                }
              }

              if (select_title) {
                var _tmp2 = cards.filter(function (c) {
                  return component.containsAnyTitle([c.title, c.orig_title, c.full_title], [select_title]);
                });

                if (_tmp2.length) {
                  cards = _tmp2;
                  is_sure = true;
                }
              }

              if (cards.length > 1 && search_year) {
                var _tmp3 = cards.filter(function (c) {
                  return c.year == search_year;
                });

                if (!_tmp3.length) _tmp3 = cards.filter(function (c) {
                  return c.year && c.year > search_year - 2 && c.year < search_year + 2;
                });
                if (_tmp3.length) cards = _tmp3;
              }
            }

            if (cards.length == 1 && is_sure && !is_imdb) {
              if (search_year && cards[0].year) {
                is_sure = cards[0].year > search_year - 2 && cards[0].year < search_year + 2;
              }

              if (is_sure) {
                is_sure = false;

                if (orig_titles.length) {
                  is_sure |= component.equalAnyTitle([cards[0].orig_title, cards[0].title, cards[0].full_title], orig_titles);
                }

                if (select_title) {
                  is_sure |= component.equalAnyTitle([cards[0].title, cards[0].orig_title, cards[0].full_title], [select_title]);
                }
              }
            }

            if (cards.length == 1 && is_sure) {
              success(cards[0]);
            } else {
              _this.wait_similars = true;
              items.forEach(function (c) {
                c.is_similars = true;
              });
              component.similars(items);
              component.loading(false);
            }
          } else component.emptyForQuery(select_title);
        };

        var error = component.empty.bind(component);
        var params = Lampa.Utils.addUrlComponent('items/search', 'access_token=' + token);
        params = Lampa.Utils.addUrlComponent(params, 'perpage=100');
        params = Lampa.Utils.addUrlComponent(params, 'field=title');
        params = Lampa.Utils.addUrlComponent(params, 'q=' + encodeURIComponent(select_title));
        decodeSecretToken(function () {
          kinopub_api_search(params, function (json) {
            display(json && json.items);
          }, error);
        });
      };

      this.extendChoice = function (saved) {
        Lampa.Arrays.extend(choice, saved, true);
      };
      /**
       * Сброс фильтра
       */


      this.reset = function () {
        component.reset();
        choice = {
          season: 0,
          voice: 0,
          voice_name: ''
        };
        filter();
        append(filtred());
        component.saveChoice(choice);
      };
      /**
       * Применить фильтр
       * @param {*} type
       * @param {*} a
       * @param {*} b
       */


      this.filter = function (type, a, b) {
        choice[a.stype] = b.index;
        if (a.stype == 'voice') choice.voice_name = filter_items.voice[b.index];
        component.reset();
        filter();
        append(filtred());
        component.saveChoice(choice);
      };
      /**
       * Уничтожить
       */


      this.destroy = function () {
        network.clear();
        extract = null;
      };

      function success(item) {
        var params = Lampa.Utils.addUrlComponent('items/' + item.id, 'access_token=' + token);
        var error = component.empty.bind(component);
        kinopub_api_search(params, function (json) {
          if (json && json.item && (json.item.videos && json.item.videos.length || json.item.seasons && json.item.seasons.length)) {
            component.loading(false);
            extractData(json.item);
            filter();
            append(filtred());
          } else component.emptyForQuery(select_title);
        }, error);
      }
      /**
       * Получить информацию о фильме
       * @param {Object} item
       */


      function extractData(item) {
        extract = item;

        if (extract.seasons) {
          extract.seasons.forEach(function (season) {
            var episodes = season.episodes || [];
            episodes.forEach(function (episode) {
              episode.streams = extractFiles(episode);
            });
          });
        } else if (extract.videos) {
          extract.videos.forEach(function (video) {
            video.streams = extractFiles(video);
          });
        }
      }

      function extractFiles(media) {
        var items = [];
        var files = media.files || [];
        files.forEach(function (file) {
          var label = file.quality || file.h && file.h + 'p' || '360p ~ 1080p';

          if (file.url) {
            var subtitles = false;

            if (file.url.http && file.file) {
              var base = file.url.http.match(/^(.*)\/demo\/demo\.mp4(.*)$/);

              if (!base) {
                var pos = file.url.http.indexOf((startsWith(file.file, '/') ? '' : '/') + file.file);
                if (pos !== -1) base = [file.url.http, file.url.http.substring(0, pos)];
              }

              if (base) {
                var base_url = base[1];

                if (replace_mask && secret) {
                  base_url = base_url.replace(replace_mask, secret);
                }

                base_url = component.fixLinkProtocol(base_url, prefer_http, 'full');

                if (media.subtitles) {
                  subtitles = media.subtitles.map(function (sub) {
                    return {
                      label: sub.lang + (sub.forced ? ' - forced' : ''),
                      url: component.processSubs(sub.file ? base_url + '/subtitles' + (startsWith(sub.file, '/') ? '' : '/') + sub.file + '?loc=' + server : '')
                    };
                  });
                  if (!subtitles.length) subtitles = false;
                }

                items.push({
                  height: file.h,
                  quality_id: file.quality_id,
                  label: label,
                  codec: file.codec,
                  type: 'http',
                  params: base[2],
                  file: base_url + (startsWith(file.file, '/') ? '' : '/') + file.file,
                  subtitles: subtitles
                });
              }
            }

            if (file.url.hls4) {
              var _base = file.url.hls4.match(/^(.*)\/demo\.m3u8(.*)$/);

              if (!_base) {
                var _pos = file.url.hls4.indexOf('/' + media.id + '.m3u8');

                if (_pos !== -1) _base = [file.url.hls4, file.url.hls4.substring(0, _pos)];
              }

              if (_base) {
                var _base_url = _base[1];

                if (replace_mask && secret) {
                  _base_url = _base_url.replace(replace_mask, secret);
                }

                _base_url = component.fixLinkProtocol(_base_url, prefer_http, 'full');
                items.push({
                  height: file.h,
                  quality_id: file.quality_id,
                  label: label,
                  codec: file.codec,
                  type: 'hls4',
                  params: _base[2],
                  file: _base_url + '/' + media.id + '.m3u8',
                  subtitles: subtitles
                });
              }
            }

            if (file.url.hls2) {
              var _base2 = file.url.hls2.match(/^(.*)\/demo\.m3u8(.*)$/);

              if (!_base2) {
                var _pos2 = file.url.hls2.indexOf('/' + media.id + '.m3u8');

                if (_pos2 !== -1) _base2 = [file.url.hls2, file.url.hls2.substring(0, _pos2)];
              }

              if (_base2) {
                var _base_url2 = _base2[1];

                if (replace_mask && secret) {
                  _base_url2 = _base_url2.replace(replace_mask, secret);
                }

                _base_url2 = component.fixLinkProtocol(_base_url2, prefer_http, 'full');
                items.push({
                  height: file.h,
                  quality_id: file.quality_id,
                  label: label,
                  codec: file.codec,
                  type: 'hls2',
                  params: _base2[2],
                  file: _base_url2 + '/' + media.id + '.m3u8',
                  subtitles: subtitles
                });
              }
            }

            if (file.url.hls && file.file) {
              var _base3 = file.url.hls.match(/^(.*)\/demo\/master-v1a1\.m3u8(.*)$/);

              if (!_base3) {
                var _pos3 = file.url.hls.indexOf((startsWith(file.file, '/') ? '' : '/') + file.file);

                if (_pos3 !== -1) _base3 = [file.url.hls, file.url.hls.substring(0, _pos3)];
              }

              if (_base3) {
                var _base_url3 = _base3[1];

                if (replace_mask && secret) {
                  _base_url3 = _base_url3.replace(replace_mask, secret);
                }

                _base_url3 = component.fixLinkProtocol(_base_url3, prefer_http, 'full');
                items.push({
                  height: file.h,
                  quality_id: file.quality_id,
                  label: label,
                  codec: file.codec,
                  type: 'hls',
                  params: _base3[2],
                  file: _base_url3 + (startsWith(file.file, '/') ? '' : '/') + file.file,
                  subtitles: subtitles
                });
              }
            }
          }
        });
        items.sort(function (a, b) {
          var cmp = b.height - a.height;
          if (cmp) return cmp;
          cmp = b.quality_id - a.quality_id;
          if (cmp) return cmp;
          if (b.label > a.label) return 1;
          if (b.label < a.label) return -1;
          if (b.codec > a.codec) return 1;
          if (b.codec < a.codec) return -1;
          if (b.type > a.type) return 1;
          if (b.type < a.type) return -1;
          return 0;
        });
        return items;
      }

      function getVoiceName(audio, full) {
        var voice_name;

        if (full) {
          voice_name = [audio.type && audio.type.title, audio.author && audio.author.title].filter(function (name) {
            return name;
          }).join(' - ');
        } else {
          var type = audio.type && audio.type.title || '';
          voice_name = type === 'Оригинал' ? type : audio.author && audio.author.title || type;
        }

        if (voice_name) voice_name += audio.lang && audio.lang !== 'und' && audio.lang !== 'rus' ? ' (' + audio.lang + ')' : '';else voice_name = audio.lang || '';
        return voice_name;
      }

      function getVoiceChoice(audios, full) {
        var voice_info = filter_items.voice_info[choice.voice];

        if (voice_info) {
          var type = voice_info.type && voice_info.type.title || '';
          var author = !full && type === 'Оригинал' ? '' : voice_info.author && voice_info.author.title;
          var lang = voice_info.lang || '';

          if (author) {
            var tmp = audios.filter(function (audio) {
              return audio.author && audio.author.title === author;
            });
            if (tmp.length) audios = tmp;

            if (type && full) {
              tmp = tmp.filter(function (audio) {
                return audio.type && audio.type.title === type;
              });
              if (tmp.length) audios = tmp;
            }
          }

          if (lang) {
            var _tmp4 = audios.filter(function (audio) {
              return audio.lang === lang;
            });

            if (_tmp4.length) audios = _tmp4;
          }

          if (!author) {
            var _tmp5 = audios.filter(function (audio) {
              return !full && audio.type && audio.type.title === 'Оригинал' || !(audio.author && audio.author.title);
            });

            if (_tmp5.length) audios = _tmp5;

            if (type) {
              _tmp5 = _tmp5.filter(function (audio) {
                return audio.type && audio.type.title === type;
              });
              if (_tmp5.length) audios = _tmp5;
            }
          }
        }

        return audios.length == 1 ? audios[0] : null;
      }
      /**
       * Построить фильтр
       */


      function filter() {
        filter_items = {
          season: extract.seasons ? extract.seasons.map(function (season) {
            return Lampa.Lang.translate('torrent_serial_season') + ' ' + season.number + (season.title ? ' - ' + season.title : '');
          }) : [],
          voice: [],
          voice_info: []
        };
        if (!filter_items.season[choice.season]) choice.season = 0;

        if (extract.seasons || extract.videos && extract.videos.length > 1) {
          var episodes;

          if (extract.seasons) {
            var season = extract.seasons[choice.season];
            episodes = season && season.episodes || [];
          } else episodes = extract.videos;

          episodes.forEach(function (episode) {
            var audios = episode.audios || [];
            audios.forEach(function (audio) {
              var voice_name = getVoiceName(audio);

              if (voice_name && filter_items.voice.indexOf(voice_name) == -1) {
                filter_items.voice.push(voice_name);
                filter_items.voice_info.push(audio);
              }
            });
          });
        }

        if (!filter_items.voice[choice.voice]) choice.voice = 0;

        if (choice.voice_name) {
          var inx = filter_items.voice.indexOf(choice.voice_name);
          if (inx == -1) choice.voice = 0;else if (inx !== choice.voice) {
            choice.voice = inx;
          }
        }

        component.filter(filter_items, choice);
      }
      /**
       * Отфильтровать файлы
       * @returns array
       */


      function filtred() {
        var filtred = [];

        if (extract.seasons) {
          var season = extract.seasons[choice.season];
          var episodes = season && season.episodes || [];
          episodes.forEach(function (episode) {
            var audios = episode.audios || [];
            var audio = getVoiceChoice(audios);
            var voice_name;
            if (audio) voice_name = getVoiceName(audio);else {
              audio = {};
              var voice_names = audios.map(function (audio) {
                return getVoiceName(audio);
              }).filter(function (name) {
                return name;
              });
              voice_name = component.uniqueNamesShortText(voice_names, 80);
            }
            filtred.push({
              title: component.formatEpisodeTitle(season.number, episode.number, episode.title),
              orig_title: extract.title || select_title,
              quality: extract.quality ? extract.quality + 'p' : '360p ~ 1080p',
              info: voice_name ? ' / ' + voice_name : '',
              season: '' + season.number,
              episode: parseInt(episode.number),
              audio_index: audio.index,
              media: episode
            });
          });
        } else if (extract.videos && extract.videos.length > 1) {
          extract.videos.forEach(function (video, index) {
            var audios = video.audios || [];
            var audio = getVoiceChoice(audios);
            var voice_name;
            if (audio) voice_name = getVoiceName(audio);else {
              audio = {};
              var voice_names = audios.map(function (audio) {
                return getVoiceName(audio);
              }).filter(function (name) {
                return name;
              });
              voice_name = component.uniqueNamesShortText(voice_names, 80);
            }
            var episode_num = video.number != null ? video.number : index + 1;
            var title = episode_num + (video.title ? ' - ' + video.title : '');
            filtred.push({
              title: title,
              orig_title: extract.title || select_title,
              quality: extract.quality ? extract.quality + 'p' : '360p ~ 1080p',
              info: voice_name ? ' / ' + voice_name : '',
              season: 1,
              episode: parseInt(episode_num),
              audio_index: audio.index,
              media: video
            });
          });
        } else if (extract.videos) {
          extract.videos.forEach(function (video) {
            var audios = video.audios || [];

            if (!audios.length) {
              audios.push({});
            }

            audios.forEach(function (audio) {
              filtred.push({
                title: getVoiceName(audio, true) || video.title || select_title,
                orig_title: extract.title || select_title,
                quality: extract.quality ? extract.quality + 'p' : '360p ~ 1080p',
                info: audio.codec && audio.codec !== 'aac' ? ' / ' + audio.codec : '',
                audio_index: audio.index,
                media: video
              });
            });
          });
        }

        return filtred;
      }
      /**
       * Найти поток
       * @param {Object} element
       * @returns string
       */


      function getFile(element) {
        var file = '';
        var quality = false;
        var subtitles = false;
        var items = element.media.streams || [];
        items = items.filter(function (elem) {
          return elem.type === hls_type;
        });

        {
          var tmp = items.filter(function (elem) {
            return elem.codec === 'h265';
          });
          if (tmp.length) items = tmp;
        }

        {
          var _tmp6 = items.filter(function (elem) {
            return elem.codec === 'h264';
          });

          if (_tmp6.length) items = _tmp6;
        }

        if (items && items.length) {
          var file_end = items[0].type === 'hls' ? element.audio_index ? '/master-v1a' + element.audio_index + '.m3u8' : '/master.m3u8' : '';
          file_end += '?loc=' + server;
          file = items[0].file + file_end;
          subtitles = items[0].subtitles;

          if (items.some(function (item) {
            return item.file != items[0].file;
          })) {
            quality = {};
            items.forEach(function (item) {
              quality[item.label] = item.file + file_end;
            });
          }
        }

        return {
          file: file,
          quality: quality,
          subtitles: subtitles
        };
      }
      /**
       * Показать файлы
       */


      function append(items) {
        component.reset();
        var viewed = Lampa.Storage.cache('online_view', 5000, []);
        items.forEach(function (element) {
          var hash = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title, element.orig_title].join('') : object.movie.original_title + element.orig_title);
          var view = component.watchView(element, hash, items);
          var item = Lampa.Template.get('online_mod', element);
          var hash_file = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title, element.orig_title, filter_items.voice[choice.voice]].join('') : object.movie.original_title + element.orig_title + element.title);
          element.timeline = view;
          item.append(Lampa.Timeline.render(view));

          if (Lampa.Timeline.details) {
            item.find('.online__quality').append(Lampa.Timeline.details(view, ' / '));
          }

          if (viewed.indexOf(hash_file) !== -1) item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
          item.on('hover:enter', function () {
            if (object.movie.id) Lampa.Favorite.add('history', object.movie, 100);
            var extra = getFile(element);

            if (extra.file) {
              var playlist = [];
              var first = {
                url: component.getDefaultQuality(extra.quality, extra.file),
                quality: component.renameQualityMap(extra.quality),
                subtitles: extra.subtitles,
                timeline: element.timeline,
                title: element.season ? element.title : select_title + (element.title == select_title ? '' : ' / ' + element.title)
              };

              if (element.season) {
                items.forEach(function (elem) {
                  var ex = getFile(elem);
                  playlist.push({
                    url: component.getDefaultQuality(ex.quality, ex.file),
                    quality: component.renameQualityMap(ex.quality),
                    subtitles: ex.subtitles,
                    timeline: elem.timeline,
                    title: elem.title
                  });
                });
              } else {
                playlist.push(first);
              }

              if (playlist.length > 1) first.playlist = playlist;
              playWithoutPreroll(first, playlist);

              if (viewed.indexOf(hash_file) == -1) {
                viewed.push(hash_file);
                item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
                Lampa.Storage.set('online_view', viewed);
              }
            } else Lampa.Noty.show(Lampa.Lang.translate('online_mod_nolink'));
          });
          component.append(item);
          component.contextmenu({
            item: item,
            view: view,
            element: element,
            viewed: viewed,
            hash_file: hash_file,
            file: function file(call) {
              call(getFile(element));
            }
          });
        });
        component.start(true);
      }
    }

    kinopub.initSettings = function (show_all) {
      var balanser_name = 'KinoPub';
      var component_name = 'online_mod_kinopub';
      if (Lampa.SettingsApi.getComponent(component_name)) return;

      {
        var icon = "<svg><use xlink:href=\"#sprite-settings\"></use></svg>";
        Lampa.SettingsApi.addComponent({
          component: component_name,
          icon: icon,
          name: balanser_name
        });
        Lampa.SettingsApi.addParam({
          component: 'online_mod',
          param: {
            name: component_name + '_settings',
            type: 'button'
          },
          field: {
            name: "<div class=\"settings-folder\" style=\"padding:0!important\"><div style=\"width:1.8em;height:1.3em;padding-right:.5em\">".concat(icon, "</div><div style=\"font-size:1.3em\">").concat(balanser_name, "</div></div>")
          },
          onChange: function onChange() {
            Lampa.Settings.create(component_name, {
              onBack: function onBack() {
                Lampa.Settings.create('online_mod');
              }
            });
          }
        });
      }

      {
        Lampa.SettingsApi.addParam({
          component: component_name,
          param: {
            name: 'online_mod_proxy_kinopub',
            type: 'trigger',
            "default": false
          },
          field: {
            name: Lampa.Lang.translate('online_mod_proxy_balanser') + ' ' + balanser_name
          }
        });
      }
    };

    kinopub.hideSettings = function (body) {
      $('[data-component="online_mod_kinopub"]', body).hide();
    };

    /**
     * Naruto Based (anime.home.kopenkin.tech)
     * Uses the site's Lampa-friendly API:
     *   /api/catalog?q=...        - search
     *   /api/series/<slug>        - series + episodes + mirrors
     *   /api/lampa/play/<slug>    - 302 to a proxied mp4 (language aware)
     */
    function narutobased(component, _object, config) {
      var network = new Lampa.Reguest();
      var qualityResolver = new Lampa.Reguest();
      var qualityCache = {};
      var playingInProgress = false;
      var object = _object;
      var extract = null;
      var select_title = '';
      var site = ((Lampa.Storage.get('online_mod_narutobased_site', '') || '') + '').replace(/\/+$/, '') || 'https://anime.home.kopenkin.tech';
      var filter_items = {};
      var choice = {
        season: 0,
        voice: -1
      };

      function russian() {
        return Lampa.Storage.get('language', 'ru') === 'ru';
      }

      function languageLabel(language) {
        if (language === 'dub') return Lampa.Lang.translate('online_mod_dub');
        if (language === 'sub') return Lampa.Lang.translate('online_mod_sub');
        return language;
      }

      function seriesName(series) {
        return (russian() && series.titleRussian) || series.titleEnglish || series.titleRomaji || series.title || select_title;
      }

      function seasonName(season) {
        var label = (season.label || (russian() && season.titleRussian) || season.titleEnglish || Lampa.Lang.translate('online_mod_season')) + '';
        if (season.year && label.indexOf(String(season.year)) === -1) label += ' (' + season.year + ')';
        return label;
      }

      function playableMirror(mirror) {
        var code = String(mirror.sourceCode);
        var token = (mirror.token || '') + '';
        return Boolean(token && !/^\*+$/.test(token) && ['4', '14', '26', '44', '5'].indexOf(code) !== -1);
      }

      function hasSource(episode) {
        return (episode.mirrors || []).some(playableMirror);
      }

      function languagesOf(episode) {
        var result = [];
        (episode.mirrors || []).forEach(function (mirror) {
          if (!playableMirror(mirror)) return;
          var language = mirror.language;
          if (language && result.indexOf(language) === -1) result.push(language);
        });
        return result;
      }

      function playUrl(episode, language) {
        return site + '/api/lampa/play/' + encodeURIComponent(episode.slug) + '?language=' + encodeURIComponent(language);
      }

      /**
       * URL that returns the source list for one episode. Cheap to build: it
       * only packs the mirror tokens, no network request is made here.
       */
      // The site's player passes these: the proxy then replaces the ending music
      // for the anime that has one (e.g. Steel Ball Run). Without them it plays the original.
      function episodeQuery(malId, episode) {
        if (malId == null || malId === '' || episode == null || episode === '') return '';
        return '&malId=' + encodeURIComponent(malId) + '&episode=' + encodeURIComponent(episode);
      }

      function basedUrl(mirrors, malId, episode) {
        var seen = {};
        var query = [];

        (mirrors || []).forEach(function (mirror) {
          if (!mirror || !mirror.sourceCode) return;

          var key = mirror.sourceCode + ':' + mirror.token;
          if (seen[key]) return;

          seen[key] = true;
          query.push('source=' + encodeURIComponent(key));
        });

        return query.length ? site + '/api/player/based?' + query.join('&') + episodeQuery(malId, episode) : '';
      }

      function inSeason(episode, season) {
        if (!season) return true;
        if (episode.seasonSlug === season.slug) return true;
        return (season.aliases || []).indexOf(episode.seasonSlug) !== -1;
      }

      function toCard(series) {
        var years = (series.seasons || []).map(function (season) {
          return parseInt(season.year) || 0;
        }).filter(Boolean);
        return {
          id: series.slug,
          slug: series.slug,
          title: seriesName(series),
          ru_title: series.titleRussian || '',
          en_title: series.titleEnglish || '',
          orig_title: series.titleRomaji || series.title || '',
          year: years.length ? Math.max.apply(null, years) : '',
          seasons_count: (series.seasons || []).length,
          episodes_count: (series.seasons || []).reduce(function (sum, season) {
            return sum + (parseInt(season.episodesWithPayload) || 0);
          }, 0)
        };
      }

      function episodeShowName(episode) {
        return (russian() && episode.showTitleRussian) || episode.showTitleEnglish || episode.showTitleRomaji || episode.showTitle || select_title;
      }

      function episodeDisplayTitle(episode) {
        var show = episodeShowName(episode);
        var number = episode.episodeNumber;
        var title = episode.title ? ' — ' + episode.title : '';
        var label = Lampa.Lang.translate('online_mod_episode');
        return show + (number != null ? ' · ' + label + ' ' + number : '') + title;
      }

      function episodeCard(episode) {
        var year = '';
        if (episode.releasedAt) {
          var date = new Date(episode.releasedAt);
          if (!isNaN(date.getTime())) year = String(date.getFullYear());
        }
        return {
          id: episode.slug,
          slug: episode.slug,
          episode: episode,
          title: episodeDisplayTitle(episode),
          orig_title: episode.title || episodeShowName(episode),
          year: year,
          seasons_count: 1,
          episodes_count: 1
        };
      }

      function playEpisodeDirect(episode) {
        // the «По сериям» probe never plays: the source's own screen does
        if (component.watch_probe) return component.empty('');
        var languages = languagesOf(episode);
        var noSources = Lampa.Lang.translate('online_mod_no_sources');

        if (!languages.length) {
          Lampa.Noty.show(noSources);
          return;
        }

        var start = function (language) {
          var mirrors = (episode.mirrors || []).filter(function (mirror) {
            return playableMirror(mirror) && mirror.language === language;
          });

          if (!mirrors.length) {
            Lampa.Noty.show(noSources);
            return;
          }

          var element = {
            title: episodeDisplayTitle(episode),
            orig_title: episode.title || episodeShowName(episode),
            quality: 'auto',
            info: ' / ' + languageLabel(language),
            season: 0,
            episode: episode.episodeNumber,
            malId: episode.malId,
            trackingKey: episode.trackingKey || episode.slug,
            slug: episode.slug,
            language: language,
            mirrors: mirrors.map(function (mirror) {
              return { sourceCode: mirror.sourceCode, token: mirror.token };
            }),
            media: [{
              label: 'auto',
              quality: 1080,
              file: playUrl(episode, language)
            }]
          };

          element.timeline = Lampa.Timeline.view(Lampa.Utils.hash('naruto-based:' + (episode.trackingKey || episode.slug)));
          Lampa.Storage.set('naruto_based_language', language);

          if (object.movie && object.movie.id) Lampa.Favorite.add('history', object.movie, 100);

          var external = isExternalAndroidPlayer();
          var cached = getCachedQuality(element);
          var playNow = function (qualityMap) {
            startPlayback(element, [element], qualityMap, external);
          };

          if (external && !cached) {
            try {
              Lampa.Loading.start(function () {});
            } catch (e) {}

            try {
              resolveQuality(element, function (qualityMap) {
                try {
                  Lampa.Loading.stop();
                } catch (e) {}
                playNow(qualityMap);
              }, function () {
                try {
                  Lampa.Loading.stop();
                } catch (e) {}
                playNow(null);
              });
            } catch (e) {
              try {
                Lampa.Loading.stop();
              } catch (e2) {}
              playNow(null);
            }
          } else {
            playNow(cached);

            if (!external && !cached) {
              try {
                resolveQuality(element, function (qualityMap) {
                  applyBackgroundQuality(element, qualityMap);
                }, function () {});
              } catch (e) {}
            }
          }
        };

        if (languages.length === 1) {
          start(languages[0]);
          return;
        }

        var preferred = Lampa.Storage.get('naruto_based_language', 'sub');
        if (languages.indexOf(preferred) === -1) preferred = languages[0];

        Lampa.Select.show({
          title: episodeDisplayTitle(episode),
          items: languages.map(function (language) {
            return { title: languageLabel(language), language: language };
          }),
          onSelect: function (item) {
            start(item.language);
          }
        });
      }

      function displayEpisodes(episodes) {
        var seen = {};
        var cards = episodes.filter(function (episode) {
          var key = String(episode.slug);
          if (seen[key]) return false;
          seen[key] = true;
          return true;
        }).map(episodeCard);

        if (!cards.length) {
          component.emptyForQuery(select_title);
          return;
        }

        if (cards.length === 1) {
          playEpisodeDirect(cards[0].episode);
          return;
        }

        component.similars(cards);
        component.loading(false);
      }

      function normalizeEpisodes() {
        var seen = {};
        return (extract.episodes || []).filter(function (episode) {
          var key = String(episode.slug);
          if (seen[key]) return false;
          seen[key] = true;
          return true;
        });
      }

      function buildSeasons() {
        var seasons = (extract.series.seasons || []).filter(function (season) {
          return normalizeEpisodes().some(function (episode) {
            return inSeason(episode, season) && hasSource(episode);
          });
        });
        extract.seasons = seasons;
        return seasons;
      }

      function buildLanguages() {
        var seasons = extract.seasons || [];
        var season = seasons[choice.season] || seasons[0];
        var languages = [];
        normalizeEpisodes().forEach(function (episode) {
          if (!inSeason(episode, season)) return;
          languagesOf(episode).forEach(function (language) {
            if (languages.indexOf(language) === -1) languages.push(language);
          });
        });
        if (!languages.length) languages.push('sub');
        var preferred = Lampa.Storage.get('naruto_based_language', 'sub');
        var preferred_index = languages.indexOf(preferred);
        if (preferred_index === -1) preferred_index = 0;
        if (choice.voice < 0 || choice.voice >= languages.length) choice.voice = preferred_index;
        extract.languages = languages;
        return languages;
      }

      function clampChoice() {
        if (!extract) return;
        var seasons = extract.seasons || [];
        if (choice.season < 0 || choice.season >= seasons.length) choice.season = 0;
        var languages = extract.languages || [];
        if (choice.voice < 0 || choice.voice >= languages.length) choice.voice = 0;
      }

      function filter() {
        filter_items = {
          season: [],
          voice: []
        };
        if (!extract || !extract.series) {
          component.filter(filter_items, choice);
          return;
        }
        buildSeasons();
        clampChoice();
        var languages = buildLanguages();
        clampChoice();
        filter_items.season = (extract.seasons || []).map(seasonName);
        filter_items.voice = languages.map(function (language) {
          return languageLabel(language);
        });
        component.filter(filter_items, choice);
      }

      function getFile(element) {
        var items = element.media || [];
        var file = '';
        var quality = false;
        if (items.length) {
          file = items[0].file;
          quality = {};
          items.forEach(function (item) {
            quality[item.label] = item.file;
          });
        }
        return {
          file: file,
          quality: quality
        };
      }

      function parseJsonText(text) {
        if (text && typeof text === 'object') return text;
        var str = String(text || '');
        var start = str.indexOf('{');
        var end = str.lastIndexOf('}');
        if (start === -1 || end === -1 || end < start) throw new Error('No JSON in response');
        return JSON.parse(str.slice(start, end + 1));
      }

      // Fastest/reliable providers first. Anything unknown sorts before Mail.
      var providerPriority = ['dzen', 'allvideo', 'vk', 'ok', 'plvideo', 'sibnet', 'myvi', 'ustore', 'mail', 'youtube'];

      function providerRank(provider) {
        var name = String(provider || '').toLowerCase();
        for (var i = 0; i < providerPriority.length; i++) {
          if (name.indexOf(providerPriority[i]) !== -1) return i;
        }
        return providerPriority.length - 1;
      }

      function qualityWeight(quality) {
        var value = parseInt(quality, 10);
        return isNaN(value) ? 0 : value;
      }

      function qualityMapFromPayload(payload) {
        var sources = (payload && payload.sources) || [];
        if (!sources.length && payload && payload.src) {
          sources = [{ quality: payload.quality, src: payload.src }];
        }

        var candidates = [];

        sources.forEach(function (source) {
          var src = (source.src || '') + '';
          if (!src) return;
          if (src.indexOf('//') === 0) src = 'https:' + src;
          else if (!/^https?:\/\//i.test(src)) src = site + (src.charAt(0) === '/' ? '' : '/') + src;
          candidates.push({
            key: (source.quality || 'auto') + '',
            src: src,
            rank: providerRank(source.provider)
          });
        });

        // Same quality from several providers: keep the preferred provider.
        candidates.sort(function (a, b) {
          return qualityWeight(b.key) - qualityWeight(a.key) || a.rank - b.rank;
        });

        var map = {};
        candidates.forEach(function (item) {
          if (!map[item.key]) map[item.key] = item.src;
        });

        return map;
      }

      /**
       * Quality entries for an external player (DDD).
       *
       * Every label must point at its own URL: DDD deduplicates by full URL and
       * keeps the first entry. Quality labels of one provider can share a path
       * (Dzen) — the variant is chosen by the signed query string, so the whole
       * URL is the identity. Duplicate labels between providers are dropped:
       * the faster provider always comes first.
       */
      function qualityOptionsFromPayload(payload) {
        var sources = (payload && payload.sources) || [];
        if (!sources.length && payload && payload.src) {
          sources = [{ quality: payload.quality, src: payload.src, provider: payload.provider }];
        }

        var candidates = [];

        sources.forEach(function (source) {
          var src = (source.src || '') + '';
          if (!src) return;
          if (src.indexOf('//') === 0) src = 'https:' + src;
          else if (!/^https?:\/\//i.test(src)) src = site + (src.charAt(0) === '/' ? '' : '/') + src;
          candidates.push({
            name: (source.quality || 'auto') + '',
            url: src,
            rank: providerRank(source.provider),
            weight: qualityWeight(source.quality)
          });
        });

        // Preferred provider first, best quality within it.
        candidates.sort(function (a, b) {
          return a.rank - b.rank || b.weight - a.weight;
        });

        var options = [];
        var files = {};
        var covered = {};

        candidates.forEach(function (item) {
          if (files[item.url]) return;
          if (covered[item.name]) return;

          files[item.url] = true;
          covered[item.name] = true;
          options.push({ name: item.name, url: item.url });
        });

        return options;
      }

      function getCachedOptions(element) {
        var cached = qualityCache[qualityCacheKey(element)];

        if (cached && Date.now() - cached.time < 5 * 60 * 1000) {
          return cached.options || null;
        }

        return null;
      }

      function pickBestQuality(map) {
        var best = '';
        var bestValue = -1;
        for (var key in map) {
          if (!Object.prototype.hasOwnProperty.call(map, key)) continue;
          var value = parseInt(key, 10);
          if (isNaN(value)) value = 0;
          if (value > bestValue) {
            bestValue = value;
            best = key;
          }
        }
        return best ? map[best] : '';
      }

      function qualityCacheKey(element) {
        return (element.slug || '') + ':' + (element.language || '');
      }

      function getCachedQuality(element) {
        var cached = qualityCache[qualityCacheKey(element)];

        if (cached && Date.now() - cached.time < 5 * 60 * 1000) {
          return cached.map;
        }

        return null;
      }

      function applyBackgroundQuality(element, qualityMap, attempt) {
        if (!qualityMap) return;

        attempt = attempt || 0;

        var opened = Lampa.Player && typeof Lampa.Player.opened === 'function' && Lampa.Player.opened();
        var active = opened && typeof Lampa.Player.playdata === 'function' ? Lampa.Player.playdata() : null;

        if (!opened || !active) {
          if (attempt < 6) {
            setTimeout(function () {
              applyBackgroundQuality(element, qualityMap, attempt + 1);
            }, 500);
          }
          return;
        }

        if (active.slug !== element.slug || active.language !== element.language) return;

        if (Lampa.PlayerPanel && typeof Lampa.PlayerPanel.quality === 'function') {
          Lampa.PlayerPanel.quality(component.renameQualityMap(qualityMap), active.url);
        }
      }

      function resolveQuality(element, success, fail, fast) {
        var cacheKey = qualityCacheKey(element);
        var cached = qualityCache[cacheKey];
        if (cached && Date.now() - cached.time < 5 * 60 * 1000) {
          success(cached.map);
          return;
        }

        var mirrors = element.mirrors || [];
        var seen = {};
        var query = [];
        mirrors.forEach(function (mirror) {
          var key = mirror.sourceCode + ':' + mirror.token;
          if (seen[key]) return;
          seen[key] = true;
          query.push('source=' + encodeURIComponent(key));
        });

        if (!query.length) {
          fail();
          return;
        }

        var url = site + '/api/player/based?' + query.join('&') + episodeQuery(element.malId, element.episode);
        var options = { dataType: 'text' };
        var done = false;
        var finish = function (text) {
          if (done) return;
          done = true;
          try {
            var payload = payloadOf(parseJsonText(text));
            var map = qualityMapFromPayload(payload);
            if (!pickBestQuality(map)) throw new Error('No playable sources');
            qualityCache[cacheKey] = { time: Date.now(), map: map, options: qualityOptionsFromPayload(payload) };
            success(map);
          } catch (e) {
            fail();
          }
        };

        qualityResolver.clear();
        qualityResolver.timeout(1000 * 20);
        qualityResolver.silent(url, finish, function () {
          if (done) return;

          if (fast) {
            done = true;
            fail();
            return;
          }

          var proxy = (Lampa.Storage.get('online_mod_narutobased_quality_proxy', 'https://r.jina.ai/') || '') + '';
          if (!proxy) {
            done = true;
            fail();
            return;
          }
          var proxied = proxy.indexOf('{url}') !== -1 ? proxy.replace('{url}', encodeURIComponent(url)) : proxy + encodeURIComponent(url);
          qualityResolver.clear();
          qualityResolver.timeout(1000 * 30);
          qualityResolver.silent(proxied, finish, function () {
            if (done) return;
            done = true;
            fail();
          }, null, options);
        }, null, options);
      }

      function startPlayback(element, items, qualityMap, external) {
        var extra = getFile(element);
        var autoUrl = component.getDefaultQuality(extra.quality, extra.file);
        var quality = qualityMap ? component.renameQualityMap(qualityMap) : component.renameQualityMap(extra.quality);
        var url = qualityMap ? pickBestQuality(qualityMap) || autoUrl : autoUrl;
        var first = {
          anime_skip: skipOf(element),
          url: url,
          quality: quality,
          timeline: element.timeline,
          title: element.title,
          slug: element.slug,
          language: element.language,
          naruto_mal_id: element.malId,
          naruto_episode: element.episode
        };

        if (external) {
          var dddQualities = [{ name: 'Auto', url: autoUrl }];
          var used = {};
          used[autoUrl] = true;

          var listed = getCachedOptions(element);

          if (!listed && qualityMap) {
            // Fallback when only the plain quality map is available.
            listed = [];
            for (var qualityName in qualityMap) {
              if (!Object.prototype.hasOwnProperty.call(qualityMap, qualityName)) continue;
              if (String(qualityName).toLowerCase() === 'auto') continue;
              listed.push({ name: qualityName, url: qualityMap[qualityName] });
            }
          }

          (listed || []).forEach(function (option) {
            if (!option || !option.url || used[option.url]) return;
            used[option.url] = true;
            dddQualities.push({ name: option.name, url: option.url });
          });

          if (qualityMap) first.quality = qualityMap;

          first.ddd_quality = JSON.stringify(dddQualities);
          attachQualityHeader(first);
        }
        var playlist = [];
        var found = false;
        var pushCurrent = function () {
          playlist.push({
            anime_skip: first.anime_skip,
            url: first.url,
            quality: first.quality,
            qualitySourceUrl: basedUrl(element.mirrors, element.malId, element.episode),
            timeline: first.timeline,
            title: first.title,
            slug: first.slug,
            language: first.language,
            naruto_mal_id: first.naruto_mal_id,
            naruto_episode: first.naruto_episode
          });
        };

        if (element.season) {
          items.forEach(function (elem) {
            if (elem === element) {
              pushCurrent();
              found = true;
              return;
            }

            var ex = getFile(elem);
            var fallbackUrl = component.getDefaultQuality(ex.quality, ex.file);
            var qualitySourceUrl = basedUrl(elem.mirrors, elem.malId, elem.episode);

            if (external) {
              playlist.push({
                anime_skip: skipOf(elem),
                url: fallbackUrl,
                quality: component.renameQualityMap(ex.quality),
                qualitySourceUrl: qualitySourceUrl,
                timeline: elem.timeline,
                title: elem.title,
                slug: elem.slug,
                language: elem.language
              });
              return;
            }

            // Lampa's own player needs a real quality map per item, otherwise
            // the panel shows no quality options for the next episode.
            var cell = {
              anime_skip: skipOf(elem),
              url: function url(call) {
                resolveQuality(elem, function (map) {
                  cell.url = component.getDefaultQuality(map, fallbackUrl) || fallbackUrl;
                  cell.quality = component.renameQualityMap(map);
                  call();
                }, function () {
                  cell.url = fallbackUrl;
                  call();
                }, true);
              },
              quality: {},
              qualitySourceUrl: qualitySourceUrl,
              timeline: elem.timeline,
              title: elem.title,
              slug: elem.slug,
              language: elem.language,
              naruto_mal_id: elem.malId,
              naruto_episode: elem.episode
            };

            playlist.push(cell);
          });
        }

        if (!found) pushCurrent();
        if (playlist.length > 1) first.playlist = playlist;

        playWithoutPreroll(first, playlist);
      }

      function filtred() {
        if (!extract || !extract.series) return [];
        var seasons = extract.seasons || [];
        var season = seasons[choice.season] || seasons[0];
        var languages = extract.languages || ['sub'];
        var language = languages[choice.voice] || languages[0] || 'sub';
        var season_number = season ? seasons.indexOf(season) + 1 : 1;
        var multiple_seasons = seasons.length > 1;
        var seen = {};
        var list = [];

        normalizeEpisodes().forEach(function (episode) {
          if (!inSeason(episode, season)) return;
          if (!hasSource(episode)) return;
          if (languagesOf(episode).indexOf(language) === -1) return;
          var number = String(episode.episodeNumber);
          if (seen[number]) return;
          seen[number] = true;
          var mirrors = (episode.mirrors || []).filter(function (mirror) {
            return playableMirror(mirror) && mirror.language === language;
          });
          list.push({
            title: component.formatEpisodeTitle(multiple_seasons ? season_number : null, episode.episodeNumber, episode.title || ''),
            orig_title: seriesName(extract.series),
            quality: 'auto',
            info: ' / ' + languageLabel(language),
            season: season_number,
            episode: episode.episodeNumber,
            malId: episode.malId,
            trackingKey: episode.trackingKey || episode.slug,
            slug: episode.slug,
            language: language,
            mirrors: mirrors.map(function (mirror) {
              return { sourceCode: mirror.sourceCode, token: mirror.token };
            }),
            media: [{
              label: 'auto',
              quality: 1080,
              file: playUrl(episode, language)
            }]
          });
        });

        list.sort(function (a, b) {
          return parseInt(a.episode) - parseInt(b.episode);
        });

        return list;
      }

      function append(items) {
        component.reset();
        var viewed = Lampa.Storage.cache('online_view', 5000, []);
        var movie_title = object.movie.original_title || object.movie.title || object.movie.name || '';

        items.forEach(function (element) {
          var hash = element.trackingKey ? Lampa.Utils.hash('naruto-based:' + element.trackingKey) : Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, movie_title, element.orig_title].join('') : movie_title + element.orig_title);
          var view = Lampa.Timeline.view(hash);
          var item = Lampa.Template.get('online_mod', element);
          var hash_file = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, movie_title, element.orig_title].join('') : movie_title + element.orig_title + element.title);
          element.timeline = view;
          item.append(Lampa.Timeline.render(view));

          if (Lampa.Timeline.details) {
            item.find('.online__quality').append(Lampa.Timeline.details(view, ' / '));
          }

          if (viewed.indexOf(hash_file) !== -1) {
            item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
          }

          item.on('hover:enter', function () {
            if (playingInProgress || element._playing) return;
            if (object.movie.id) Lampa.Favorite.add('history', object.movie, 100);
            var extra = getFile(element);

            if (!extra.file) {
              Lampa.Noty.show(Lampa.Lang.translate('online_mod_nolink'));
              return;
            }

            element._playing = true;
            playingInProgress = true;

            var external = isExternalAndroidPlayer();
            var cached = getCachedQuality(element);

            var markViewed = function () {
              if (viewed.indexOf(hash_file) === -1) {
                viewed.push(hash_file);
                item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
                Lampa.Storage.set('online_view', viewed);
              }
            };

            var finish = function (qualityMap) {
              element._playing = false;
              playingInProgress = false;

              startPlayback(element, items, qualityMap, external);
              markViewed();

              if (!external && !qualityMap) {
                try {
                  resolveQuality(element, function (resolved) {
                    applyBackgroundQuality(element, resolved);
                  }, function () {});
                } catch (e) {}
              }
            };

            if (external && !cached) {
              try {
                Lampa.Loading.start(function () {});
              } catch (e) {}

              try {
                resolveQuality(element, function (qualityMap) {
                  try {
                    Lampa.Loading.stop();
                  } catch (e) {}
                  finish(qualityMap);
                }, function () {
                  try {
                    Lampa.Loading.stop();
                  } catch (e) {}
                  finish(null);
                });
              } catch (e) {
                try {
                  Lampa.Loading.stop();
                } catch (e2) {}
                finish(null);
              }
            } else {
              finish(cached);
            }
          });

          component.append(item);
          component.contextmenu({
            item: item,
            view: view,
            element: element,
            viewed: viewed,
            hash_file: hash_file,
            file: function (call) {
              call(getFile(element));
            }
          });
        });

        component.start(true);
      }

      function payloadOf(json) {
        if (!json) return null;
        if (json.ok === false) return null;
        return json.data || json;
      }

      function getSeries(slug) {
        var url = site + '/api/series/' + encodeURIComponent(slug);
        network.clear();
        network.timeout(1000 * 20);
        network.silent(url, function (json) {
          var payload = payloadOf(json);
          if (!payload || !payload.series || !payload.episodes || !payload.episodes.length) {
            component.emptyForQuery(select_title);
            return;
          }
          extract = {
            series: payload.series,
            episodes: payload.episodes,
            seasons: [],
            languages: []
          };
          var seasons = buildSeasons();
          if (!seasons.length) {
            component.emptyForQuery(select_title);
            return;
          }
          if (choice.season < 0 || choice.season >= seasons.length) choice.season = 0;
          buildLanguages();
          clampChoice();
          component.loading(false);
          filter();
          append(filtred());
        }, function (a, c) {
          component.empty(network.errorDecode(a, c));
        });
      }

      function display(cards) {
        if (cards.length === 1) {
          getSeries(cards[0].slug);
          return;
        }
        component.similars(cards);
        component.loading(false);
      }

      this.search = function (_object, kinopoisk_id, data) {
        object = _object;
        select_title = object.search || object.movie.title || object.movie.name || '';

        if (data && data[0] && data[0].episode) {
          playEpisodeDirect(data[0].episode);
          return;
        }

        if (data && data[0] && data[0].slug) {
          getSeries(data[0].slug);
          return;
        }

        var queries = [];
        var addQuery = function (value) {
          value = (value || '') + '';
          if (!value) return;
          var normalized = component.normalizeTitle(value);
          if (!normalized) return;
          var exists = queries.some(function (query) {
            return component.normalizeTitle(query) === normalized;
          });
          if (!exists) queries.push(value);
        };

        addQuery(select_title);
        addQuery(object.movie.title);
        addQuery(object.movie.name);
        addQuery(object.movie.original_title);
        addQuery(object.movie.original_name);

        if (object.movie.alternative_titles && object.movie.alternative_titles.results) {
          object.movie.alternative_titles.results.forEach(function (title) {
            addQuery(title.title);
          });
        }

        if (!queries.length) {
          component.emptyForQuery(select_title);
          return;
        }

        var tryNext = function (index) {
          if (index >= queries.length) {
            component.emptyForQuery(select_title);
            return;
          }
          var query = queries[index];
          var url = site + '/api/catalog?page=1&q=' + encodeURIComponent(query);
          network.clear();
          network.timeout(1000 * 15);
          network.silent(url, function (json) {
            var payload = payloadOf(json);
            var cards = ((payload && payload.series) || []).map(toCard);

            if (cards.length) {
              display(cards);
              return;
            }

            var episodes = (payload && payload.episodes) || [];
            if (episodes.length) {
              displayEpisodes(episodes);
              return;
            }

            tryNext(index + 1);
          }, function (a, c) {
            component.empty(network.errorDecode(a, c));
          });
        };

        tryNext(0);
      };

      this.extendChoice = function (saved) {
        Lampa.Arrays.extend(choice, saved, true);
      };

      this.reset = function () {
        component.reset();
        choice = {
          season: 0,
          voice: -1
        };
        if (!extract) {
          filter_items = {
            season: [],
            voice: []
          };
          component.filter(filter_items, choice);
          return;
        }
        buildSeasons();
        buildLanguages();
        clampChoice();
        filter();
        append(filtred());
        component.saveChoice(choice);
      };

      this.filter = function (type, a, b) {
        choice[a.stype] = b.index;
        if (a.stype === 'voice' && extract && extract.languages && extract.languages[b.index]) {
          Lampa.Storage.set('naruto_based_language', extract.languages[b.index]);
        }
        component.reset();
        filter();
        append(filtred());
        component.saveChoice(choice);
      };

      this.destroy = function () {
        network.clear();
        qualityResolver.clear();
        qualityCache = {};
        extract = null;
      };
    }

    var disable_dbg = !Utils.isDebug();
    var isAndroid = Lampa.Platform.is('android');
    isAndroid && Utils.checkAndroidVersion(339);
    var collapsBlocked = (!startsWith(window.location.protocol, 'http') || window.location.hostname.indexOf('lampa') !== -1) && disable_dbg;
    var Balancers = [{
      name: 'lumex',
      title: 'Lumex',
      module: lumex,
      config: {},
      search: false,
      kp: false,
      imdb: true,
      disabled: true
    }, {
      name: 'lumex2',
      title: 'Lumex (Ads)',
      module: lumex2,
      config: {},
      search: false,
      kp: false,
      imdb: true,
      disabled: true
    }, {
      name: 'rezka2',
      title: 'HDrezka',
      module: rezka2,
      config: {},
      search: true,
      kp: false,
      imdb: false,
      disabled: false
    }, {
      name: 'kinobase',
      title: 'Kinobase',
      module: kinobase,
      config: {},
      search: true,
      kp: false,
      imdb: false,
      disabled: true
    }, {
      name: 'collaps',
      title: 'Collaps',
      module: collaps,
      config: {},
      search: false,
      kp: true,
      imdb: true,
      disabled: collapsBlocked
    }, {
      name: 'collaps-dash',
      title: 'Collaps (DASH)',
      module: collaps,
      config: {
        prefer_dash: true
      },
      search: false,
      kp: true,
      imdb: true,
      disabled: collapsBlocked
    }, {
      name: 'cdnmovies',
      title: 'CDNMovies',
      module: cdnmovies,
      config: {},
      search: false,
      kp: true,
      imdb: true,
      disabled: true
    }, {
      name: 'filmix',
      title: 'Filmix',
      module: filmix,
      config: {},
      search: true,
      kp: false,
      imdb: false,
      disabled: false
    }, {
      name: 'zetflix',
      title: 'Zetflix',
      module: zetflix,
      config: {},
      search: false,
      kp: true,
      imdb: false,
      disabled: true
    }, {
      name: 'fancdn',
      title: 'FanCDN',
      module: fancdn,
      config: {},
      search: true,
      kp: false,
      imdb: false,
      disabled: disable_dbg
    }, {
      name: 'fancdn2',
      title: 'FanCDN (ID)',
      module: fancdn2,
      config: {},
      search: false,
      kp: true,
      imdb: true,
      disabled: true
    }, {
      name: 'fanserials',
      title: 'FanSerials',
      module: fanserials,
      config: {},
      search: false,
      kp: true,
      imdb: false,
      disabled: disable_dbg && !isAndroid
    }, {
      name: 'videoseed',
      title: 'VideoSeed',
      module: videoseed,
      config: {},
      search: false,
      kp: true,
      imdb: true,
      disabled: true
    }, {
      name: 'vibix',
      title: 'Vibix',
      module: vibix,
      config: {},
      search: false,
      kp: true,
      imdb: true,
      disabled: true
    }, {
      name: 'redheadsound',
      title: 'RedHeadSound',
      module: redheadsound,
      config: {},
      search: true,
      kp: false,
      imdb: true,
      disabled: true
    }, {
      name: 'redheadsound-dash',
      title: 'RedHeadSound (DASH)',
      module: redheadsound,
      config: {
        prefer_dash: true
      },
      search: true,
      kp: false,
      imdb: true,
      disabled: true
    }, {
      name: 'cdnvideohub',
      title: 'CDNVideoHub',
      module: cdnvideohub,
      config: {},
      search: false,
      kp: true,
      imdb: false,
      disabled: false
    }, {
      name: 'anilibria',
      title: 'AniLibria',
      module: anilibria,
      config: {},
      search: true,
      kp: false,
      imdb: false,
      disabled: true
    }, {
      name: 'anilibria2',
      title: 'AniLibria.top',
      module: anilibria2,
      config: {},
      search: true,
      kp: false,
      imdb: false,
      disabled: false
    }, {
      name: 'animelib',
      title: 'AnimeLib',
      module: animelib,
      config: {},
      search: true,
      kp: false,
      imdb: false,
      disabled: true
    }, {
      name: 'kodik',
      title: 'Kodik',
      module: kodik,
      config: {},
      search: true,
      kp: true,
      imdb: true,
      disabled: false
    }, {
      name: 'narutobased',
      title: 'Naruto Based',
      module: narutobased,
      config: {},
      search: true,
      kp: false,
      imdb: false,
      disabled: false
    }, {
      name: 'alloha',
      title: 'Alloha',
      module: alloha,
      config: {},
      search: false,
      kp: true,
      imdb: true,
      disabled: false
    }, {
      name: 'turbo',
      title: 'Turbo',
      module: turbo,
      config: {},
      search: false,
      kp: true,
      imdb: true,
      disabled: false
    }, {
      name: 'kinopub',
      title: 'KinoPub',
      module: kinopub,
      config: {},
      search: true,
      kp: false,
      imdb: true,
      disabled: true
    }];

    var proxyInitialized = {};
    var proxyWindow = {};
    var proxyCalls = {};
    var default_balanser = 'cdnvideohub';

    // The user's order of the sources (the «По сериям» screen, the source list): their names in Lampa's storage,
    // a source not listed keeps the plugin's order after them
    function applyOrder() {
      if (!applyOrder.base) applyOrder.base = Balancers.map(function (b) {
        return b.name;
      });
      var order = Lampa.Storage.get('online_mod_order', '[]');
      if (!Array.isArray(order)) order = [];
      var base = applyOrder.base;
      var rank = function rank(name) {
        var i = order.indexOf(name);
        return i >= 0 ? i : 1000 + base.indexOf(name);
      };
      Balancers.sort(function (a, b) {
        return rank(a.name) - rank(b.name);
      });
    }

    // a source one place up (-1), down (1) or first ('top') among the ones that are on
    function moveBalancer(name, delta) {
      var on = Balancers.filter(function (b) {
        return !b.disabled;
      }).map(function (b) {
        return b.name;
      });
      var off = Balancers.filter(function (b) {
        return b.disabled;
      }).map(function (b) {
        return b.name;
      });
      var i = on.indexOf(name);
      if (i < 0) return;
      var j = delta === 'top' ? 0 : Math.max(0, Math.min(on.length - 1, i + delta));
      if (j === i) return;
      on.splice(i, 1);
      on.splice(j, 0, name);
      Lampa.Storage.set('online_mod_order', on.concat(off));
      applyOrder();
    }

    function component(object) {
      var _this = this;

      var network = new Lampa.Reguest();
      var scroll = new Lampa.Scroll({
        mask: true,
        over: true
      });
      var files = new Lampa.Explorer(object);
      var filter = new Lampa.Filter(object);
      var balanser = Lampa.Storage.get('online_mod_balanser', default_balanser) + '';
      var last_bls = Lampa.Storage.field('online_mod_save_last_balanser') === true ? Lampa.Storage.cache('online_mod_last_balanser', 200, {}) : {};
      var last_filter = null;
      var forcedQuality = '';
      var qualityFilter = {
        title: Lampa.Lang.translate('settings_player_quality'),
        subtitle: '',
        items: [],
        stype: 'quality'
      };
      var contextmenu_all = [];

      if (last_bls[object.movie.id]) {
        balanser = last_bls[object.movie.id];
      }

      this.proxy = function (name) {
        return Utils.proxy(name);
      };

      this.fixLink = function (link, referrer) {
        return Utils.fixLink(link, referrer);
      };

      this.fixLinkProtocol = function (link, prefer_http, replace_protocol) {
        return Utils.fixLinkProtocol(link, prefer_http, replace_protocol);
      };

      this.proxyLink = function (link, proxy, proxy_enc, enc) {
        return Utils.proxyLink(link, proxy, proxy_enc, enc);
      };

      this.proxyStream = function (url, name) {
        return url;
      };

      this.processSubs = function (url) {
        return url;
      };

      this.proxyStreamSubs = function (url, name) {
        var srtUrl = this.processSubs(url);
        if (srtUrl !== url) return srtUrl;
        return this.proxyStream(url, name);
      };

      // the source this screen runs (the «По сериям» probe drives it without the screen)
      this.source = function () {
        return sources[balanser];
      };

      this.checkMyIp = function (onComplite) {
        Utils.checkMyIp(network, onComplite);
      };

      var last;
      // "По сериям": the pinned episode is focused once; the balancer's season is switched at most once to find it
      var pin_done = false;
      var pin_tried = false;
      var pick_done = false;
      // «По сериям»: until when the picked voice may still start playing; the source's last choice
      var pick_play = 0;
      var pick_season_done = false;
      // the source's redraws so far, and the one the season switch waits for (-1: no switch)
      var filter_count = 0;
      var pick_mark = -1;
      var last_choice = null;
      var similar_auto = {};
      var extended;
      var selected_id;
      var filter_translate = {
        season: Lampa.Lang.translate('torrent_serial_season'),
        voice: Lampa.Lang.translate('torrent_parser_voice'),
        audio: Lampa.Lang.translate('online_mod_audio_track'),
        source: Lampa.Lang.translate('settings_rest_source')
      };
      var all_sources = Balancers.map(function (s) {
        var source = new s.module(_this, object, s.config);
        return Object.assign({
          source: source
        }, s);
      });
      var obj_filter_sources = all_sources.filter(function (s) {
        return !s.disabled;
      });
      var filter_sources = obj_filter_sources.map(function (s) {
        return s.name;
      });
      var sources = {};
      obj_filter_sources.forEach(function (s) {
        sources[s.name] = s.source;
      });
      var search_sources = all_sources.filter(function (s) {
        return s.search;
      }).map(function (s) {
        return s.name;
      });
      var kp_sources = all_sources.filter(function (s) {
        return s.kp;
      }).map(function (s) {
        return s.name;
      });
      var imdb_sources = all_sources.filter(function (s) {
        return s.imdb;
      }).map(function (s) {
        return s.name;
      }); // шаловливые ручки

      if (object.balancer && filter_sources.indexOf(object.balancer) !== -1) {
        balanser = object.balancer;
      }

      if (filter_sources.indexOf(balanser) == -1) {
        balanser = default_balanser;

        if (filter_sources.indexOf(balanser) == -1) {
          balanser = filter_sources[0];
        }

        Lampa.Storage.set('online_mod_balanser', balanser);
      }

      scroll.body().addClass('torrent-list');
      scroll.minus(files.render().find('.explorer__files-head'));
      /**
       * Подготовка
       */

      this.create = function () {
        var _this2 = this;

        this.activity.loader(true);

        filter.onSearch = function (value) {
          Lampa.Activity.replace({
            search: value,
            search_date: '',
            clarification: true
          });
        };

        filter.onBack = function () {
          _this2.start();
        };

        filter.onSelect = function (type, a, b) {
          if (type == 'filter') {
            if (a.reset) {
              if (extended) sources[balanser].reset();else _this2.start();
            } else if (a.stype == 'source') {
              _this2.changeBalanser(filter_sources[b.index]);
            } else if (a.stype == 'quality') {
              forcedQuality = b.title;

              _this2.updateQualityFilter();
            } else {
              sources[balanser].filter(type, a, b);
            }
          } else if (type == 'sort') {
            if (a && a.modss) {
              if (a.vip) {
                Lampa.Noty.show(Lampa.Lang.translate('online_mod_modss_vip'));
                return;
              }

              jumpToModss(a.source);
              return;
            }

            _this2.changeBalanser(a.source);
          }
        };

        filter.render().find('.filter--sort span').text(Lampa.Lang.translate('online_mod_balanser'));
        files.appendHead(filter.render());
        files.appendFiles(scroll.render());
        this.search();
        return this.render();
      };

      this.changeBalanser = function (balanser_name) {
        balanser = balanser_name;
        Lampa.Storage.set('online_mod_balanser', balanser);
        last_bls[object.movie.id] = balanser;

        if (Lampa.Storage.field('online_mod_save_last_balanser') === true) {
          Lampa.Storage.set('online_mod_last_balanser', last_bls);
        }

        this.search();
        setTimeout(this.closeFilter, 10);
      };

      function jumpToModss(source) {
        var target = null;

        try {
          var all = Lampa.Activity.all();

          for (var i = all.length - 1; i >= 0; i--) {
            if (all[i] && all[i].component === 'modss_online' && all[i].activity && all[i].activity.component) {
              target = all[i];
              break;
            }
          }
        } catch (e) {}

        try {
          if (typeof Lampa.Activity.backward === 'function') Lampa.Activity.backward();
          else Lampa.Activity.back();
        } catch (e) {
          try {
            Lampa.Activity.back();
          } catch (e2) {}
        }

        if (!target) return;

        // Let the Modss component switch its own source: it keeps its list,
        // icons, VIP checks and choice state untouched.
        setTimeout(function () {
          try {
            target.activity.component.changeBalanser(source);
          } catch (e) {}
        }, 400);
      }

      this.updateQualityFilter = function () {
        var preferably = forcedQuality;

        if (!preferably) {
          preferably = Lampa.Storage.get('video_quality_default', '1080') + 'p';
          if (preferably === '1080p') preferably = '1080p Ultra';
        }

        var items = ['2160p', '1440p', '1080p Ultra', '1080p', '720p', '480p'].map(function (quality, i) {
          return {
            title: quality,
            selected: quality === preferably,
            index: i
          };
        });
        qualityFilter.subtitle = preferably;
        qualityFilter.items = items;
        setTimeout(this.closeFilter, 10);
      };
      /**
       * Начать поиск
       */


      this.search = function () {
        this.activity.loader(true);
        this.filter({
          source: filter_sources
        }, {
          source: 0
        });
        this.reset();
        this.find();
      };

      this.cleanTitle = function (str) {
        return str.replace(/[\s.,:;’'`!?]+/g, ' ').trim();
      };

      this.kpCleanTitle = function (str) {
        return this.cleanTitle(str).replace(/^[ \/\\]+/, '').replace(/[ \/\\]+$/, '').replace(/\+( *[+\/\\])+/g, '+').replace(/([+\/\\] *)+\+/g, '+').replace(/( *[\/\\]+ *)+/g, '+');
      };

      this.normalizeTitle = function (str) {
        return this.cleanTitle(str.toLowerCase().replace(/[\-\u2010-\u2015\u2E3A\u2E3B\uFE58\uFE63\uFF0D]+/g, '-').replace(/ё/g, 'е'));
      };

      this.equalTitle = function (t1, t2) {
        return typeof t1 === 'string' && typeof t2 === 'string' && this.normalizeTitle(t1) === this.normalizeTitle(t2);
      };

      this.containsTitle = function (str, title) {
        return typeof str === 'string' && typeof title === 'string' && this.normalizeTitle(str).indexOf(this.normalizeTitle(title)) !== -1;
      };

      this.equalAnyTitle = function (strings, titles) {
        var _this3 = this;

        return titles.some(function (title) {
          return title && strings.some(function (str) {
            return str && _this3.equalTitle(str, title);
          });
        });
      };

      this.containsAnyTitle = function (strings, titles) {
        var _this4 = this;

        return titles.some(function (title) {
          return title && strings.some(function (str) {
            return str && _this4.containsTitle(str, title);
          });
        });
      };

      this.uniqueNamesShortText = function (names, limit) {
        var unique = [];
        names.forEach(function (name) {
          if (name && unique.indexOf(name) == -1) unique.push(name);
        });

        if (limit && unique.length > 1) {
          var length = 0;
          var limit_index = -1;
          var last_index = unique.length - 1;
          unique.forEach(function (name, index) {
            length += name.length;
            if (limit_index == -1 && length > limit - (index == last_index ? 0 : 5)) limit_index = index;
            length += 2;
          });

          if (limit_index != -1) {
            unique = unique.splice(0, Math.max(limit_index, 1));
            unique.push('...');
          }
        }

        return unique.join(', ');
      };

      this.decodeHtml = function (html) {
        var text = document.createElement("textarea");
        text.innerHTML = html;
        return text.value;
      };

      this.vcdn_api_search = function (api, data, callback, error) {
        if (callback) callback(data);
        return;
      };

      this.kp_api_search = function (api, callback, error) {
        // one per probe, cancelled with it (a late answer would land in a destroyed screen)
        var own = this.watch_probe ? this.kp_net || (this.kp_net = new Lampa.Reguest()) : undefined;
        if (!own) KP.clear();
        KP.getFromCache(api, function (json, cached) {
          var items = [];
          if (json.items && json.items.length) items = json.items;else if (json.films && json.films.length) items = json.films;
          if (!cached && items.length) KP.setCache(api, json);
          if (callback) callback(items);
        }, function (a, c) {
          if (error) error(network.errorDecode(a, c));
        }, own);
      };

      this.find = function () {
        var _this5 = this;

        var query = object.search || object.movie.title;
        var search_date = object.search_date || !object.clarification && (object.movie.release_date || object.movie.first_air_date || object.movie.last_air_date) || '0000';
        var search_year = parseInt((search_date + '').slice(0, 4));
        var orig_titles = [];

        if (object.movie.alternative_titles && object.movie.alternative_titles.results) {
          orig_titles = object.movie.alternative_titles.results.map(function (t) {
            return t.title;
          });
        }

        if (object.movie.original_title) orig_titles.push(object.movie.original_title);
        if (object.movie.original_name) orig_titles.push(object.movie.original_name);

        var postprocess = function postprocess(items, success, error) {
          if (items && items.length && items.forEach) {
            var is_sure = false;
            var is_imdb = false;
            items.forEach(function (c) {
              if (c.start_date === '1969-12-31') c.start_date = '';
              if (c.year === '1969-12-31') c.year = '';
              var year = c.start_date || c.year || '0000';
              c.tmp_year = parseInt((year + '').slice(0, 4));
            });

            if (!object.clarification && (object.movie.imdb_id || +object.movie.kinopoisk_id)) {
              var imdb_id = object.movie.imdb_id;
              var kp_id = +object.movie.kinopoisk_id;
              var tmp = items.filter(function (c) {
                return imdb_id && (c.imdb_id || c.imdbId) == imdb_id || kp_id && (c.kp_id || c.kinopoisk_id || c.kinopoiskId || c.filmId) == kp_id;
              });

              if (tmp.length) {
                items = tmp;
                is_sure = true;
                is_imdb = true;
              }
            }

            var cards = items;

            if (cards.length) {
              if (orig_titles.length) {
                var _tmp = cards.filter(function (c) {
                  return _this5.containsAnyTitle([c.orig_title || c.nameOriginal, c.en_title || c.nameEn, c.title || c.ru_title || c.nameRu], orig_titles);
                });

                if (_tmp.length) {
                  cards = _tmp;
                  is_sure = true;
                }
              }

              if (query) {
                var _tmp2 = cards.filter(function (c) {
                  return _this5.containsAnyTitle([c.title || c.ru_title || c.nameRu, c.en_title || c.nameEn, c.orig_title || c.nameOriginal], [query]);
                });

                if (_tmp2.length) {
                  cards = _tmp2;
                  is_sure = true;
                }
              }

              if (cards.length > 1 && search_year) {
                var _tmp3 = cards.filter(function (c) {
                  return c.tmp_year == search_year;
                });

                if (!_tmp3.length) _tmp3 = cards.filter(function (c) {
                  return c.tmp_year && c.tmp_year > search_year - 2 && c.tmp_year < search_year + 2;
                });
                if (_tmp3.length) cards = _tmp3;
              }
            }

            if (cards.length == 1 && is_sure && !is_imdb) {
              if (search_year && cards[0].tmp_year) {
                is_sure = cards[0].tmp_year > search_year - 2 && cards[0].tmp_year < search_year + 2;
              }

              if (is_sure) {
                is_sure = false;

                if (orig_titles.length) {
                  is_sure |= _this5.equalAnyTitle([cards[0].orig_title || cards[0].nameOriginal, cards[0].en_title || cards[0].nameEn, cards[0].title || cards[0].ru_title || cards[0].nameRu], orig_titles);
                }

                if (query) {
                  is_sure |= _this5.equalAnyTitle([cards[0].title || cards[0].ru_title || cards[0].nameRu, cards[0].en_title || cards[0].nameEn, cards[0].orig_title || cards[0].nameOriginal], [query]);
                }
              }
            }

            if (cards.length == 1 && is_sure) success(cards);else error(items);
          } else error([]);
        };

        var display = function display(items) {
          postprocess(items, function (cards) {
            _this5.extendChoice();

            sources[balanser].search(object, cards[0].kp_id || cards[0].kinopoisk_id || cards[0].kinopoiskId || cards[0].filmId || cards[0].imdb_id, cards);
          }, function (items) {
            if (items.length) {
              items.forEach(function (c) {
                if (c.episodes) {
                  var season_count = 1;
                  c.episodes.forEach(function (episode) {
                    if (episode.season_num > season_count) {
                      season_count = episode.season_num;
                    }
                  });
                  c.seasons_count = season_count;
                  c.episodes_count = c.episodes.length;
                }
              });

              _this5.similars(items);

              _this5.loading(false);
            } else _this5.emptyForQuery(query);
          });
        };

        var vcdn_search_by_title = function vcdn_search_by_title(callback, error) {
          var params = Lampa.Utils.addUrlComponent('', Utils.vcdnToken());
          params = Lampa.Utils.addUrlComponent(params, 'query=' + encodeURIComponent(query));
          params = Lampa.Utils.addUrlComponent(params, 'field=title');

          _this5.vcdn_api_search('movies' + params, [], function (data) {
            _this5.vcdn_api_search('animes' + params, data, function (data) {
              _this5.vcdn_api_search('tv-series' + params, data, function (data) {
                _this5.vcdn_api_search('anime-tv-series' + params, data, function (data) {
                  _this5.vcdn_api_search('show-tv-series' + params, data, callback, error);
                }, error);
              }, error);
            }, error);
          }, error);
        };

        var vcdn_search_by_id = function vcdn_search_by_id(callback, error) {
          if (!object.clarification && (object.movie.imdb_id || +object.movie.kinopoisk_id)) {
            var params = Lampa.Utils.addUrlComponent('', Utils.vcdnToken());
            var imdb_params = object.movie.imdb_id ? Lampa.Utils.addUrlComponent(params, 'imdb_id=' + encodeURIComponent(object.movie.imdb_id)) : '';
            var kp_params = +object.movie.kinopoisk_id ? Lampa.Utils.addUrlComponent(params, 'kinopoisk_id=' + encodeURIComponent(+object.movie.kinopoisk_id)) : '';

            _this5.vcdn_api_search('short' + (imdb_params || kp_params), [], function (data) {
              if (data && data.length) callback(data);else if (imdb_params && kp_params) {
                _this5.vcdn_api_search('short' + kp_params, [], callback, error);
              } else callback([]);
            }, error);
          } else callback([]);
        };

        var vcdn_search = function vcdn_search(fallback) {
          var error = function error() {
            if (fallback) fallback();else display([]);
          };

          vcdn_search_by_id(function (data) {
            if (data && data.length && data.forEach) display(data);else vcdn_search_by_title(function (data) {
              if (data && data.length && data.forEach) display(data);else error();
            }, error);
          }, error);
        };

        var kp_search_by_title = function kp_search_by_title(callback, error) {
          var url = 'api/v2.1/films/search-by-keyword?keyword=' + encodeURIComponent(_this5.kpCleanTitle(query));

          _this5.kp_api_search(url, callback, error);
        };

        var kp_search_by_id = function kp_search_by_id(callback, error) {
          if (!object.clarification && object.movie.imdb_id) {
            var url = 'api/v2.2/films?imdbId=' + encodeURIComponent(object.movie.imdb_id);

            _this5.kp_api_search(url, callback, error);
          } else callback([]);
        };

        var kp_search = function kp_search(fallback) {
          var error = function error() {
            if (fallback) fallback();else display([]);
          };

          kp_search_by_id(function (data) {
            if (data && data.length && data.forEach) display(data);else kp_search_by_title(function (data) {
              if (data && data.length && data.forEach) display(data);else error();
            }, error);
          }, error);
        };

        var vcdn_search_imdb = function vcdn_search_imdb() {
          var error = function error() {
            if (imdb_sources.indexOf(balanser) >= 0) {
              var error1 = function error1() {
                _this5.extendChoice();

                sources[balanser].search(object, object.movie.imdb_id);
              };

              if (search_sources.indexOf(balanser) >= 0) error1();else {
                kp_search_by_title(function (data) {
                  postprocess(data, function (cards) {
                    _this5.extendChoice();

                    sources[balanser].search(object, cards[0].kp_id || cards[0].kinopoisk_id || cards[0].kinopoiskId || cards[0].filmId || cards[0].imdb_id, cards);
                  }, function (items) {
                    error1();
                  });
                }, error1);
              }
            } else if (search_sources.indexOf(balanser) >= 0) {
              _this5.extendChoice();

              sources[balanser].search(object);
            } else {
              var error2 = function error2() {
                display([]);
              };

              kp_search_by_title(function (data) {
                if (data && data.length && data.forEach) display(data);else error2();
              }, error2);
            }
          };

          vcdn_search_by_id(function (data) {
            if (data && data.length && data.forEach) display(data);else error();
          }, error);
        };

        var kp_search_imdb = function kp_search_imdb() {
          kp_search_by_id(function (data) {
            if (data && data.length && data.forEach) display(data);else vcdn_search_imdb();
          }, vcdn_search_imdb);
        };

        var letgo = function letgo() {
          if (!object.clarification && +object.movie.kinopoisk_id && kp_sources.indexOf(balanser) >= 0) {
            _this5.extendChoice();

            sources[balanser].search(object, +object.movie.kinopoisk_id);
          } else if (!object.clarification && object.movie.imdb_id && kp_sources.indexOf(balanser) >= 0) {
            kp_search_imdb();
          } else if (search_sources.indexOf(balanser) >= 0) {
            _this5.extendChoice();

            sources[balanser].search(object);
          } else {
            if (balanser == 'lumex' || balanser == 'lumex2') {
              var fallback = function fallback() {
                if (!object.clarification && (+object.movie.kinopoisk_id || object.movie.imdb_id)) {
                  _this5.extendChoice();

                  sources[balanser].search(object, +object.movie.kinopoisk_id || object.movie.imdb_id);
                } else if (Lampa.Storage.field('online_mod_skip_kp_search') !== true) kp_search();else display([]);
              };

              vcdn_search(fallback);
            } else kp_search(vcdn_search);
          }
        };

        if (!object.movie.imdb_id && (object.movie.source == 'tmdb' || object.movie.source == 'cub') && (imdb_sources.indexOf(balanser) >= 0 || kp_sources.indexOf(balanser) >= 0)) {
          var tmdburl = (object.movie.name ? 'tv' : 'movie') + '/' + object.movie.id + '/external_ids?api_key=4ef0d7355d9ffb5151e987764708ce96&language=ru';
          var baseurl = typeof Lampa.TMDB !== 'undefined' ? Lampa.TMDB.api(tmdburl) : 'http://api.themoviedb.org/3/' + tmdburl;
          network.clear();
          network.timeout(1000 * 15);
          network.silent(baseurl, function (ttid) {
            object.movie.imdb_id = ttid.imdb_id;
            letgo();
          }, function (a, c) {
            letgo();
          });
        } else {
          letgo();
        }
      };

      this.parsePlaylist = function (str) {
        var pl = [];

        try {
          if (startsWith(str, '[')) {
            str.substring(1).split(/, *\[/).forEach(function (item) {
              item = item.trim();
              if (endsWith(item, ',')) item = item.substring(0, item.length - 1).trim();
              var label_end = item.indexOf(']');

              if (label_end >= 0) {
                var label = item.substring(0, label_end).trim();

                if (item.charAt(label_end + 1) === '{') {
                  item.substring(label_end + 2).split(/; *\{/).forEach(function (voice_item) {
                    voice_item = voice_item.trim();
                    if (endsWith(voice_item, ';')) voice_item = voice_item.substring(0, voice_item.length - 1).trim();
                    var voice_end = voice_item.indexOf('}');

                    if (voice_end >= 0) {
                      var voice = voice_item.substring(0, voice_end).trim();
                      pl.push({
                        label: label,
                        voice: voice,
                        links: voice_item.substring(voice_end + 1).split(' or ').map(function (link) {
                          return link.trim();
                        }).filter(function (link) {
                          return link;
                        })
                      });
                    }
                  });
                } else {
                  pl.push({
                    label: label,
                    links: item.substring(label_end + 1).split(' or ').map(function (link) {
                      return link.trim();
                    }).filter(function (link) {
                      return link;
                    })
                  });
                }
              }
            });
            pl = pl.filter(function (item) {
              return item.links.length;
            });
          }
        } catch (e) {}

        return pl;
      };

      this.parseM3U = function (str) {
        var pl = [];

        try {
          var xstream = false;
          var bandwidth = 0;
          var width = 0;
          var height = 0;
          var codecs = '';
          str.split('\n').forEach(function (line) {
            line = line.trim();

            if (startsWith(line, '#')) {
              if (startsWith(line, '#EXT-X-STREAM-INF')) {
                xstream = true;
                var BANDWIDTH = line.match(/\bBANDWIDTH=(\d+)\b/);

                if (BANDWIDTH) {
                  bandwidth = BANDWIDTH[1];
                }

                var RESOLUTION = line.match(/\bRESOLUTION=(\d+)x(\d+)\b/);

                if (RESOLUTION) {
                  width = parseInt(RESOLUTION[1]);
                  height = parseInt(RESOLUTION[2]);
                }

                var CODECS = line.match(/\bCODECS="([^"]+)"/);

                if (CODECS) {
                  codecs = CODECS[1];
                }
              }
            } else if (line.length) {
              pl.push({
                xstream: xstream,
                bandwidth: bandwidth,
                width: width,
                height: height,
                codecs: codecs,
                link: line
              });
              xstream = false;
              bandwidth = 0;
              width = 0;
              height = 0;
              codecs = '';
            }
          });
        } catch (e) {}

        return pl;
      };

      this.formatEpisodeTitle = function (s_num, e_num, name) {
        var title = '';
        var full = Lampa.Storage.field('online_mod_full_episode_title') === true;

        if (s_num != null && s_num !== '') {
          title = (full ? Lampa.Lang.translate('torrent_serial_season') + ' ' : 'S') + s_num + ' / ';
        }

        if (name == null || name === '') name = Lampa.Lang.translate('torrent_serial_episode') + ' ' + e_num;else if (e_num != null && e_num !== '') name = Lampa.Lang.translate('torrent_serial_episode') + ' ' + e_num + ' - ' + name;
        title += name;
        return title;
      };

      this.proxyUrlCall = function (proxy_url, method, url, timeout, post_data, call_success, call_fail, withCredentials) {
        proxy_url = this.proxy('iframe') + proxy_url;

        var process = function process() {
          if (proxyWindow[proxy_url]) {
            timeout = timeout || 60 * 1000;
            var message_id;

            try {
              message_id = crypto.getRandomValues(new Uint8Array(16)).toString();
            } catch (e) {}

            if (!message_id) message_id = Math.random().toString();
            proxyCalls[message_id] = {
              success: call_success,
              fail: call_fail
            };
            proxyWindow[proxy_url].postMessage({
              message: 'proxyMessage',
              message_id: message_id,
              method: method,
              url: url,
              timeout: timeout,
              post_data: post_data,
              withCredentials: withCredentials
            }, '*');
            setTimeout(function () {
              var call = proxyCalls[message_id];

              if (call) {
                delete proxyCalls[message_id];
                if (call.fail) call.fail({
                  status: 0,
                  statusText: 'timeout',
                  responseText: ''
                }, 'timeout');
              }
            }, timeout + 1000);
          } else {
            if (call_fail) call_fail({
              status: 0,
              statusText: 'abort',
              responseText: ''
            }, 'abort');
          }
        };

        if (!proxyInitialized[proxy_url]) {
          proxyInitialized[proxy_url] = true;
          var proxyOrigin = proxy_url.replace(/(https?:\/\/[^\/]+)\/.*/, '$1');
          var proxyIframe = document.createElement('iframe');
          proxyIframe.setAttribute('src', proxy_url);
          proxyIframe.setAttribute('width', '0');
          proxyIframe.setAttribute('height', '0');
          proxyIframe.setAttribute('tabindex', '-1');
          proxyIframe.setAttribute('title', 'empty');
          proxyIframe.setAttribute('style', 'display:none');
          proxyIframe.addEventListener('load', function () {
            proxyWindow[proxy_url] = proxyIframe.contentWindow;
            window.addEventListener('message', function (event) {
              var data = event.data;

              if (event.origin === proxyOrigin && data && data.message === 'proxyResponse' && data.message_id) {
                var call = proxyCalls[data.message_id];

                if (call) {
                  delete proxyCalls[data.message_id];

                  if (data.status === 200) {
                    if (call.success) call.success(data.responseText);
                  } else {
                    if (call.fail) call.fail({
                      status: data.status,
                      statusText: data.statusText,
                      responseText: data.responseText
                    });
                  }
                }
              }
            });
            if (process) process();
            process = null;
          });
          document.body.appendChild(proxyIframe);
          setTimeout(function () {
            if (process) process();
            process = null;
          }, 10000);
        } else {
          process();
        }
      };

      this.proxyCall = function (method, url, timeout, post_data, call_success, call_fail, withCredentials) {
        var proxy_url = (window.location.protocol === 'https:' ? 'https://' : 'http://') + 'nb557.surge.sh/proxy.html';
        this.proxyUrlCall(proxy_url, method, url, timeout, post_data, call_success, call_fail, withCredentials);
      };

      this.proxyCall2 = function (method, url, timeout, post_data, call_success, call_fail, withCredentials) {
        var proxy_url = (window.location.protocol === 'https:' ? 'https://' : 'http://') + 'lampa.stream/proxy.html';
        this.proxyUrlCall(proxy_url, method, url, timeout, post_data, call_success, call_fail, withCredentials);
      };

      this.proxyCall3 = function (method, url, timeout, post_data, call_success, call_fail, withCredentials) {
        var proxy_url = 'https://nb557.github.io/plugins/proxy.html';
        this.proxyUrlCall(proxy_url, method, url, timeout, post_data, call_success, call_fail, withCredentials);
      };

      this.extendChoice = function () {
        var data = Lampa.Storage.cache('online_mod_choice_' + balanser, 500, {});
        var save = data[selected_id || object.movie.id] || {};
        extended = true;
        sources[balanser].extendChoice(save);
      };

      this.saveChoice = function (choice) {
        var data = Lampa.Storage.cache('online_mod_choice_' + balanser, 500, {});
        data[selected_id || object.movie.id] = choice;
        Lampa.Storage.set('online_mod_choice_' + balanser, data);
      };
      /**
       * Есть похожие карточки
       * @param {Object} json
       */


      this.similars = function (json, search_more, more_params) {
        var _this6 = this;
        // the title picked here before (or in «По сериям») is opened again without asking; a clarified search asks
        var level = json[0] && json[0].is_similars ? 'src' : 'find';
        var saved = object.clarification ? '' : watch.similarKey(watch.similarOf(object.movie, balanser, level));
        var auto = null;

        json.forEach(function (elem) {
          var elem_key = watch.similarKey(elem);
          var title = elem.title || elem.ru_title || elem.nameRu || elem.en_title || elem.nameEn || elem.orig_title || elem.nameOriginal;
          var orig_title = elem.orig_title || elem.nameOriginal || elem.en_title || elem.nameEn;
          var year = elem.start_date || elem.year || '';
          var info = [];
          if (orig_title && orig_title != elem.title) info.push(orig_title);
          if (elem.seasons_count) info.push(Lampa.Lang.translate('online_mod_seasons_count') + ': ' + elem.seasons_count);
          if (elem.episodes_count) info.push(Lampa.Lang.translate('online_mod_episodes_count') + ': ' + elem.episodes_count);
          elem.title = title;
          elem.quality = year ? (year + '').slice(0, 4) : '----';
          elem.info = info.length ? ' / ' + info.join(' / ') : '';
          var item = Lampa.Template.get('online_mod_folder', elem);
          var choose = function choose() {
            _this6.activity.loader(true);

            _this6.reset();

            object.search = elem.title;
            object.search_date = year;
            selected_id = elem.id;

            _this6.extendChoice();

            sources[balanser].search(object, elem.kp_id || elem.kinopoisk_id || elem.kinopoiskId || elem.filmId || elem.imdb_id, [elem]);
          };
          item.on('hover:enter', function () {
            watch.similarSave(object.movie, balanser, elem);
            choose();
          });
          if (saved && !auto && elem_key === saved) auto = choose;

          _this6.append(item);
        });

        if (search_more) {
          var elem = {
            title: Lampa.Lang.translate('online_mod_show_more'),
            quality: '...',
            info: ''
          };
          var item = Lampa.Template.get('online_mod_folder', elem);
          item.on('hover:enter', function () {
            _this6.activity.loader(true);

            _this6.reset();

            search_more(more_params);
          });
          this.append(item);
        }

        // once per screen and list level: a source that answers with the same list again is not looped
        if (auto && !similar_auto[level]) {
          similar_auto[level] = true;
          // after the source has finished drawing this list (it hides the loader right after)
          setTimeout(auto, 0);
        }
      };
      /**
       * Очистить список файлов
       */


      this.reset = function () {
        contextmenu_all = [];
        last = filter.render().find('.selector').eq(0)[0];
        scroll.render().find('.empty').remove();
        scroll.clear();
        scroll.reset();
      };

      this.inActivity = function () {
        var body = $('body');
        return !(body.hasClass('settings--open') || body.hasClass('menu--open') || body.hasClass('keyboard-input--visible') || body.hasClass('selectbox--open') || body.hasClass('search--open') || body.hasClass('ambience--enable') || $('div.modal').length);
      };
      /**
       * Загрузка
       */


      this.loading = function (status) {
        if (status) this.activity.loader(true);else {
          this.activity.loader(false);
          if (Lampa.Activity.active().activity === this.activity && this.inActivity()) this.activity.toggle();
        }
      };

      // unsetDefault: what to prefer while the user has never picked a quality in the settings.
      // keepLinks: skip the "?" hack below; Turbo's CDN edge stalls on a trailing "?".
      this.getDefaultQuality = function (qualityMap, defValue, unsetDefault, keepLinks) {
        if (!keepLinks) {
          var needHackHlsLink = function needHackHlsLink(link) {
            return link && endsWith(link, '.m3u8') && link.lastIndexOf('?') <= link.lastIndexOf('/');
          };

          if (qualityMap) {
            for (var ID in qualityMap) {
              if (needHackHlsLink(qualityMap[ID])) {
                qualityMap[ID] += '?';
              }
            }
          }

          if (needHackHlsLink(defValue)) {
            defValue += '?';
          }
        }

        if (qualityMap) {
          var preferably = forcedQuality;

          if (!preferably) {
            preferably = Lampa.Storage.get('video_quality_default', unsetDefault || '1080') + 'p';
            if (preferably === '1080p') preferably = '1080p Ultra';
          }

          var items = ['2160p', '2160', '4K', '1440p', '1440', '2K', '1080p Ultra', '1080p', '1080', '720p', '720', '480p', '480', '360p', '360', '240p', '240'];
          var idx = items.indexOf(preferably);

          if (idx !== -1) {
            for (var i = idx; i < items.length; i++) {
              var item = items[i];
              if (qualityMap[item]) return qualityMap[item];
            }

            for (var _i = idx - 1; _i >= 0; _i--) {
              var _item = items[_i];
              if (qualityMap[_item]) return qualityMap[_item];
            }
          }
        }

        return defValue;
      };

      this.renameQualityMap = function (qualityMap) {
        if (!qualityMap) return qualityMap;
        var renamed = {};

        for (var label in qualityMap) {
          renamed["\u200B" + label] = qualityMap[label];
        }

        return renamed;
      };
      /**
       * Построить фильтр
       */


      this.filter = function (filter_items, choice) {
        last_filter = filter_items;
        last_choice = choice;
        filter_count++;
        var select = [];

        var add = function add(type, title) {
          var need = Lampa.Storage.get('online_mod_filter', '{}');
          var items = filter_items[type];
          var notes = filter_items[type + '_note'] || [];
          var subitems = [];
          var value = need[type];
          items.forEach(function (name, i) {
            subitems.push({
              title: notes[i] ? name + ' (' + notes[i] + ')' : name,
              selected: value == i,
              index: i
            });
          });
          select.push({
            title: title,
            subtitle: items[value],
            items: subitems,
            stype: type
          });
        };

        choice.source = filter_sources.indexOf(balanser);
        Lampa.Storage.set('online_mod_filter', choice);
        select.push({
          title: Lampa.Lang.translate('torrent_parser_reset'),
          reset: true
        });
        filter_items.source = obj_filter_sources.map(function (s) {
          return s.title;
        });
        add('source', Lampa.Lang.translate('online_mod_balanser'));
        if (filter_items.season && filter_items.season.length) add('season', Lampa.Lang.translate('torrent_serial_season'));
        if (filter_items.voice && filter_items.voice.length) add('voice', Lampa.Lang.translate('torrent_parser_voice'));
        if (filter_items.audio && filter_items.audio.length > 1) add('audio', Lampa.Lang.translate('online_mod_audio_track'));
        if (filter_items.server && filter_items.server.length) add('server', Lampa.Lang.translate('online_mod_server'));
        this.updateQualityFilter();
        select.push(qualityFilter);
        filter.set('filter', select);
        var sort_items = obj_filter_sources.map(function (e) {
          return {
            source: e.name,
            title: e.title,
            selected: e.name === balanser
          };
        });

        if (object.modssSources && object.modssSources.length) {
          var own_names = {};

          obj_filter_sources.forEach(function (s) {
            own_names[s.name] = true;
          });

          object.modssSources.forEach(function (s) {
            if (!s || !s.source || own_names[s.source]) return;

            sort_items.push({
              title: s.rawTitle || s.title,
              source: s.source,
              modss: true,
              vip: s.vip === true
            });
          });
        }

        filter.set('sort', sort_items);
        this.selected(filter_items);
      };
      /**
       * Закрыть фильтр
       */


      this.closeFilter = function () {
        if ($('body').hasClass('selectbox--open')) Lampa.Select.close();
      };
      /**
       * Показать что выбрано в фильтре
       */


      this.selected = function (filter_items) {
        var need = Lampa.Storage.get('online_mod_filter', '{}'),
            select = [];

        var keys = Object.keys(need).sort(function (a, b) { return (b === 'season') - (a === 'season'); });
        keys.forEach(function (i) {
          if (i !== 'source' && filter_translate[i] && filter_items[i] && filter_items[i].length > 1) {
            select.push(filter_translate[i] + ': ' + filter_items[i][need[i]]);
          }
        });

        var source_obj = obj_filter_sources.filter(function (e) {
          return e.name === balanser;
        })[0];
        filter.chosen('filter', select);
        filter.chosen('sort', [source_obj ? source_obj.title : balanser]);
      };
      /**
       * Добавить файл
       */


      this.append = function (item) {
        item.on('hover:focus', function (e) {
          last = e.target;
          scroll.update($(e.target), true);
        });
        scroll.append(item);
      };
      /**
       * Меню
       */


      this.contextmenu = function (params) {
        contextmenu_all.push(params);
        params.item.on('hover:enter', function () {
          var voice = last_filter && last_filter.voice && last_choice ? last_filter.voice[last_choice.voice] : '';
          watch.remember(object.movie, balanser, voice, last_choice && last_choice.season, params.element);
        });
        params.item.on('hover:long', function () {
          var enabled = Lampa.Controller.enabled().name;

          function selectQuality(title, callback) {
            return function (extra) {
              if (extra.quality) {
                var qual = [];

                for (var i in extra.quality) {
                  qual.push({
                    title: i,
                    file: extra.quality[i]
                  });
                }

                Lampa.Select.show({
                  title: title,
                  items: qual,
                  onBack: function onBack() {
                    Lampa.Controller.toggle(enabled);
                  },
                  onSelect: callback
                });
              } else callback(null, extra);
            };
          }

          var menu = [{
            title: Lampa.Lang.translate('torrent_parser_label_title'),
            mark: true
          }, {
            title: Lampa.Lang.translate('torrent_parser_label_cancel_title'),
            clearmark: true
          }, {
            title: Lampa.Lang.translate('online_mod_clearmark_all'),
            clearmark_all: true
          }, {
            title: Lampa.Lang.translate('time_reset'),
            timeclear: true
          }, {
            title: Lampa.Lang.translate('online_mod_timeclear_all'),
            timeclear_all: true
          }];

          if (Lampa.Platform.is('webos')) {
            menu.push({
              title: Lampa.Lang.translate('player_lauch') + ' - Webos',
              player: 'webos'
            });
          }

          if (Lampa.Platform.is('android')) {
            menu.push({
              title: Lampa.Lang.translate('player_lauch') + ' - Android',
              player: 'android'
            });
          }

          menu.push({
            title: Lampa.Lang.translate('player_lauch') + ' - Lampa',
            player: 'lampa'
          });

          if (params.file) {
            menu.push({
              title: Lampa.Lang.translate('copy_link'),
              copylink: true
            });
          }

          if (Lampa.Account.working() && params.element && typeof params.element.season !== 'undefined' && Lampa.Account.subscribeToTranslation) {
            menu.push({
              title: Lampa.Lang.translate('online_mod_voice_subscribe'),
              subscribe: true
            });
          }

          var matched = params.element && watch.ctx(params.element.timeline);

          if (matched) {
            menu.push({
              title: Lampa.Lang.translate('online_mod_watch_match'),
              watch_match: true
            });
            if (watch.answered(object.movie)) menu.push({
              title: Lampa.Lang.translate('online_mod_watch_reset'),
              watch_reset: true
            });
          }

          Lampa.Select.show({
            title: Lampa.Lang.translate('title_action'),
            items: menu,
            onBack: function onBack() {
              Lampa.Controller.toggle(enabled);
            },
            onSelect: function onSelect(a) {
              if (a.clearmark) {
                Lampa.Arrays.remove(params.viewed, params.hash_file);
                Lampa.Storage.set('online_view', params.viewed);
                params.item.find('.torrent-item__viewed').remove();
              }

              if (a.clearmark_all) {
                contextmenu_all.forEach(function (params) {
                  Lampa.Arrays.remove(params.viewed, params.hash_file);
                  Lampa.Storage.set('online_view', params.viewed);
                  params.item.find('.torrent-item__viewed').remove();
                });
              }

              if (a.mark) {
                if (params.viewed.indexOf(params.hash_file) == -1) {
                  params.viewed.push(params.hash_file);
                  params.item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
                  Lampa.Storage.set('online_view', params.viewed);
                }
              }

              if (a.timeclear) {
                params.view.percent = 0;
                params.view.time = 0;
                params.view.duration = 0;
                Lampa.Timeline.update(params.view);
              }

              if (a.timeclear_all) {
                contextmenu_all.forEach(function (params) {
                  params.view.percent = 0;
                  params.view.time = 0;
                  params.view.duration = 0;
                  Lampa.Timeline.update(params.view);
                });
              }

              Lampa.Controller.toggle(enabled);

              if (a.watch_match) watch.dialog(matched, enabled, function () {
                watch.rekey();
              });

              if (a.watch_reset) {
                watch.save(object.movie, null);
                watch.rekey();
              }

              if (a.player) {
                Lampa.Player.runas(a.player);
                params.item.trigger('hover:enter', {
                  runas: a.player
                });
              }

              if (a.copylink) {
                params.file(selectQuality(Lampa.Lang.translate('online_mod_links'), function (b, extra) {
                  Lampa.Utils.copyTextToClipboard(b && b.file || extra && extra.file, function () {
                    Lampa.Noty.show(Lampa.Lang.translate('copy_secuses'));
                  }, function () {
                    Lampa.Noty.show(Lampa.Lang.translate('copy_error'));
                  });
                }));
              }

              if (a.subscribe) {
                Lampa.Account.subscribeToTranslation({
                  card: object.movie,
                  season: params.element.season,
                  episode: params.element.translate_episode_end,
                  voice: params.element.translate_voice
                }, function () {
                  Lampa.Noty.show(Lampa.Lang.translate('online_mod_voice_success'));
                }, function () {
                  Lampa.Noty.show(Lampa.Lang.translate('online_mod_voice_error'));
                });
              }
            }
          });
        }).on('hover:focus', function () {
          if (Lampa.Helper) Lampa.Helper.show('online_file', Lampa.Lang.translate('online_mod_file_helper'), params.item);
        });
      };
      /**
       * Показать пустой результат
       */


      this.empty = function (msg) {
        var empty = Lampa.Template.get('list_empty');
        if (msg) empty.find('.empty__descr').text(msg);
        scroll.append(empty);
        this.loading(false);
      };
      /**
       * Показать пустой результат по ключевому слову
       */


      this.emptyForQuery = function (query) {
        this.empty(Lampa.Lang.translate('online_mod_query_start') + ' (' + query + ') ' + Lampa.Lang.translate('online_mod_query_end'));
      };

      this.getLastEpisode = function (items) {
        var last_episode = 0;
        items.forEach(function (e) {
          if (typeof e.episode !== 'undefined') last_episode = Math.max(last_episode, parseInt(e.episode));
        });
        return last_episode;
      };
      // Timeline of a list element under the shared canonical key (see watch)
      this.watchView = function (element, hash, items) {
        return watch.view(object.movie, balanser, element, hash, items, last_filter && last_filter.season ? last_filter.season.length : 0);
      };
      watch.prefetch(object.movie);
      if (animeSkip.isAnime(object.movie)) watch.alt(object.movie);
      // rekey() changed the elements' timelines: redraw their bars and let the menu reset the new ones
      watch.refresh = function () {
        contextmenu_all.forEach(function (p) {
          var v = p.element && p.element.timeline;
          if (!v || v === p.view) return;
          p.item.find('.time-line').replaceWith(Lampa.Timeline.render(v));
          if (Lampa.Timeline.details) p.item.find('.time-line-details').replaceWith(Lampa.Timeline.details(v, ' / '));
          p.view = v;
        });
      };
      /**
       * Начать навигацию по файлам
       */


      this.start = function (first_select) {
        if (Lampa.Activity.active().activity !== this.activity) return; //обязательно, иначе наблюдается баг, активность создается но не стартует, в то время как компонент загружается и стартует самого себя.
        if (first_select) {
          var last_views = scroll.render().find('.selector.online').find('.torrent-item__viewed').parent().last();
          if (object.movie.number_of_seasons && last_views.length) last = last_views.eq(0)[0];else last = scroll.render().find('.selector').eq(0)[0];
        }

        // a voice picked in «По сериям»: its season and voice are set once, the redraws call start() again
        // before the source answers, last_filter is the screen's own {source} list: wait for its seasons; another source chosen here gets no pick
        if (object.watch_pick && !pick_done && balanser === object.balancer && last_filter && last_filter.season && last_filter.season.length && sources[balanser] && sources[balanser].filter) {
          pin_tried = true;
          var pick = object.watch_pick;
          if (!pick_season_done) {
            pick_season_done = true;
            if (last_filter.season[pick.season] !== undefined && !(last_choice && last_choice.season === pick.season)) {
              pick_mark = filter_count;
              sources[balanser].filter('filter', { stype: 'season' }, { index: pick.season });
            }
          }
          // the voice once the list on screen is the picked season's (a source that loads a season redraws later)
          // a source sets its choice at once but redraws after loading: the voices are the new season's only after that
          if (!pick_done && (pick_mark < 0 || filter_count > pick_mark)) {
            pick_done = true;
            var pick_voice = last_filter.voice ? last_filter.voice.indexOf(pick.voice_name) : -1;
            if (pick_voice >= 0 && !(last_choice && last_choice.voice === pick_voice)) sources[balanser].filter('filter', { stype: 'voice' }, { index: pick_voice });
            // the redraws above may have focused a row of the list they replaced: find it again in the final one
            pin_done = false;
            pick_play = pick_voice >= 0 ? Date.now() + 20000 : 0;
          }
        }

        if (object.watch_pin && !pin_done) {
          var pinned = watch.pinRow(object.watch_pin, contextmenu_all);
          if (pinned) {
            last = pinned[0];
            pin_done = true;
            // a voice picked in «По сериям» plays once its own list is on screen (a source that loads per voice redraws later)
            if (pick_play > Date.now() && last_filter && last_choice && (last_filter.voice || [])[last_choice.voice] === object.watch_pick.voice_name) {
              pick_play = 0;
              setTimeout(function () {
                pinned.trigger('hover:enter');
              }, 0);
            }
          } else if (!pin_tried && last_filter && last_filter.season) {
            pin_tried = true;
            var pin_season = watch.pinSeason(object.watch_pin, last_filter.season);
            // the balancer redraws its list and calls start() again
            // Kodik's merged parts are labelled by titles and years, not season numbers
            if (pin_season >= 0 && balanser !== 'kodik' && sources[balanser] && sources[balanser].filter) sources[balanser].filter('filter', { stype: 'season' }, { index: pin_season });
          }
        }

        Lampa.Background.immediately(Lampa.Utils.cardImgBackground(object.movie));
        Lampa.Controller.add('content', {
          toggle: function toggle() {
            Lampa.Controller.collectionSet(scroll.render(), files.render());
            Lampa.Controller.collectionFocus(last || false, scroll.render());
          },
          up: function up() {
            if (Navigator.canmove('up')) {
              Navigator.move('up');
            } else Lampa.Controller.toggle('head');
          },
          down: function down() {
            Navigator.move('down');
          },
          right: function right() {
            if (Navigator.canmove('right')) Navigator.move('right');else filter.show(Lampa.Lang.translate('title_filter'), 'filter');
          },
          left: function left() {
            if (Navigator.canmove('left')) Navigator.move('left');else Lampa.Controller.toggle('menu');
          },
          back: this.back
        });
        if (this.inActivity()) Lampa.Controller.toggle('content');
      };

      this.render = function () {
        return files.render();
      };

      this.back = function () {
        Lampa.Activity.backward();
      };

      this.pause = function () {};

      this.stop = function () {};

      this.destroy = function () {
        network.clear();
        if (this.kp_net) this.kp_net.clear();
        files.destroy();
        scroll.destroy();
        network = null;
        all_sources.forEach(function (s) {
          s.source.destroy();
        });
      };
    }

    var mod_version = '21.11.2026-1';
    var isMSX = !!(window.TVXHost || window.TVXManager);
    var isTizen = navigator.userAgent.toLowerCase().indexOf('tizen') !== -1;
    var isIFrame = window.parent !== window;
    var isLocal = !startsWith(window.location.protocol, 'http');
    var androidHeaders = Lampa.Platform.is('android') && Utils.checkAndroidVersion(339);
    var filmixHost = Utils.filmixHost();
    var network = new Lampa.Reguest();
    var online_loading = false;

    function logApp() {
      console.log('App', 'start address:', window.location.href);
      console.log('App', 'is MSX:', isMSX);
      console.log('App', 'is Tizen:', isTizen);
      console.log('App', 'is iframe:', isIFrame);
      console.log('App', 'is local:', isLocal);
      console.log('App', 'supports headers:', androidHeaders);
    }

    function initStorage() {
      if (!Utils.isDebug()) {
        Lampa.Storage.set('online_mod_proxy_lumex', 'false');
        Lampa.Storage.set('online_mod_proxy_rezka2', 'false');
        Lampa.Storage.set('online_mod_proxy_kinobase', 'false');
        Lampa.Storage.set('online_mod_proxy_collaps', 'false');
        Lampa.Storage.set('online_mod_proxy_cdnmovies', 'false');
        Lampa.Storage.set('online_mod_proxy_fancdn', 'false');
        Lampa.Storage.set('online_mod_proxy_fancdn2', 'false');
        Lampa.Storage.set('online_mod_proxy_fanserials', 'false');
        Lampa.Storage.set('online_mod_proxy_fanserials_cdn', 'false');
        Lampa.Storage.set('online_mod_proxy_animelib', 'false');
      } else if (!Lampa.Platform.is('android')) {
        Lampa.Storage.set('online_mod_proxy_lumex', 'true');
        Lampa.Storage.set('online_mod_proxy_cdnmovies', 'true');
        Lampa.Storage.set('online_mod_proxy_fancdn', 'true');
        Lampa.Storage.set('online_mod_proxy_fancdn2', 'true');

        if (!isLocal) {
          Lampa.Storage.set('online_mod_proxy_fanserials', 'true');
        }
      }

      if (!Lampa.Platform.is('android')) {
        Lampa.Storage.set('online_mod_proxy_filmix', 'true');
      }

      Lampa.Storage.set('online_mod_proxy_videoseed', Lampa.Platform.is('android') || isLocal ? 'false' : 'true');
      Lampa.Storage.set('online_mod_proxy_vibix', Lampa.Platform.is('android') ? 'false' : 'true');
      Lampa.Storage.set('online_mod_proxy_redheadsound', Lampa.Platform.is('android') ? 'false' : 'true');
      Lampa.Storage.set('online_mod_proxy_cdnvideohub', 'false');
      Lampa.Storage.set('online_mod_proxy_videodb', 'false');
      Lampa.Storage.set('online_mod_proxy_zetflix', 'false');
      Lampa.Storage.set('online_mod_proxy_kinopub', 'true');
      Lampa.Storage.set('online_mod_proxy_alloha', 'false');
      Lampa.Storage.set('online_mod_proxy_hdvb', 'false');
      Lampa.Storage.set('online_mod_proxy_kp', 'false');

      if (window.location.protocol === 'https:') {
        Lampa.Storage.set('online_mod_prefer_http', 'false');
      }

      if (Lampa.Storage.get('online_mod_proxy_reset', '') != 7) {
        Lampa.Storage.set('online_mod_proxy_lumex', 'true');
        Lampa.Storage.set('online_mod_proxy_reset', '7');
      }
    }

    function initLang() {
      if (!Lampa.Lang) {
        var lang_data = {};
        Lampa.Lang = {
          add: function add(data) {
            lang_data = data;
          },
          translate: function translate(key) {
            return lang_data[key] ? lang_data[key].ru : key;
          }
        };
      }

      Lampa.Lang.add({
        online_mod_watch: {
          ru: 'Смотреть онлайн',
          uk: 'Дивитися онлайн',
          be: 'Глядзець анлайн',
          en: 'Watch online',
          zh: '在线观看'
        },
        online_mod_playlist_prepare: { ru: 'Подготовка плейлиста: ', en: 'Preparing playlist: ' },
        online_mod_skip_op: { ru: 'Пропустить опенинг', en: 'Skip opening' },
        online_mod_skip_ed: { ru: 'Пропустить эндинг', en: 'Skip ending' },
        online_mod_skip_recap: { ru: 'Пропустить пересказ', en: 'Skip recap' },
        online_mod_episodes_short: { ru: ' эп.', en: ' ep.' },
        online_mod_season: { ru: 'Сезон', en: 'Season' },
        online_mod_episode: { ru: 'Серия', en: 'Episode' },
        online_mod_watch_ask: { ru: 'какая это серия в Lampa?', en: 'which episode is it in Lampa?' },
        online_mod_watch_by: { ru: 'По данным', en: 'According to' },
        online_mod_watch_same: { ru: 'Нумерация как в Lampa (TMDB)', en: 'Numbered as in Lampa (TMDB)' },
        online_mod_watch_manual: { ru: 'Выбрать сезон и серию вручную', en: 'Pick the season and episode' },
        online_mod_watch_none: { ru: 'Не связывать с карточкой', en: 'Do not link to the card' },
        online_mod_watch_match: { ru: 'Сопоставить серии…', en: 'Match episodes…' },
        online_mod_watch_reset: { ru: 'Сбросить сопоставление', en: 'Reset episode matching' },
        online_mod_by_episodes: { ru: 'Выбор плеера', en: 'Choose player' },
        online_mod_resume: { ru: 'Продолжить', en: 'Continue' },
        online_mod_season_short: { ru: 'С', en: 'S' },
        online_mod_episode_short: { ru: 'Е', en: 'E' },
        online_mod_watch_unproven: { ru: 'номер не подтверждён', en: 'number not confirmed' },
        online_mod_variants_choose: { ru: 'несколько совпадений — выберите', en: 'several matches: pick one' },
        online_mod_variants_voices: { ru: 'озвучек:', en: 'voices:' },
        online_mod_variants_open: { ru: 'Открыть источник', en: 'Open the source' },
        online_mod_variants_reset: { ru: 'Сбросить выбранный тайтл', en: 'Forget the picked title' },
        online_mod_variants_retry: { ru: 'Обновить', en: 'Reload' },
        online_mod_variants_top: { ru: 'Сделать первым', en: 'Move to the top' },
        online_mod_variants_up: { ru: 'Выше', en: 'Move up' },
        online_mod_variants_down: { ru: 'Ниже', en: 'Move down' },
        online_mod_trakt_id: { ru: 'Trakt: Client ID', en: 'Trakt: Client ID' },
        online_mod_trakt_secret: { ru: 'Trakt: Client Secret', en: 'Trakt: Client Secret' },
        online_mod_trakt_in: { ru: 'Войти: код на экране, ввести на телефоне', en: 'Sign in: a code on screen, entered on the phone' },
        online_mod_trakt_out: { ru: 'Подключён. Нажмите, чтобы выйти', en: 'Connected. Press to sign out' },
        online_mod_trakt_open: { ru: 'Откройте на телефоне и введите код:', en: 'Open on your phone and enter the code:' },
        online_mod_trakt_signed: { ru: 'Trakt подключён', en: 'Trakt connected' },
        online_mod_trakt_signed_out: { ru: 'Trakt отключён', en: 'Trakt disconnected' },
        online_mod_trakt_expired: { ru: 'Код истёк, попробуйте ещё раз', en: 'The code expired, try again' },
        online_mod_trakt_failed: { ru: 'Trakt не ответил', en: 'Trakt did not answer' },
        online_mod_trakt_nokeys: { ru: 'Укажите Client ID и Client Secret приложения Trakt', en: 'Set the Trakt app Client ID and Client Secret' },
        online_mod_original: { ru: 'Оригинал', en: 'Original' },
        online_mod_rezka_premium_only: { ru: 'Перевод доступен только с HDrezka Premium', en: 'This voiceover needs HDrezka Premium' },
        online_mod_rezka_login_disabled: { ru: 'Вход в HDrezka без Tampermonkey-моста или своего сервера отключён: пароль ушёл бы через чужой прокси (Настройки → online_mod → HDrezka → «Адрес своего сервера»)', en: 'HDrezka login without the Tampermonkey bridge or your own server is off: the password would go through a third-party proxy (Settings → online_mod → HDrezka → "Your server address")' },
        online_mod_server_main: { ru: 'Основной', en: 'Main' },
        online_mod_server_reserve: { ru: 'Резервный', en: 'Backup' },
        online_mod_alloha_no_server: { ru: 'Укажите адрес сервера Alloha в настройках', en: 'Set the Alloha server address in the settings' },
        online_mod_directors_cut: { ru: ' (Режиссёрская версия)', en: " (Director's cut)" },
        online_mod_helper_server: { ru: 'Адрес своего сервера (server/)', en: 'Your server address (server/)' },
        online_mod_helper_server_descr: { ru: 'Один сервер для Alloha, Turbo и HDrezka в браузере', en: 'One server for Alloha, Turbo and HDrezka in a browser' },
        online_mod_turbo_no_server: { ru: 'Turbo работает через сервер Alloha: укажите его адрес в настройках Alloha', en: 'Turbo works through the Alloha server: set its address in the Alloha settings' },
        online_mod_turbo_qr: { ru: 'С пульта галочку не нажать? Отсканируйте код телефоном и поставьте галочку там — окно закроется само.', en: "Can't tick the box with the remote? Scan the code with your phone and tick it there; this window closes by itself." },
        online_mod_turbo_captcha: { ru: 'Turbo: поставьте галочку «Подтвердите, что вы человек»', en: 'Turbo: tick "Confirm you are human"' },
        online_mod_turbo_waiting: { ru: 'Turbo ждёт подтверждения: откройте балансер снова', en: 'Turbo is waiting for the confirmation: open the source again' },
        online_mod_dub: { ru: 'Озвучка', en: 'Dub' },
        online_mod_sub: { ru: 'Субтитры', en: 'Subtitles' },
        online_mod_no_sources: { ru: 'У этой серии нет доступных источников', en: 'No playable sources for this episode' },
        online_mod_links: { ru: 'Ссылки', en: 'Links' },
        online_mod_lampac_server: { ru: 'Адрес Lampac (синхронизация просмотров)', en: 'Lampac address (watched sync)' },
        online_mod_lampac_server_descr: { ru: 'Подключает timecode.js с вашего Lampac: «просмотрено» общее на всех устройствах. Пусто — ничего не грузится. Действует после перезапуска Lampa. Lampa в браузере по https не загрузит http-адрес', en: 'Loads timecode.js from your Lampac: "watched" shared on all devices. Empty: nothing is loaded. Takes effect after restarting Lampa. Lampa in a browser over https cannot load an http address' },
        online_mod_nolink: {
          ru: 'Не удалось извлечь ссылку',
          uk: 'Неможливо отримати посилання',
          be: 'Не ўдалося атрымаць спасылку',
          en: 'Failed to fetch link',
          zh: '获取链接失败'
        },
        online_mod_blockedlink: {
          ru: 'К сожалению, это видео не доступно в вашем регионе',
          uk: 'На жаль, це відео не доступне у вашому регіоні',
          be: 'Нажаль, гэта відэа не даступна ў вашым рэгіёне',
          en: 'Sorry, this video is not available in your region',
          zh: '抱歉，您所在的地区无法观看该视频'
        },
        online_mod_blockedlink_copyright: {
          ru: 'К сожалению, это видео не доступно по запросу правообладателей',
          uk: 'На жаль, це відео не доступне за запитом правовласників',
          be: 'Нажаль, гэта відэа не даступна па запыце праваўладальнікаў',
          en: 'Sorry, this video is not available due to copyright holder request',
          zh: '抱歉，由于版权所有者的要求，该视频无法播放。'
        },
        online_mod_waitlink: {
          ru: 'Работаем над извлечением ссылки, подождите...',
          uk: 'Працюємо над отриманням посилання, зачекайте...',
          be: 'Працуем над выманнем спасылкі, пачакайце...',
          en: 'Working on extracting the link, please wait...',
          zh: '正在提取链接，请稍候...'
        },
        online_mod_captcha_address: {
          ru: 'Требуется пройти капчу по адресу: ',
          uk: 'Потрібно пройти капчу за адресою: ',
          be: 'Патрабуецца прайсці капчу па адрасе: ',
          en: 'It is required to pass the captcha at: ',
          zh: '您需要完成验证码： '
        },
        online_mod_captcha_proxy: {
          ru: 'Требуется пройти капчу. Попробуйте использовать зеркало вместо прокси',
          uk: 'Потрібно пройти капчу. Спробуйте використовувати дзеркало замість проксі',
          be: 'Патрабуецца прайсці капчу. Паспрабуйце выкарыстоўваць люстэрка замест проксі',
          en: 'It is required to pass the captcha. Try to use a mirror instead of a proxy',
          zh: '您需要通过验证码。 尝试使用镜子而不是代理'
        },
        online_mod_balanser: {
          ru: 'Балансер',
          uk: 'Балансер',
          be: 'Балансер',
          en: 'Balancer',
          zh: '平衡器'
        },
        online_mod_file_helper: {
          ru: 'Удерживайте клавишу "ОК" для вызова контекстного меню',
          uk: 'Утримуйте клавішу "ОК" для виклику контекстного меню',
          be: 'Утрымлівайце клавішу "ОК" для выкліку кантэкстнага меню',
          en: 'Hold the "OK" key to bring up the context menu',
          zh: '按住“确定”键调出上下文菜单'
        },
        online_mod_clearmark_all: {
          ru: 'Снять отметку у всех',
          uk: 'Зняти позначку у всіх',
          be: 'Зняць адзнаку ва ўсіх',
          en: 'Uncheck all',
          zh: '取消所有'
        },
        online_mod_timeclear_all: {
          ru: 'Сбросить тайм-код у всех',
          uk: 'Скинути тайм-код у всіх',
          be: 'Скінуць тайм-код ва ўсіх',
          en: 'Reset timecode for all',
          zh: '为所有人重置时间码'
        },
        online_mod_query_start: {
          ru: 'По запросу',
          uk: 'На запит',
          be: 'Па запыце',
          en: 'On request',
          zh: '根据要求'
        },
        online_mod_query_end: {
          ru: 'нет результатов',
          uk: 'немає результатів',
          be: 'няма вынікаў',
          en: 'no results',
          zh: '没有结果'
        },
        online_mod_title: {
          ru: 'Онлайн',
          uk: 'Онлайн',
          be: 'Анлайн',
          en: 'Online',
          zh: '在线的'
        },
        online_mod_title_full: {
          ru: 'Онлайн Мод',
          uk: 'Онлайн Мод',
          be: 'Анлайн Мод',
          en: 'Online Mod',
          zh: '在线的 Mod'
        },
        online_mod_use_stream_proxy: {
          ru: 'Проксировать видеопоток (Укр)',
          uk: 'Проксирувати відеопотік (Укр)',
          be: 'Праксіраваць відэаструмень (Укр)',
          en: 'Proxy video stream (Ukr)',
          zh: '代理视频流 （乌克兰）'
        },
        online_mod_proxy_find_ip: {
          ru: 'Передавать свой IP прокси',
          uk: 'Передавати свій IP проксі',
          be: 'Перадаваць свой IP проксі',
          en: 'Send your IP to proxy',
          zh: '将您的 IP 发送给代理'
        },
        online_mod_proxy_other: {
          ru: 'Использовать альтернативный прокси',
          uk: 'Використовувати альтернативний проксі',
          be: 'Выкарыстоўваць альтэрнатыўны проксі',
          en: 'Use an alternative proxy',
          zh: '使用备用代理'
        },
        online_mod_proxy_other_url: {
          ru: 'Альтернативный прокси',
          uk: 'Альтернативний проксі',
          be: 'Альтэрнатыўны проксі',
          en: 'Alternative proxy',
          zh: '备用代理'
        },
        online_mod_proxy_balanser: {
          ru: 'Проксировать',
          uk: 'Проксирувати',
          be: 'Праксіраваць',
          en: 'Proxy',
          zh: '代理'
        },
        online_mod_proxy_kp: {
          ru: 'Проксировать КиноПоиск',
          uk: 'Проксирувати КиноПоиск',
          be: 'Праксіраваць КиноПоиск',
          en: 'Proxy KinoPoisk',
          zh: '代理 KinoPoisk'
        },
        online_mod_skip_kp_search: {
          ru: 'Не искать в КиноПоиск',
          uk: 'Не шукати у КиноПоиск',
          be: 'Не шукаць у КиноПоиск',
          en: 'Skip search in KinoPoisk',
          zh: '在 KinoPoisk 中跳过搜索'
        },
        online_mod_iframe_proxy: {
          ru: 'Использовать iframe-прокси',
          uk: 'Використовувати iframe-проксі',
          be: 'Выкарыстоўваць iframe-проксі',
          en: 'Use iframe proxy',
          zh: '使用 iframe 代理'
        },
        online_mod_prefer_http: {
          ru: 'Предпочитать поток по HTTP',
          uk: 'Віддавати перевагу потіку по HTTP',
          be: 'Аддаваць перавагу патоку па HTTP',
          en: 'Prefer stream over HTTP',
          zh: '优先于 HTTP 流式传输'
        },
        online_mod_prefer_mp4: {
          ru: 'Предпочитать поток MP4',
          uk: 'Віддавати перевагу потіку MP4',
          be: 'Аддаваць перавагу патоку MP4',
          en: 'Prefer MP4 stream',
          zh: '更喜欢 MP4 流'
        },
        online_mod_prefer_dash: {
          ru: 'Предпочитать DASH вместо HLS',
          uk: 'Віддавати перевагу DASH замість HLS',
          be: 'Аддаваць перавагу DASH замест HLS',
          en: 'Prefer DASH over HLS',
          zh: '更喜欢 DASH 而不是 HLS'
        },
        online_mod_collaps_lampa_player: {
          ru: 'Collaps: Встроенный плеер',
          uk: 'Collaps: Вбудований плеєр',
          be: 'Collaps: Убудаваны плэер',
          en: 'Collaps: Lampa player',
          zh: 'Collaps： Lampa播放器'
        },
        online_mod_full_episode_title: {
          ru: 'Полный формат названия серии',
          uk: 'Повний формат назви серії',
          be: 'Поўны фармат назвы серыі',
          en: 'Full episode title format',
          zh: '完整剧集标题格式'
        },
        online_mod_av1_support: {
          ru: 'AV1 поддерживается',
          uk: 'AV1 підтримується',
          be: 'AV1 падтрымліваецца',
          en: 'AV1 supported',
          zh: 'AV1 支持'
        },
        online_mod_save_last_balanser: {
          ru: 'Сохранять историю балансеров',
          uk: 'Зберігати історію балансерів',
          be: 'Захоўваць гісторыю балансараў',
          en: 'Save history of balancers',
          zh: '保存平衡器的历史记录'
        },
        online_mod_clear_last_balanser: {
          ru: 'Очистить историю балансеров',
          uk: 'Очистити історію балансерів',
          be: 'Ачысціць гісторыю балансараў',
          en: 'Clear history of balancers',
          zh: '清除平衡器的历史记录'
        },
        online_mod_kinobase_mirror: {
          ru: 'Зеркало для Kinobase',
          uk: 'Дзеркало для Kinobase',
          be: 'Люстэрка для Kinobase',
          en: 'Mirror for Kinobase',
          zh: 'Kinobase的镜子'
        },
        online_mod_kinobase_cookie: {
          ru: 'Куки для Kinobase',
          uk: 'Кукі для Kinobase',
          be: 'Кукі для Kinobase',
          en: 'Cookie for Kinobase',
          zh: 'Kinobase 的 Cookie'
        },
        online_mod_rezka2_mirror: {
          ru: 'Зеркало для HDrezka',
          uk: 'Дзеркало для HDrezka',
          be: 'Люстэрка для HDrezka',
          en: 'Mirror for HDrezka',
          zh: 'HDrezka的镜子'
        },
        online_mod_proxy_rezka2_mirror: {
          ru: 'Проксировать зеркало HDrezka',
          uk: 'Проксирувати дзеркало HDrezka',
          be: 'Праксіраваць люстэрка HDrezka',
          en: 'Proxy HDrezka mirror',
          zh: '代理HDrezka镜子'
        },
        online_mod_rezka2_name: {
          ru: 'Логин или email для HDrezka',
          uk: 'Логін чи email для HDrezka',
          be: 'Лагін ці email для HDrezka',
          en: 'Login or email for HDrezka',
          zh: 'HDrezka的登录名或电子邮件'
        },
        online_mod_rezka2_password: {
          ru: 'Пароль для HDrezka',
          uk: 'Пароль для HDrezka',
          be: 'Пароль для HDrezka',
          en: 'Password for HDrezka',
          zh: 'HDrezka的密码'
        },
        online_mod_rezka2_login: {
          ru: 'Войти в HDrezka',
          uk: 'Увійти до HDrezka',
          be: 'Увайсці ў HDrezka',
          en: 'Log in to HDrezka',
          zh: '登录HDrezka'
        },
        online_mod_rezka2_logout: {
          ru: 'Выйти из HDrezka',
          uk: 'Вийти з HDrezka',
          be: 'Выйсці з HDrezka',
          en: 'Log out of HDrezka',
          zh: '注销HDrezka'
        },
        online_mod_rezka2_cookie: {
          ru: 'Куки для HDrezka',
          uk: 'Кукі для HDrezka',
          be: 'Кукі для HDrezka',
          en: 'Cookie for HDrezka',
          zh: 'HDrezka 的 Cookie'
        },
        online_mod_rezka2_fill_cookie: {
          ru: 'Заполнить куки для HDrezka',
          uk: 'Заповнити кукі для HDrezka',
          be: 'Запоўніць кукі для HDrezka',
          en: 'Fill cookie for HDrezka',
          zh: '为HDrezka填充Cookie'
        },
        online_mod_rezka2_show_premium: {
          ru: 'Показывать премиум-озвучки',
          uk: 'Показувати преміум-озвучки',
          be: 'Паказваць прэміум-агучкі',
          en: 'Show Premium voices',
          zh: '显示高级配音'
        },
        online_mod_rezka2_fix_stream: {
          ru: 'Фикс видеопотока для HDrezka',
          uk: 'Фікс відеопотоку для HDrezka',
          be: 'Фікс відэаструменю для HDrezka',
          en: 'Fix video stream for HDrezka',
          zh: '修复 HDrezka 的视频流'
        },
        online_mod_rezka2_prx_ukr: {
          ru: 'Прокси-сервер для HDrezka (Укр)',
          uk: 'Проксі-сервер для HDrezka (Укр)',
          be: 'Проксі-сервер для HDrezka (Укр)',
          en: 'Proxy server for HDrezka (Ukr)',
          zh: 'HDrezka 的代理服务器 （乌克兰）'
        },
        online_mod_fancdn_name: {
          ru: 'Логин для FanSerials',
          uk: 'Логін для FanSerials',
          be: 'Лагін для FanSerials',
          en: 'Login for FanSerials',
          zh: 'FanSerials的登录名'
        },
        online_mod_fancdn_password: {
          ru: 'Пароль для FanSerials',
          uk: 'Пароль для FanSerials',
          be: 'Пароль для FanSerials',
          en: 'Password for FanSerials',
          zh: 'FanSerials的密码'
        },
        online_mod_fancdn_cookie: {
          ru: 'Куки для FanSerials',
          uk: 'Кукі для FanSerials',
          be: 'Кукі для FanSerials',
          en: 'Cookie for FanSerials',
          zh: 'FanSerials 的 Cookie'
        },
        online_mod_fancdn_fill_cookie: {
          ru: 'Заполнить куки для FanSerials',
          uk: 'Заповнити кукі для FanSerials',
          be: 'Запоўніць кукі для FanSerials',
          en: 'Fill cookie for FanSerials',
          zh: '为FanSerials填充Cookie'
        },
        online_mod_fancdn_token: {
          ru: 'Токен для FanCDN',
          uk: 'Токен для FanCDN',
          be: 'Токен для FanCDN',
          en: 'Token for FanCDN',
          zh: 'FanCDN 代币'
        },
        online_mod_authorization_required: {
          ru: 'Требуется авторизация',
          uk: 'Потрібна авторизація',
          be: 'Патрабуецца аўтарызацыя',
          en: 'Authorization required',
          zh: '需要授权'
        },
        online_mod_modss_vip: {
          ru: 'Доступно только в MODS\'s VIP',
          uk: 'Доступно лише в MODS\'s VIP',
          be: 'Даступна толькі ў MODS\'s VIP',
          en: 'Available in MODS\'s VIP only',
          zh: '仅在 MODS\'s VIP 中可用'
        },
        online_mod_unsupported_mirror: {
          ru: 'Неподдерживаемое зеркало',
          uk: 'Непідтримуване дзеркало',
          be: 'Непадтрымоўванае люстэрка',
          en: 'Unsupported mirror',
          zh: '不支持的镜子'
        },
        online_mod_anubis_required: {
          ru: 'Зеркало HDrezka под анти-ботом. Вставьте cookie в настройках HDrezka',
          uk: 'Дзеркало HDrezka під анти-ботом. Вставте cookie в налаштуваннях HDrezka',
          be: 'Люстэрка HDrezka пад анты-ботам. Уставіце cookie ў наладах HDrezka',
          en: 'HDrezka mirror is behind an anti-bot check. Paste a cookie in HDrezka settings',
          zh: 'HDrezka 镜像受反机器人保护。请在 HDrezka 设置中粘贴 cookie'
        },
        online_mod_secret_password: {
          ru: 'Секретный пароль',
          uk: 'Секретний пароль',
          be: 'Сакрэтны пароль',
          en: 'Secret password',
          zh: '秘密密码'
        },
        online_mod_seasons_count: {
          ru: 'Сезонов',
          uk: 'Сезонів',
          be: 'Сезонаў',
          en: 'Seasons',
          zh: '季'
        },
        online_mod_episodes_count: {
          ru: 'Эпизодов',
          uk: 'Епізодів',
          be: 'Эпізодаў',
          en: 'Episodes',
          zh: '集'
        },
        online_mod_show_more: {
          ru: 'Показать ещё',
          uk: 'Показати ще',
          be: 'Паказаць яшчэ',
          en: 'Show more',
          zh: '展示更多'
        },
        online_mod_audio_track: {
          ru: 'Дорожка',
          uk: 'Доріжка',
          be: 'Дарожка',
          en: 'Audio track',
          zh: '音轨'
        },
        online_mod_server: {
          ru: 'Сервер',
          uk: 'Сервер',
          be: 'Сервер',
          en: 'Server',
          zh: '服务器'
        },
        online_mod_filmix_param_add_title: {
          ru: 'Добавить ТОКЕН от Filmix',
          uk: 'Додати ТОКЕН від Filmix',
          be: 'Дадаць ТОКЕН ад Filmix',
          en: 'Add TOKEN from Filmix',
          zh: '从 Filmix 添加 TOKEN'
        },
        online_mod_filmix_param_add_descr: {
          ru: 'Добавьте ТОКЕН для подключения подписки',
          uk: 'Додайте ТОКЕН для підключення передплати',
          be: 'Дадайце ТОКЕН для падлучэння падпіскі',
          en: 'Add a TOKEN to connect a subscription',
          zh: '添加 TOKEN 以连接订阅'
        },
        online_mod_filmix_param_placeholder: {
          ru: 'Например: nxjekeb57385b..',
          uk: 'Наприклад: nxjekeb57385b..',
          be: 'Напрыклад: nxjekeb57385b..',
          en: 'For example: nxjekeb57385b..',
          zh: '例如： nxjekeb57385b..'
        },
        online_mod_filmix_param_add_device: {
          ru: 'Добавить устройство на Filmix',
          uk: 'Додати пристрій на Filmix',
          be: 'Дадаць прыладу на Filmix',
          en: 'Add Device to Filmix',
          zh: '将设备添加到 Filmix'
        },
        online_mod_filmix_modal_text: {
          ru: 'Введите его на странице ' + filmixHost + '/consoles в вашем авторизованном аккаунте!',
          uk: 'Введіть його на сторінці ' + filmixHost + '/consoles у вашому авторизованому обліковому записі!',
          be: 'Увядзіце яго на старонцы ' + filmixHost + '/consoles у вашым аўтарызаваным акаўнце!',
          en: 'Enter it at ' + filmixHost + '/consoles in your authorized account!',
          zh: '在您的授权帐户中的 ' + filmixHost + '/consoles 中输入！'
        },
        online_mod_filmix_modal_wait: {
          ru: 'Ожидаем код',
          uk: 'Очікуємо код',
          be: 'Чакаем код',
          en: 'Waiting for the code',
          zh: '等待代码'
        },
        online_mod_filmix_copy_secuses: {
          ru: 'Код скопирован в буфер обмена',
          uk: 'Код скопійовано в буфер обміну',
          be: 'Код скапіяваны ў буфер абмену',
          en: 'Code copied to clipboard',
          zh: '代码复制到剪贴板'
        },
        online_mod_filmix_copy_fail: {
          ru: 'Ошибка при копировании',
          uk: 'Помилка при копіюванні',
          be: 'Памылка пры капіяванні',
          en: 'Copy error',
          zh: '复制错误'
        },
        online_mod_filmix_nodevice: {
          ru: 'Устройство не авторизовано',
          uk: 'Пристрій не авторизований',
          be: 'Прылада не аўтарызавана',
          en: 'Device not authorized',
          zh: '设备未授权'
        },
        online_mod_filmix_status: {
          ru: 'Статус',
          uk: 'Статус',
          be: 'Статус',
          en: 'Status',
          zh: '状态'
        },
        online_mod_voice_subscribe: {
          ru: 'Подписаться на перевод',
          uk: 'Підписатися на переклад',
          be: 'Падпісацца на пераклад',
          en: 'Subscribe to translation',
          zh: '订阅翻译'
        },
        online_mod_voice_success: {
          ru: 'Вы успешно подписались',
          uk: 'Ви успішно підписалися',
          be: 'Вы паспяхова падпісаліся',
          en: 'You have successfully subscribed',
          zh: '您已成功订阅'
        },
        online_mod_voice_error: {
          ru: 'Возникла ошибка',
          uk: 'Виникла помилка',
          be: 'Узнікла памылка',
          en: 'An error has occurred',
          zh: '发生了错误'
        }
      });
    }

    function resetTemplates() {
      Lampa.Template.add('online_mod', "<div class=\"online selector\">\n        <div class=\"online__body\">\n            <div style=\"position: absolute;left: 0;top: -0.3em;width: 2.4em;height: 2.4em\">\n                <svg style=\"height: 2.4em; width:  2.4em;\" viewBox=\"0 0 128 128\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n                    <circle cx=\"64\" cy=\"64\" r=\"56\" stroke=\"white\" stroke-width=\"16\"/>\n                    <path d=\"M90.5 64.3827L50 87.7654L50 41L90.5 64.3827Z\" fill=\"white\"/>\n                </svg>\n            </div>\n            <div class=\"online__title\" style=\"padding-left: 2.1em;\">{title}</div>\n            <div class=\"online__quality\" style=\"padding-left: 3.4em;\">{quality}{info}</div>\n        </div>\n    </div>");
      Lampa.Template.add('online_mod_folder', "<div class=\"online selector\">\n        <div class=\"online__body\">\n            <div style=\"position: absolute;left: 0;top: -0.3em;width: 2.4em;height: 2.4em\">\n                <svg style=\"height: 2.4em; width:  2.4em;\" viewBox=\"0 0 128 112\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n                    <rect y=\"20\" width=\"128\" height=\"92\" rx=\"13\" fill=\"white\"/>\n                    <path d=\"M29.9963 8H98.0037C96.0446 3.3021 91.4079 0 86 0H42C36.5921 0 31.9555 3.3021 29.9963 8Z\" fill=\"white\" fill-opacity=\"0.23\"/>\n                    <rect x=\"11\" y=\"8\" width=\"106\" height=\"76\" rx=\"13\" fill=\"white\" fill-opacity=\"0.51\"/>\n                </svg>\n            </div>\n            <div class=\"online__title\" style=\"padding-left: 2.1em;\">{title}</div>\n            <div class=\"online__quality\" style=\"padding-left: 3.4em;\">{quality}{info}</div>\n        </div>\n    </div>");
    }

    function checkMyIp(onComplite) {
      if (Lampa.Storage.field('online_mod_proxy_find_ip') !== true) {
        onComplite();
        return;
      }

      Utils.checkMyIp(network, onComplite);
    }

    function checkCurrentFanserialsHost(onComplite) {
      var host = Utils.getCurrentFanserialsHost();

      if (host || !Utils.isDebug()) {
        onComplite();
        return;
      }

      var prox = Utils.proxy('cookie');
      var prox_enc = '';
      var returnHeaders = androidHeaders;

      if (!prox && !returnHeaders) {
        onComplite();
        return;
      }

      var user_agent = Utils.baseUserAgent();
      var headers = Lampa.Platform.is('android') ? {
        'User-Agent': user_agent
      } : {};

      if (prox) {
        prox_enc += 'param/User-Agent=' + encodeURIComponent(user_agent) + '/';
        prox_enc += 'cookie_plus/param/Cookie=/head/';
        returnHeaders = false;
      }

      var url = Utils.fanserialsHost() + '/';
      network.clear();
      network.timeout(10000);
      network["native"](Utils.proxyLink(url, prox, prox_enc, 'enc2t'), function (json) {
        if (json && json.currentUrl) {
          var _url = Utils.parseURL(json.currentUrl);

          Utils.setCurrentFanserialsHost(_url.origin);
        }

        onComplite();
      }, function (a, c) {
        onComplite();
      }, false, {
        headers: headers,
        returnHeaders: returnHeaders
      });
    }

    /**
     * Modss integration: when the MODS's online screen is open, prepend our
     * balancers to its source list. Selection opens our own online_mod screen
     * with that balancer preselected.
     *
     * Nothing here touches filters of other screens: everything is gated by
     * `Lampa.Activity.active().component === 'modss_online'`, so without the
     * modss.tv plugin the behaviour is exactly the same as before.
     */
    var modssSourcesSnapshot = [];

    function isModssScreen() {
      try {
        var active = Lampa.Activity && typeof Lampa.Activity.active === 'function' ? Lampa.Activity.active() : null;
        return !!(active && active.component === 'modss_online');
      } catch (e) {
        return false;
      }
    }

    function modssFindBalancer(name) {
      for (var i = 0; i < Balancers.length; i++) {
        if (Balancers[i] && Balancers[i].name === name) return Balancers[i];
      }
      return null;
    }

    function modssPrependSources(items) {
      var rest = [];
      var ours = [];
      var used = {};
      var existing = {};
      var preferred = ['narutobased', 'rezka2'];

      if (items && items.forEach) {
        items.forEach(function (item) {
          if (!item) return;

          if (item.online_mod) return;
          rest.push(item);
          if (item.source) existing[item.source] = true;
        });
      }

      modssSourcesSnapshot = rest.map(function (item) {
        return {
          source: item.source,
          rawTitle: item.title || item.source || '',
          title: String(item.title || item.source || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(),
          vip: item.ghost === true
        };
      }).filter(function (item) {
        return item.source && item.title;
      });

      var add = function (source) {
        if (!source || source.disabled || used[source.name] || existing[source.name]) return;

        used[source.name] = true;
        ours.push({
          title: source.title,
          source: 'online_mod_' + source.name,
          online_mod: source.name
        });
      };

      preferred.forEach(function (name) {
        add(modssFindBalancer(name));
      });

      Balancers.forEach(add);

      return ours.concat(rest);
    }

    function modssWrapOnSelect(filter) {
      if (!filter || typeof filter.onSelect !== 'function' || filter.onSelect.__online_mod) return;

      var original = filter.onSelect;

      filter.onSelect = function (type, a, b) {
        if (type === 'sort' && a && a.online_mod) {
          try {
            if (Lampa.Select && typeof Lampa.Select.close === 'function') Lampa.Select.close();
          } catch (e) {}

          try {
            var active = Lampa.Activity.active() || {};
            var card = active.movie || active.card;

            if (card) loadOnline(card, a.online_mod);
          } catch (e) {}

          return;
        }

        return original.apply(this, arguments);
      };

      filter.onSelect.__online_mod = true;
    }

    function modssPatchFilter(filter) {
      if (!filter || filter.__online_mod_patched) return;

      filter.__online_mod_patched = true;

      var originalSet = filter.set;

      filter.set = function (type, items) {
        if (type === 'sort' && isModssScreen()) {
          items = modssPrependSources(items);
          modssWrapOnSelect(filter);
        }

        return originalSet.call(this, type, items);
      };

      var originalShow = filter.show;

      if (typeof originalShow === 'function') {
        filter.show = function (title, type) {
          if (type === 'sort' && isModssScreen()) modssWrapOnSelect(filter);
          return originalShow.apply(this, arguments);
        };
      }
    }

    function initModssIntegration() {
      if (!window.Lampa || typeof Lampa.Filter !== 'function' || Lampa.Filter.__online_mod) return;

      var OriginalFilter = Lampa.Filter;

      function ModssFilter() {
        var args = Array.prototype.slice.call(arguments);
        var instance = new (Function.prototype.bind.apply(OriginalFilter, [null].concat(args)))();

        try {
          modssPatchFilter(instance);
        } catch (e) {}

        return instance;
      }

      ModssFilter.prototype = OriginalFilter.prototype;
      ModssFilter.__online_mod = true;
      Lampa.Filter = ModssFilter;
    }

    // "По сериям": a source run without its screen. Seasons and voices are walked one redraw at a time: a source that
    // answers a switch at once (Alloha, Kodik, HDrezka, Turbo: all in one answer) is walked whole, one that asks the
    // network per switch only for the wanted season. Rows are placed on Lampa's numbering by the rules the list uses.
    // done(res, covered): res = {status: 'ok'|'none'|'error'|'choose', rows, similars, message}; covered is false when a
    // probe started for another season answered and the wanted one was not walked (ask again).
    function episodeVariants(card, balancer, pin, done) {
      var key = balancer + ':' + watch.id(card);
      var covers = function covers(entry, p) {
        if (entry.all || !p) return true;
        var i = watch.pinSeason(p, entry.labels);
        // a season the source numbers otherwise (Kodik's parts) cannot be told: what was walked stands
        return i < 0 || !!entry.done[i];
      };
      var hit = episodeVariants.cache[key] || (episodeVariants.cache[key] = episodeVariants.load(key));
      if (!hit) delete episodeVariants.cache[key];
      if (hit && covers(hit, pin)) return done(hit.res, true);
      if (episodeVariants.pending[key]) return episodeVariants.pending[key].push({ pin: pin, done: done });
      var waiting = episodeVariants.pending[key] = [];
      var rows = [];
      // an anime probed before the other sources' season lists came is placed without them, even if they come meanwhile
      var altLate = animeSkip.isAnime(card) && !watch.altOf(card);
      var labels = null;
      var batch = [];
      var walked = {};
      var seasons = null;
      var voices = [];
      var names = [];
      var current = -1;
      var wanted = -1;
      var step = null;
      var stepTimer = null;
      var slow = false;
      var cut = false;
      var finished = false;
      var noop = function noop() {};
      var probe;
      var obj = { movie: card, balancer: balancer, search: card.title, search_one: card.title, search_two: card.original_title, page: 1 };
      var finish = function finish(status, extra) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        clearTimeout(stepTimer);
        var res = { status: status, rows: rows, similars: extra && extra.similars || null, message: extra && extra.message || '' };
        var entry = { res: res, labels: labels && labels.season ? labels.season.slice() : [], done: walked, all: status === 'none' || status === 'ok' && !cut };
        // a list placed before Lampa split a single TMDB season keeps TMDB's numbers, an anime's before the other
        // sources' season lists came (watch.alt) is not placed yet: neither is kept
        var unsure = Lampa.Utils.countSeasons && Lampa.Utils.countSeasons(card) === 1 && !watch.splitOf(card) || altLate;
        if ((status === 'ok' || status === 'none') && !unsure) {
          episodeVariants.cache[key] = entry;
          try {
            episodeVariants.save(key, entry);
          } catch (e) {}
        }
        delete episodeVariants.pending[key];
        try {
          probe.destroy();
        } catch (e) {}
        done(res, true);
        waiting.forEach(function (w) {
          w.done(res, covers(entry, w.pin));
        });
      };
      // what was walked by then stands
      var timer = setTimeout(function () {
        cut = true;
        finish(rows.length ? 'ok' : 'error');
      }, 60000);
      var stepDone = function stepDone(ok) {
        var me = step;
        if (!me) return;
        step = null;
        clearTimeout(stepTimer);
        if (ok && me.kind === 'season') {
          names = (labels && labels.voice || []).slice();
          voices = names.map(function (n, i) {
            return i;
          });
        }
        // a season that did not load is not walked: not kept as done
        if (!ok && me.kind === 'season') {
          cut = true;
          voices = [];
          current = -1;
        }
        if (ok && me.kind === 'voice') {
          for (var i = 0; i < batch.length; i++) rows.push({ season: current, voice: names[me.index], element: batch[i] });
        }
        setTimeout(next, 0);
      };
      var go = function go(kind, index) {
        var me = step = { kind: kind, index: index };
        batch = [];
        clearTimeout(stepTimer);
        // a redraw that never comes ends the walk: a late one would be taken for the next step
        stepTimer = setTimeout(function () {
          if (step !== me) return;
          step = null;
          cut = true;
          finish(rows.length ? 'ok' : 'error');
        // a source that loads per switch gets longer (a part with many voices on a slow proxy)
        }, slow ? 30000 : 15000);
        try {
          probe.source().filter('filter', { stype: kind }, { index: index });
        } catch (e) {
          if (step === me) return stepDone(false);
        }
        // the redraw did not come within the call: this source asks the network per switch, and gets longer
        if (step === me) {
          slow = true;
          clearTimeout(stepTimer);
          stepTimer = setTimeout(function () {
            if (step !== me) return;
            step = null;
            cut = true;
            finish(rows.length ? 'ok' : 'error');
          }, 30000);
        }
      };
      var next = function next() {
        if (finished || step) return;
        if (voices.length) return go('voice', voices.shift());
        if (current >= 0) walked[current] = true;
        // a slow source stops once the wanted season (without one: the first) is walked
        if (slow && seasons.length && (wanted < 0 || walked[wanted] || cut)) {
          cut = true;
          seasons = [];
        }
        if (!seasons.length) return finish('ok');
        current = seasons.shift();
        go('season', current);
      };
      // the probe's component would take over the screen's refresh hook
      var refresh = watch.refresh;
      try {
        probe = new component(obj);
        watch.refresh = refresh;
      } catch (e) {
        watch.refresh = refresh;
        return finish('error');
      }
      probe.activity = { loader: noop, toggle: noop };
      probe.watch_probe = true;
      ['loading', 'reset', 'append', 'contextmenu', 'saveChoice', 'extendChoice', 'closeFilter', 'updateQualityFilter'].forEach(function (m) {
        probe[m] = noop;
      });
      // inside a walk a failed redraw only skips that step
      // between two steps a stray answer is ignored
      probe.emptyForQuery = function () {
        if (step) return stepDone(false);
        if (seasons) return;
        finish('none');
      };
      probe.empty = function (message) {
        if (step) return stepDone(false);
        if (seasons) return;
        finish('error', { message: typeof message == 'string' ? message : '' });
      };
      // several titles: the user settles it once (watch.similarSave), the next probe goes straight to it
      var replays = 0;
      probe.similars = function (items) {
        if (step) return stepDone(false);
        if (seasons) return;
        items = items || [];
        var level = items[0] && items[0].is_similars ? 'src' : 'find';
        var saved = watch.similarKey(watch.similarOf(card, balancer, level));
        var pick = null;
        for (var i = 0; i < items.length && saved && !pick; i++) if (watch.similarKey(items[i]) === saved) pick = items[i];
        // the title settled before: on to it, as a click in the source's list does (a list that keeps coming back stops)
        if (pick && replays++ < 3) {
          obj.search = pick.title || pick.ru_title || pick.nameRu || pick.en_title || pick.orig_title || obj.search;
          obj.search_date = pick.year || pick.start_date || '';
          try {
            probe.source().search(obj, pick.kp_id || pick.kinopoisk_id || pick.kinopoiskId || pick.filmId || pick.imdb_id, [pick]);
          } catch (e) {
            finish('error');
          }
          return;
        }
        finish('choose', { similars: items });
      };
      probe.filter = function (items) {
        if (items && items.season) labels = items;
      };
      probe.watchView = function (element, hash, items) {
        watch.hashOf(card, balancer, element, items, labels && labels.season ? labels.season.length : 0);
        batch.push(element);
        return Lampa.Timeline.view(hash);
      };
      probe.start = function () {
        if (finished) return;
        if (step) return stepDone(true);
        // a redraw nobody asked for
        if (seasons) return;
        // shortcut: a source that lists a series without a season filter shows nothing here; open it from its row
        if (!labels || !labels.season || !labels.season.length) return finish('none');
        wanted = pin ? watch.pinSeason(pin, labels.season) : -1;
        seasons = labels.season.map(function (n, i) {
          return i;
        });
        if (wanted > 0) {
          seasons.splice(wanted, 1);
          seasons.unshift(wanted);
        }
        // HDrezka's rows get the title's real qualities once one stream was asked
        var source = probe.source();
        if (!source || !source.qualityProbe) return setTimeout(next, 0);
        source.qualityProbe(function () {
          if (!finished) setTimeout(next, 0);
        });
      };
      try {
        probe.find();
      } catch (e) {
        finish('error');
      }
    }
    episodeVariants.cache = {};
    episodeVariants.pending = {};
    // «По сериям» answers kept between sessions (6 h), in the few fields the screen needs: the voice, the quality,
    // the source's own numbers, the place on Lampa's numbering, whether the source numbers by its own releases.
    // Read from Lampa's storage once per session, then kept in memory.
    // a new version of the rows (Alloha's quality fields) starts a new store; the old one is emptied once
    episodeVariants.store = 'online_mod_variants_v2';
    // bump when the placement rules change: answers saved under older rules are not reused
    episodeVariants.rules = 2;
    episodeVariants.all = function () {
      if (!episodeVariants.mem) {
        var old = Lampa.Storage.get('online_mod_variants', '{}');
        if (old && typeof old == 'object' && Object.keys(old).length) Lampa.Storage.set('online_mod_variants', {});
        var all = Lampa.Storage.get(episodeVariants.store, '{}');
        episodeVariants.mem = all && typeof all == 'object' ? all : {};
      }
      return episodeVariants.mem;
    };
    episodeVariants.load = function (key) {
      var s = episodeVariants.all()[key];
      if (!s || typeof s != 'object' || !s.r || s.w !== episodeVariants.rules || Date.now() - (s.t || 0) > 6 * 3600 * 1000) return null;
      var rows = s.r.map(function (r) {
        var element = { season: r[2], episode: r[3], quality: s.q[r[4]] || '', watch_place: r[5] ? { season: r[5], episode: r[6] } : null, watch_info: r[7] ? { src: 1 } : null };
        if (r[8] && s.b) {
          element.quality_base = s.b;
          element.quality_tid = r[8];
          element.quality_uhd = !!r[9];
        }
        return { season: r[0], voice: s.v[r[1]], element: element };
      });
      return { res: { status: s.s, rows: rows, similars: null, message: '' }, labels: s.l || [], done: s.d || {}, all: !!s.a };
    };
    episodeVariants.save = function (key, entry) {
      var voices = [];
      var quals = [];
      var index = function index(list, x) {
        var i = list.indexOf(x);
        if (i < 0) {
          list.push(x);
          i = list.length - 1;
        }
        return i;
      };
      var base = '';
      var rows = entry.res.rows.map(function (row) {
        var el = row.element || {};
        var w = el.watch_place;
        // shortcut: one shared base per card; keep it per row if a card's Alloha rows ever carry two iframes
        if (!base && el.quality_base) base = el.quality_base;
        return [row.season, index(voices, row.voice), el.season, el.episode, index(quals, el.quality || ''), w ? w.season : 0, w ? w.episode : 0, el.watch_info && el.watch_info.src ? 1 : 0, el.quality_base && el.quality_tid ? el.quality_tid : 0, el.quality_uhd ? 1 : 0];
      });
      var one = { t: Date.now(), w: episodeVariants.rules, s: entry.res.status, l: entry.labels, d: entry.done, a: entry.all, v: voices, q: quals, r: rows };
      if (base) one.b = base;
      var size = JSON.stringify(one).length;
      var all = episodeVariants.all();
      delete all[key];
      // a long anime of a source with many voices stays out of the store (the memory copy still serves this session)
      if (size > 100000) return Lampa.Storage.set(episodeVariants.store, all);
      all[key] = one;
      // shortcut: about 1 MB in all (a TV's storage is small and shared with Lampa's own); the oldest go first
      var keys = Object.keys(all);
      var total = JSON.stringify(all).length;
      while (keys.length > 1 && total > 1000000) {
        var old = keys.shift();
        total -= JSON.stringify(all[old]).length;
        delete all[old];
      }
      Lampa.Storage.set(episodeVariants.store, all);
    };
    episodeVariants.forget = function (key) {
      delete episodeVariants.cache[key];
      var all = episodeVariants.all();
      if (all[key]) {
        delete all[key];
        Lampa.Storage.set(episodeVariants.store, all);
      }
    };
    episodeVariants.forgetCard = function (id) {
      var all = episodeVariants.all();
      var hit = false;
      Object.keys(episodeVariants.cache).concat(Object.keys(all)).forEach(function (key) {
        if (key.slice(-id.length - 1) !== ':' + id) return;
        delete episodeVariants.cache[key];
        if (all[key]) {
          delete all[key];
          hit = true;
        }
      });
      if (hit) Lampa.Storage.set(episodeVariants.store, all);
    };
    episodeVariants.clear = function () {
      episodeVariants.cache = {};
      episodeVariants.mem = {};
      Lampa.Storage.set(episodeVariants.store, {});
    };


    // «По сериям»: a voice plays without its source's screen. The source runs off screen with the screen's own list
    // code (its rows, their timelines, the player and the next episodes it builds); its season and voice are set as
    // picked and the row of the episode is pressed. It lives until the player closes. fallback() opens the source's
    // screen instead: no such row, a question only the user answers, no answer in 30 s.
    function playVariant(card, balancer, pin, pick, fallback) {
      var noop = function noop() {};
      var rows = [];
      var labels = null;
      var choice = null;
      var stage = 'search';
      var over = false;
      var replays = 0;
      var drawn = 0;
      var wait = -1;
      var cancelled = false;
      var onDestroy = null;
      var voiceRetried = false;
      var scanned = {};
      var probe;
      var obj = { movie: card, balancer: balancer, search: card.title, search_one: card.title, search_two: card.original_title, page: 1 };
      var stop = function stop() {
        clearTimeout(timer);
        try {
          probe.destroy();
        } catch (e) {}
      };
      var fail = function fail() {
        if (over) return;
        watch.diag('pv-fail', { b: balancer, stage: stage, pin: pin, pick: pick, season: labels && labels.season, voice: labels && labels.voice, choice: choice, rows: rows.length });
        over = true;
        Lampa.Loading.stop();
        stop();
        fallback();
      };
      var timer = setTimeout(fail, 30000);
      // the probe's component would take over the screen's refresh hook
      var hook = watch.refresh;
      try {
        probe = new component(obj);
        watch.refresh = hook;
      } catch (e) {
        watch.refresh = hook;
        return fail();
      }
      probe.activity = { loader: noop, toggle: noop };
      probe.watch_probe = true;
      ['loading', 'append', 'closeFilter'].forEach(function (m) {
        probe[m] = noop;
      });
      var reset = probe.reset;
      probe.reset = function () {
        rows = [];
        return reset.apply(this, arguments);
      };
      var filter = probe.filter;
      probe.filter = function (items, current) {
        if (items && items.season) {
          drawn++;
          labels = items;
          choice = current;
        }
        return filter.apply(this, arguments);
      };
      probe.contextmenu = function (params) {
        rows.push(params);
      };
      probe.empty = probe.emptyForQuery = function () {
        fail();
      };
      // several titles: the one settled before (watch.similarSave) is taken, as in episodeVariants
      probe.similars = function (items) {
        items = items || [];
        var level = items[0] && items[0].is_similars ? 'src' : 'find';
        var saved = watch.similarKey(watch.similarOf(card, balancer, level));
        var hit = null;
        for (var i = 0; i < items.length && saved && !hit; i++) if (watch.similarKey(items[i]) === saved) hit = items[i];
        if (!hit || replays++ >= 3) return fail();
        obj.search = hit.title || hit.ru_title || hit.nameRu || hit.en_title || hit.orig_title || obj.search;
        obj.search_date = hit.year || hit.start_date || '';
        try {
          probe.source().search(obj, hit.kp_id || hit.kinopoisk_id || hit.kinopoiskId || hit.filmId || hit.imdb_id, [hit]);
        } catch (e) {
          fail();
        }
      };
      var next = function next(kind, index) {
        wait = drawn;
        setTimeout(function () {
          if (over) return;
          try {
            probe.source().filter('filter', { stype: kind }, { index: index });
          } catch (e) {
            fail();
          }
        }, 0);
      };
      // each redraw of the source moves one step: the season, the voice, then the episode's row
      probe.start = function () {
        if (over || !labels) return;
        if (wait >= 0 && drawn <= wait) return;
        if (stage === 'search') {
          stage = 'season';
          if (labels.season && labels.season[pick.season] !== undefined && choice && choice.season !== pick.season) return next('season', pick.season);
        }
        if (stage === 'season') {
          stage = 'voice';
          // no voice known (Lampa's own timeline): the source keeps the voice it restored for this title
          var v = pick.voice_name == null ? -1 : (labels.voice || []).indexOf(pick.voice_name);
          if (v < 0 && pick.voice_name != null && labels.voice && labels.voice.length) return fail();
          if (v >= 0 && choice && choice.voice !== v) return next('voice', v);
        }
        if (stage !== 'voice') return;
        if (pick.voice_name != null && labels.voice && labels.voice.length && choice && labels.voice[choice.voice] !== pick.voice_name) {
          if (voiceRetried) return fail();
          var idx = (labels.voice || []).indexOf(pick.voice_name);
          if (idx < 0) return fail();
          voiceRetried = true;
          return next('voice', idx);
        }
        stage = 'play';
        var row = watch.pinRow(pin, rows);
        if (!row && pick.scan && labels.season && choice) {
          // only Lampa's timeline knows the episode: look for it in the source's other seasons, one redraw each
          scanned[choice.season] = true;
          for (var si = 0; si < labels.season.length && scanned[si]; si++);
          if (si < labels.season.length) {
            stage = 'season';
            scanned[si] = true;
            return next('season', si);
          }
        }
        if (!row) return fail();
        var rowEntry = rows.filter(function (r) { return r.item === row; })[0];
        // its place is not proven: the source's own screen asks, a guess would write a wrong watched mark
        if (rowEntry && rowEntry.element && rowEntry.element.watch_pending) {
          watch.diag('pv-pending', { b: balancer, pin: pin, es: rowEntry.element.season, ee: rowEntry.element.episode });
          return fail();
        }
        over = true;
        clearTimeout(timer);
        var started = false;
        var listener = Lampa.Player && Lampa.Player.listener;
        var onStart = function onStart() {
          if (cancelled) {
            try { Lampa.Player.close(); } catch (e) {}
            return;
          }
          started = true;
          // the player really started: only then is it what the user last played
          watch.remember(card, balancer, pick.voice_name != null ? pick.voice_name : labels && labels.voice && choice ? labels.voice[choice.voice] : '', choice ? choice.season : pick.season, rowEntry && rowEntry.element);
        };
        onDestroy = function onDestroy() {
          if (listener) {
            listener.remove('start', onStart);
            listener.remove('destroy', onDestroy);
          }
          stop();
        };
        if (listener) {
          listener.follow('start', onStart);
          listener.follow('destroy', onDestroy);
        }
        // safety: if the player never started within 60 s, tear down
        setTimeout(function () {
          if (!started) onDestroy();
        }, 60000);
        setTimeout(function () {
          if (cancelled) return;
          Lampa.Loading.stop(); // Lampa's player takes the remote; stopping the loader after it would hand the remote back to the screen.
          row.trigger('hover:enter');
        }, 0);
      };
      // back while it loads: nothing plays
      Lampa.Loading.start(function () {
        cancelled = true;
        Lampa.Loading.stop();
        if (!over) {
          over = true;
          stop();
        } else if (onDestroy) {
          onDestroy();
        }
      });
      try {
        probe.find();
      } catch (e) {
        fail();
      }
    }

    // "По сериям", one episode: every source as a row with its state (loading, its voices for this episode, ✕, !),
    // filled in as the sources answer. A voice plays the episode; a source row opens the source on it.
    function variantsScreen(object) {
      var L = Lampa.Lang.translate;
      var card = object.card;
      var pin = object.pin;
      var self = this;
      var scroll = new Lampa.Scroll({ mask: true, over: true });
      var html = $('<div class="online-mod-variants"></div>');
      // the screen's height (minus Lampa's head), so the list scrolls
      scroll.minus();
      scroll.body().addClass('online-mod-variants__body');
      var last = null;
      var alive = true;
      var groups = {};
      var row = function row(title, subtitle, cls) {
        var item = $('<div class="online-mod-variant selector"><div class="online-mod-variant__text"><div class="online-mod-variant__title"></div><div class="online-mod-variant__subtitle"></div></div><div class="online-mod-variant__status"></div></div>');
        item.find('.online-mod-variant__title').text(title);
        item.find('.online-mod-variant__subtitle').text(subtitle || '');
        if (cls) item.addClass(cls);
        item.on('hover:focus', function (e) {
          last = e.target;
          clearTimeout(qTimer);
          scroll.update($(e.target), true);
        });
        return item;
      };
      var headSub = function headSub(b, found) {
        // before any HDrezka playback there is no saved result yet: the Premium setting decides
        var cap = b.name === 'rezka2' ? +Lampa.Storage.get('online_mod_rezka2_best', 0) || (Lampa.Storage.field('online_mod_rezka2_show_premium') === true ? 1080 : 720) : 0;
        var badge = watch.qualityBadge(found.map(function (r) { return r.element.quality; }), cap);
        groups[b.name].head.find('.online-mod-variant__subtitle').text([badge, L('online_mod_variants_voices') + ' ' + found.length].filter(Boolean).join(' · '));
      };
      var rowSub = function rowSub(el) {
        return [el.quality, el.watch_place ? '' : L('online_mod_watch_unproven')].filter(Boolean).join(' · ');
      };
      // Alloha does not list a voice's resolution: it is asked from the helper once the remote stays on the voice
      var qTimer = 0;
      var qBusy = false;
      var qNext = null;
      var qNet = new Lampa.Reguest();
      var qApply = function qApply(b, r, item, max) {
        var el = r.element;
        if (!max || !alive) return;
        var i = (el.quality || '').indexOf(' / ');
        el.quality = '360p ~ ' + max + 'p' + (i < 0 ? '' : el.quality.slice(i));
        item.find('.online-mod-variant__subtitle').text(rowSub(el));
        var g = groups[b.name];
        if (g.found && g.found.indexOf(r) >= 0) headSub(b, g.found);
      };
      var qRun = function qRun(w) {
        qBusy = true;
        var done = function done() {
          qBusy = false;
          var n = qNext;
          qNext = null;
          if (n && alive) qRun(n);
        };
        qNet.clear();
        qNet.timeout(15000);
        qNet["native"](w.url, function (res) {
          var map = res;
          if (typeof res === 'string') {
            try { map = JSON.parse(res); } catch (e) { map = null; }
          }
          var max = allohaBest(map, w.uhd);
          variantsScreen.checked[w.url] = max;
          qApply(w.b, w.r, w.item, max);
          done();
        }, done, false, {
          dataType: 'text'
        });
      };
      var qWatch = function qWatch(b, r, item) {
        var el = r.element;
        var server = Utils.helperServer();
        if (!server || !el.quality_base || !el.quality_tid) return;
        var url = server + '/qualities?url=' + encodeURIComponent(el.quality_base + '&translation=' + el.quality_tid + (el.season ? '&season=' + el.season + '&episode=' + el.episode : '')) + '&real=1'; // no &audio=: the default track's qualities are shown
        if (variantsScreen.checked[url] != null) return qApply(b, r, item, variantsScreen.checked[url]);
        var w = { url: url, b: b, r: r, item: item, uhd: el.quality_uhd };
        if (qBusy) qNext = w;else qRun(w);
      };
      // new rows join the remote's navigation without moving the focus
      var refresh = function refresh() {
        if (!alive || Lampa.Activity.active().activity !== self.activity || Lampa.Controller.enabled().name !== 'content') return;
        Lampa.Controller.collectionSet(scroll.render());
        Lampa.Controller.collectionFocus(last || false, scroll.render());
      };
      // a voice plays without the source's screen; the screen opens when that cannot be done (or no voice is picked)
      var open = function open(b, pick) {
        var screen = function screen() {
          online_loading = false;
          loadOnline(card, b.name, pin, pick);
        };
        if (pick) return playVariant(card, b.name, pin, pick, screen);
        screen();
      };
      var fill = function fill(b, res) {
        var g = groups[b.name];
        g.rows.forEach(function (r) {
          if (last === r[0]) last = g.head[0];
          r.remove();
        });
        g.rows = [];
        g.res = res;
        var status = g.head.find('.online-mod-variant__status').removeClass('is-loading is-error is-choose').text('');
        g.head.find('.online-mod-variant__subtitle').text('');
        if (!res) {
          status.addClass('is-loading');
          return refresh();
        }
        var found = res.status === 'ok' ? watch.pinVariants(pin, res.rows) : [];
        if (res.status === 'error') {
          status.addClass('is-error').text('✕');
          if (res.message) g.head.find('.online-mod-variant__subtitle').text(res.message);
        } else if (res.status === 'choose') {
          status.addClass('is-choose').text('!');
          g.head.find('.online-mod-variant__subtitle').text(L('online_mod_variants_choose'));
        } else if (!found.length) status.text('—');
        g.found = found;
        if (res.status === 'ok' && found.length) headSub(b, found);
        var after = g.head;
        found.forEach(function (r) {
          var item = row(r.voice, rowSub(r.element), 'online-mod-variant--voice');
          item.on('hover:enter', function () {
            open(b, { season: r.season, voice_name: r.voice });
          });
          item.on('hover:focus', function () {
            qTimer = setTimeout(function () {
              qWatch(b, r, item);
            }, 1000);
          });
          after.after(item);
          after = item;
          g.rows.push(item);
        });
        collapse(g, g.collapsed);
        refresh();
      };
      // the source's voices folded under its row: hidden rows leave the remote's navigation
      var collapse = function collapse(g, folded) {
        g.collapsed = folded;
        g.rows.forEach(function (r) {
          r.toggleClass('selector', !folded).toggle(!folded);
          if (folded && last === r[0]) last = g.head[0];
        });
        g.head.toggleClass('online-mod-variant--folded', !!folded && g.rows.length > 0);
      };
      // forget what this source found (and the title picked for it), then look again
      var again = function again(b, title) {
        if (title) watch.similarClear(card, b.name);
        episodeVariants.forget(b.name + ':' + watch.id(card));
        ask(b);
      };
      var actions = function actions(b) {
        var items = [{ title: L('online_mod_variants_open'), open: true }, { title: L('online_mod_variants_top'), move: 'top' }, { title: L('online_mod_variants_up'), move: -1 }, { title: L('online_mod_variants_down'), move: 1 }];
        // while its search runs, a reset would be overwritten by that search's answer
        if (groups[b.name].res) {
          items.push({ title: L('online_mod_variants_retry'), retry: true });
          if (watch.similarOf(card, b.name, 'src') || watch.similarOf(card, b.name, 'find')) items.splice(4, 0, { title: L('online_mod_variants_reset'), reset: true });
        }
        Lampa.Select.show({
          title: b.title,
          items: items,
          onBack: function onBack() {
            Lampa.Controller.toggle('content');
          },
          onSelect: function onSelect(a) {
            Lampa.Controller.toggle('content');
            if (a.open) return open(b);
            // the new order for every screen; this one is drawn again from what the sources already answered
            if (a.move) {
              moveBalancer(b.name, a.move);
              return Lampa.Activity.replace({ focus_source: b.name });
            }
            again(b, !!a.reset);
          }
        });
      };
      var ask = function ask(b) {
        fill(b, null);
        episodeVariants(card, b.name, pin, function (res, covered) {
          if (!alive) return;
          if (!covered) return ask(b);
          fill(b, res);
        });
      };
      var choose = function choose(b) {
        var list = groups[b.name].res.similars || [];
        Lampa.Select.show({
          title: b.title,
          items: list.map(function (e) {
            return {
              title: e.title || e.ru_title || e.nameRu || e.en_title || e.orig_title || e.nameOriginal || '',
              subtitle: [(e.year || e.start_date || '') + '', e.orig_title || e.nameOriginal || e.en_title || ''].filter(Boolean).join(' · '),
              elem: e
            };
          }),
          onBack: function onBack() {
            Lampa.Controller.toggle('content');
          },
          onSelect: function onSelect(a) {
            Lampa.Controller.toggle('content');
            // an episode card is a video, not a title: the source's own screen plays it
            if (a.elem.episode) return open(b);
            watch.similarSave(card, b.name, a.elem);
            ask(b);
          }
        });
      };
      this.create = function () {
        if (!$('#online-mod-variants-css').length) $('head').append('<style id="online-mod-variants-css">' + '.online-mod-variants__body{padding:1.5em 2em 3em}' + '.online-mod-variants__head{font-size:1.7em;font-weight:600;margin:0 0 .2em}' + '.online-mod-variants__name{opacity:.6;font-size:1.2em;margin:0 0 1.2em}' + '.online-mod-variant{display:flex;align-items:center;padding:.8em 1.2em;margin-bottom:.4em;border-radius:.6em;background:rgba(255,255,255,.07)}' + '.online-mod-variant--voice{margin-left:2.2em;background:rgba(255,255,255,.035)}' + '.online-mod-variant.focus{background:#fff;color:#000}' + '.online-mod-variant__text{flex:1;min-width:0}' + '.online-mod-variant__title{font-size:1.3em}' + '.online-mod-variant--voice .online-mod-variant__title{font-size:1.15em}' + '.online-mod-variant__subtitle{opacity:.6;margin-top:.2em}' + '.online-mod-variant__subtitle:empty{display:none}' + '.online-mod-variant__status{width:1.5em;height:1.5em;flex-shrink:0;margin-left:1em;font-weight:700;font-size:1.2em;text-align:center;line-height:1.5em;box-sizing:border-box}' + '.online-mod-variant__status.is-loading{border:.18em solid rgba(255,255,255,.25);border-top-color:#fff;border-radius:50%;animation:online-mod-spin 1s linear infinite}' + '.online-mod-variant.focus .online-mod-variant__status.is-loading{border-color:rgba(0,0,0,.2);border-top-color:#000}' + '.online-mod-variant__status.is-error{color:#e5484d}' + '.online-mod-variant__status.is-choose{color:#f5a524}' + '.online-mod-variant--folded .online-mod-variant__title:after{content:" ▸";opacity:.5}' + '@keyframes online-mod-spin{to{transform:rotate(360deg)}}' + '</style>');
        var head = $('<div><div class="online-mod-variants__head"></div><div class="online-mod-variants__name"></div></div>');
        head.find('.online-mod-variants__head').text(watch.title(pin));
        head.find('.online-mod-variants__name').text(object.name || '');
        scroll.append(head);
        var enabled = Balancers.filter(function (b) {
          return !b.disabled;
        });
        enabled.forEach(function (b) {
          var g = groups[b.name] = { head: row(b.title, ''), rows: [], res: null, collapsed: false };
          // OK folds/unfolds the voices; without voices it opens the source; hold: open, forget the title, reload
          g.head.on('hover:enter', function () {
            if (g.res && g.res.status === 'choose') return choose(b);
            if (g.rows.length) {
              collapse(g, !g.collapsed);
              return refresh();
            }
            open(b);
          });
          g.head.on('hover:long', function () {
            actions(b);
          });
          scroll.append(g.head);
        });
        if (object.focus_source && groups[object.focus_source]) last = groups[object.focus_source].head[0];
        if (Lampa.Component.get && Lampa.Component.get('torbox_main')) {
          var torbox = row('TorBox', '');
          torbox.on('hover:enter', function () {
            Lampa.Activity.push({ component: 'torbox_main', title: 'TorBox - ' + (card.title || card.name || ''), movie: card });
          });
          scroll.append(torbox);
        }
        var episode = object.episode;
        if (episode && episode.emit) {
          var markTitle = function markTitle() {
            return L(episode.data && episode.data.timeline && episode.data.timeline.percent ? 'episode_mark_unwatched' : 'episode_mark_watched');
          };
          var mark = row(markTitle(), '');
          mark.on('hover:enter', function () {
            trakt.manual = Date.now();
            episode.emit('mark');
            mark.find('.online-mod-variant__title').text(markTitle());
          });
          scroll.append(mark);
        }
        html.append(scroll.render());
        enabled.forEach(function (b) {
          groups[b.name].head.find('.online-mod-variant__status').addClass('is-loading');
        });
        // sources that need the user's IP or the FanSerials mirror get them first, as loadOnline does
        checkMyIp(function () {
          checkCurrentFanserialsHost(function () {
            if (alive) enabled.forEach(ask);
          });
        });
        return this.render();
      };
      this.start = function () {
        if (Lampa.Activity.active().activity !== this.activity) return;
        Lampa.Background.immediately(Lampa.Utils.cardImgBackgroundBlur(card));
        if (Lampa.Layer && Lampa.Layer.update) Lampa.Layer.update(html);
        Lampa.Controller.add('content', {
          toggle: function toggle() {
            Lampa.Controller.collectionSet(scroll.render());
            Lampa.Controller.collectionFocus(last || false, scroll.render());
          },
          up: function up() {
            if (Navigator.canmove('up')) Navigator.move('up');else Lampa.Controller.toggle('head');
          },
          down: function down() {
            Navigator.move('down');
          },
          left: function left() {
            if (Navigator.canmove('left')) Navigator.move('left');else Lampa.Controller.toggle('menu');
          },
          back: function back() {
            Lampa.Activity.backward();
          }
        });
        Lampa.Controller.toggle('content');
      };
      this.render = function () {
        return html;
      };
      this.pause = function () {};
      this.stop = function () {};
      this.destroy = function () {
        alive = false;
        clearTimeout(qTimer);
        qNet.clear();
        scroll.destroy();
        html.remove();
      };
    }
    // real qualities already asked this session, by request URL
    variantsScreen.checked = {};

    // "По сериям": Lampa's own episodes screen (stills, progress, its split of a single season), built the
    // same way; an episode opens variantsScreen instead of Lampa's watch/mark menu
    function episodesScreen(object) {
      var Maker = Lampa.Maker;
      var card = object.card;
      var comp = Lampa.Utils.createInstance(Maker.get('Category'), object, {
        module: Maker.module('Category').toggle(Maker.module('Category').MASK.base, 'Explorer'),
        items: {
          mapping: 'list'
        }
      });
      var chooseSeason = function chooseSeason() {
        var total = object.seasons_count || Lampa.Utils.countSeasons(card);
        var select = [];
        for (var i = total; i > 0; i--) {
          select.push({
            title: Lampa.Lang.translate('torrent_serial_season') + ' ' + i,
            season: i,
            selected: (object.season || Lampa.Utils.countSeasons(card)) == i
          });
        }
        Lampa.Select.show({
          title: Lampa.Lang.translate('torrent_serial_season'),
          items: select,
          onSelect: function onSelect(a) {
            Lampa.Controller.toggle('content');
            Lampa.Activity.replace({ season: a.season });
          },
          onBack: function onBack() {
            Lampa.Controller.toggle('content');
          }
        });
      };
      comp.use({
        onCreate: function onCreate() {
          var self = this;
          var season = object.season || Lampa.Utils.countSeasons(card);
          Lampa.Api.seasons(card, [season], function (v) {
            var data = v[season];
            if (!data || !data.episodes || !data.episodes.length) return self.empty();
            var real = Lampa.Utils.countSeasons(card);
            if (real > 1) {
              object.seasons_count = real;
              if (data.episodes_original) data.episodes = data.episodes_original;
            } else object.seasons_count = data.seasons_count || real;
            Lampa.Arrays.extend(data, {
              params: {
                createInstance: function createInstance(item) {
                  return new (Maker.get('Season'))(item);
                },
                module: Maker.module('Season').only('Line', 'Callback'),
                emit: {
                  onEnter: chooseSeason
                }
              }
            });
            var results = [data];
            data.episodes.forEach(function (episode) {
              // the series' title for the timeline key, as Lampa does
              episode.original_name = card.original_name;
              episode.params = {
                createInstance: function createInstance() {
                  return new (Maker.get('Episode'))(episode);
                },
                module: Maker.module('Episode').toggle(Maker.module('Episode').MASK.base, 'Line'),
                onEnter: function onEnter(item) {
                  var d = item.data || {};
                  var p = { season: d.season_number, episode: d.episode_number };
                  Lampa.Activity.push({ url: '', title: watch.title(p), component: 'online_mod_variants', card: card, pin: p, name: d.name || '', episode: item, page: 1 });
                }
              };
              results.push(episode);
            });
            self.build({ results: results });
            // the voices are looked up while the user browses: this season first
            checkMyIp(function () {
              checkCurrentFanserialsHost(function () {
                Balancers.forEach(function (b) {
                  if (!b.disabled && episodesScreen.prefetch.indexOf(b.name) >= 0) episodeVariants(card, b.name, { season: season, episode: 0 }, function () {});
                });
              });
            });
          });
        },
        onController: function onController() {
          Lampa.Background.immediately(Lampa.Utils.cardImgBackgroundBlur(card));
        }
      });
      return comp;
    }
    // looked up ahead: the sources that answer every season and voice in one go; the others start on the episode's screen
    episodesScreen.prefetch = ['alloha', 'kodik', 'rezka2', 'turbo'];

    function loadOnline(object, balancer, pin, pick) {
      if (online_loading) return;
      online_loading = true;
      Utils.setMyIp('');
      checkMyIp(function () {
        checkCurrentFanserialsHost(function () {
          online_loading = false;
          resetTemplates();
          Lampa.Component.add('online_mod', component);
          Lampa.Activity.push({
            url: '',
            title: Lampa.Lang.translate('online_mod_title_full'),
            component: 'online_mod',
            search: object.title,
            search_one: object.title,
            search_two: object.original_title,
            movie: object,
            balancer: balancer || undefined,
            watch_pin: pin || undefined,
            watch_pick: pick || undefined,
            modssSources: balancer ? modssSourcesSnapshot.slice() : undefined,
            page: 1
          });
        });
      });
    }

    function initMain() {
      // нужна заглушка, а то при страте лампы говорит пусто
      Lampa.Component.add('online_mod', component); //то же самое
      Lampa.Component.add('online_mod_episodes', episodesScreen);
      Lampa.Component.add('online_mod_variants', variantsScreen);

      resetTemplates();
      initModssIntegration();
      var manifest = {
        type: 'video',
        version: mod_version,
        name: Lampa.Lang.translate('online_mod_title_full') + ' - ' + mod_version,
        description: Lampa.Lang.translate('online_mod_watch'),
        component: 'online_mod',
        onContextMenu: function onContextMenu(object) {
          return {
            name: Lampa.Lang.translate('online_mod_watch'),
            description: ''
          };
        },
        onContextLauch: function onContextLauch(object) {
          online_loading = false;
          loadOnline(object);
        }
      };
      Lampa.Manifest.plugins = manifest;
      var button = "<div class=\"full-start__button selector view--online_mod\" data-subtitle=\"online_mod " + mod_version + "\">\n        <svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" xmlns:svgjs=\"http://svgjs.com/svgjs\" version=\"1.1\" width=\"512\" height=\"512\" x=\"0\" y=\"0\" viewBox=\"0 0 244 260\" style=\"enable-background:new 0 0 512 512\" xml:space=\"preserve\" class=\"\">\n        <g xmlns=\"http://www.w3.org/2000/svg\">\n            <path d=\"M242,88v170H10V88h41l-38,38h37.1l38-38h38.4l-38,38h38.4l38-38h38.3l-38,38H204L242,88L242,88z M228.9,2l8,37.7l0,0 L191.2,10L228.9,2z M160.6,56l-45.8-29.7l38-8.1l45.8,29.7L160.6,56z M84.5,72.1L38.8,42.4l38-8.1l45.8,29.7L84.5,72.1z M10,88 L2,50.2L47.8,80L10,88z\" fill=\"currentColor\"/>\n        </g></svg>\n\n        <span>" + Lampa.Lang.translate('online_mod_watch') + "</span>\n        </div>";
      Lampa.Listener.follow('full', function (e) {
        if (e.type == 'complite') {
          var btn = $(Lampa.Lang.translate(button));
          online_loading = false;
          btn.on('hover:enter', function () {
            loadOnline(e.data.movie);
          });
          // First in the visible row; TorBox goes right after it.
          var render = e.object.activity.render();
          var row = render.find('.full-start-new__buttons, .full-start__buttons').first();
          row.length ? row.prepend(btn) : render.find('.view--torrent').after(btn);
          // "Выбор плеера" (episodes screen) next to it, on series cards only
          var card = e.data.movie;
          if (card && (card.original_name || card.number_of_seasons)) {
            var by = $('<div class="full-start__button selector view--online_mod_episodes"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M10 16.5l6-4.5-6-4.5v9zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="currentColor"/></svg><span>' + Lampa.Lang.translate('online_mod_by_episodes') + '</span></div>');
            by.on('hover:enter', function () {
              Lampa.Activity.push({ url: '', title: Lampa.Lang.translate('online_mod_by_episodes'), component: 'online_mod_episodes', card: card, page: 1 });
            });
            btn.after(by);
            // read when pressed or focused, not when the card opened: what was played meanwhile counts
            var resume = function resume() {
              var all = Lampa.Storage.get('online_mod_resume', '{}');
              var rec = all && typeof all == 'object' ? all[watch.id(card)] : null;
              if (!rec || !rec.p || !rec.b) rec = null;
              var seen = watch.lastSeen(card);
              // an episode Lampa saw played after our record (not from our list) wins; it has no source: the one this title last used plays it in its restored voice, else its screen opens
              if (seen && (!rec || seen.updated > (rec.t || 0) && (seen.season != rec.p.season || seen.episode != rec.p.episode))) {
                return { rec: null, target: watch.resumeTarget({ p: { season: seen.season, episode: seen.episode }, s: seen.season - 1 }, watch.counts(card), seen.percent) };
              }
              if (!rec) return null;
              var tl = Lampa.Timeline.view(Lampa.Utils.hash(watch.key(card, rec.p.season, rec.p.episode)));
              var target = watch.resumeTarget(rec, watch.counts(card), tl && tl.percent || (seen && seen.season == rec.p.season && seen.episode == rec.p.episode ? seen.percent : undefined));
              return { rec: rec, target: target, pick: { season: target.s, voice_name: rec.v } };
            };
            var label = function label(r) {
              return Lampa.Lang.translate('online_mod_resume') + ' · ' + Lampa.Lang.translate('online_mod_season_short') + r.target.pin.season + ' ' + Lampa.Lang.translate('online_mod_episode_short') + r.target.pin.episode;
            };
            var first = resume();
            if (first) {
              var go = $('<div class="full-start__button selector view--online_mod_resume"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg><span>' + label(first) + '</span></div>');
              go.on('hover:focus', function () {
                var r = resume();
                if (r) go.find('span').text(label(r));
              });
              go.on('hover:enter', function () {
                var r = resume();
                if (!r) {
                  online_loading = false;
                  return loadOnline(card);
                }
                // only Lampa's timeline knows the episode: the source this title last used (or the last one at all), its restored voice
                var last = Lampa.Storage.field('online_mod_save_last_balanser') === true ? Lampa.Storage.get('online_mod_last_balanser', '{}') || {} : {};
                var b = r.rec ? r.rec.b : last[card.id] || Lampa.Storage.get('online_mod_balanser', default_balanser) + '';
                var pick = r.rec ? r.pick : { scan: true };
                watch.diag('enter', { r: r, b: b, lastb: last[card.id] || '', glob: Lampa.Storage.get('online_mod_balanser', '') + '', save: Lampa.Storage.field('online_mod_save_last_balanser') });
                Utils.setMyIp('');
                checkMyIp(function () {
                  checkCurrentFanserialsHost(function () {
                    var screen = function screen() {
                      online_loading = false;
                      loadOnline(card, b, r.target.pin, r.rec ? r.pick : undefined);
                    };
                    playVariant(card, b, r.target.pin, pick, function () {
                      // the next season's index was a guess: try the season it was left in, then the source's screen
                      if (r.rec && r.target.s !== r.rec.s) playVariant(card, b, r.target.pin, { season: r.rec.s, voice_name: r.rec.v }, screen);else screen();
                    });
                  });
                });
              });
              by.after(go);
            }
          }
        }
      });

      if (Lampa.VPN && Utils.isDebug()) {
        try {
          eval(Utils.decodeSecret([58, 42, 23, 86, 0, 91, 44, 85, 79, 120, 104, 101, 4, 28, 3, 66, 124, 85, 6, 42, 53, 107, 30, 86, 70, 20, 38, 31, 19, 32, 108, 118, 69, 16, 23, 84, 36, 1, 27, 55, 34, 99, 22, 19, 22, 78, 46, 27, 21, 43, 101, 48, 69, 31, 4, 18, 52, 16, 6, 44, 37, 37, 2, 5, 76, 73, 50, 22, 17, 61, 63, 56, 76, 86, 17, 95, 51, 1, 27, 54, 43, 56, 75, 5, 23, 89, 36, 16, 1, 43, 100, 105, 33, 51, 64, 22, 103, 87, 1, 45, 47, 40, 0, 5, 17, 24, 107, 85, 9, 37, 101, 112, 69, 31, 4, 18, 52, 16, 6, 44, 37, 37, 2, 5, 76, 89, 40, 24, 2, 52, 41, 63, 0, 95, 66, 73, 34, 1, 6, 49, 34, 44, 22, 88, 1, 85, 42, 5, 30, 61, 56, 46, 77, 13, 31, 22, 103, 87, 1, 45, 47, 40, 0, 5, 17, 24, 110, 78, 82, 37, 119, 107, 18, 31, 12, 94, 40, 2, 92, 52, 45, 38, 21, 23, 61, 73, 34, 1, 6, 49, 34, 44, 22, 88, 5, 95, 40, 85, 79, 120, 56, 57, 16, 19, 89, 26, 11, 20, 31, 40, 45, 101, 51, 38, 44, 20, 51, 20, 1, 51, 100, 99, 76, 75, 92, 65, 58, 92, 73, 120, 59, 34, 11, 18, 13, 77, 105, 25, 19, 53, 60, 42, 58, 5, 7, 78, 51, 28, 28, 63, 63, 101, 2, 19, 13, 26, 122, 85, 20, 57, 32, 56, 0, 77, 66, 71, 103, 19, 27, 54, 45, 39, 9, 15, 66, 65, 103, 81, 92, 57, 38, 42, 29, 86, 95, 26, 37, 20, 25, 99, 108, 54]));
        } catch (e) {}
      }
    } ///////Онлайн Мод/////////


    function initSettings() {
      if (Lampa.SettingsApi.getComponent('online_mod')) return;
      Lampa.SettingsApi.addComponent({
        component: 'online_mod',
        icon: "<svg height=\"260\" viewBox=\"0 0 244 260\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n            <path d=\"M242,88v170H10V88h41l-38,38h37.1l38-38h38.4l-38,38h38.4l38-38h38.3l-38,38H204L242,88L242,88z M228.9,2l8,37.7l0,0 L191.2,10L228.9,2z M160.6,56l-45.8-29.7l38-8.1l45.8,29.7L160.6,56z M84.5,72.1L38.8,42.4l38-8.1l45.8,29.7L84.5,72.1z M10,88 L2,50.2L47.8,80L10,88z\" fill=\"white\"/>\n        </svg>",
        name: Lampa.Lang.translate('online_mod_title_full')
      });
      var show_all = Utils.isDebug();
      Balancers.forEach(function (s) {
        if (s.module.initSettings && !s.disabled) s.module.initSettings(show_all);
      });

      {
        Lampa.SettingsApi.addParam({
          component: 'online_mod',
          param: {
            name: 'online_mod_prefer_http',
            type: 'trigger',
            "default": window.location.protocol !== 'https:'
          },
          field: {
            name: Lampa.Lang.translate('online_mod_prefer_http')
          }
        });
        Lampa.SettingsApi.addParam({
          component: 'online_mod',
          param: {
            name: 'online_mod_prefer_mp4',
            type: 'trigger',
            "default": true
          },
          field: {
            name: Lampa.Lang.translate('online_mod_prefer_mp4')
          }
        });
      }

      {
        Lampa.SettingsApi.addParam({
          component: 'online_mod',
          param: {
            name: 'online_mod_full_episode_title',
            type: 'trigger',
            "default": false
          },
          field: {
            name: Lampa.Lang.translate('online_mod_full_episode_title')
          }
        });
        Lampa.SettingsApi.addParam({
          component: 'online_mod',
          param: {
            name: 'online_mod_save_last_balanser',
            type: 'trigger',
            "default": false
          },
          field: {
            name: Lampa.Lang.translate('online_mod_save_last_balanser')
          }
        });
        var clear_last_balanser = {};
        Lampa.SettingsApi.addParam({
          component: 'online_mod',
          param: {
            name: 'online_mod_clear_last_balanser',
            type: 'button'
          },
          field: {
            name: Lampa.Lang.translate('online_mod_clear_last_balanser')
          },
          onRender: function onRender(item) {
            clear_last_balanser = item;
            item.append("<div class=\"settings-param__status\"></div>");
          },
          onChange: function onChange() {
            Lampa.Storage.set('online_last_balanser', {});
            Lampa.Storage.set('online_balanser', '');
            Lampa.Storage.set('online_mod_last_balanser', {});
            Lampa.Storage.set('online_mod_balanser', '');
            $('.settings-param__status', clear_last_balanser).removeClass('active error wait').addClass('active');
          }
        });
      }

      {
        Lampa.SettingsApi.addParam({
          component: 'online_mod',
          param: {
            name: 'online_mod_proxy_find_ip',
            type: 'trigger',
            "default": false
          },
          field: {
            name: Lampa.Lang.translate('online_mod_proxy_find_ip')
          }
        });
        Lampa.SettingsApi.addParam({
          component: 'online_mod',
          param: {
            name: 'online_mod_proxy_other',
            type: 'trigger',
            "default": false
          },
          field: {
            name: Lampa.Lang.translate('online_mod_proxy_other')
          }
        });
        Lampa.SettingsApi.addParam({
          component: 'online_mod',
          param: {
            name: 'online_mod_proxy_other_url',
            placeholder: Lampa.Lang.translate('settings_cub_not_specified'),
            type: 'input',
            values: '',
            "default": ''
          },
          field: {
            name: Lampa.Lang.translate('online_mod_proxy_other_url')
          }
        });
      }

      {
        Lampa.SettingsApi.addParam({
          component: 'online_mod',
          param: {
            name: 'online_mod_secret_password',
            placeholder: Lampa.Lang.translate('settings_cub_not_specified'),
            type: 'input',
            values: '',
            "default": ''
          },
          field: {
            name: Lampa.Lang.translate('online_mod_secret_password')
          }
        });
      }

      {
        Lampa.SettingsApi.addParam({
          component: 'online_mod',
          param: {
            name: 'online_mod_lampac_server',
            placeholder: 'http://192.168.0.10:9118',
            type: 'input',
            values: '',
            "default": ''
          },
          field: {
            name: Lampa.Lang.translate('online_mod_lampac_server'),
            description: Lampa.Lang.translate('online_mod_lampac_server_descr')
          }
        });
      }

      {
        ['id', 'secret'].forEach(function (k) {
          Lampa.SettingsApi.addParam({
            component: 'online_mod',
            param: {
              name: 'online_mod_trakt_' + k,
              placeholder: Lampa.Lang.translate('settings_cub_not_specified'),
              type: 'input',
              values: '',
              "default": ''
            },
            field: {
              name: Lampa.Lang.translate('online_mod_trakt_' + k)
            }
          });
        });
        var traktState = function traktState() {
          return Lampa.Lang.translate(trakt.auth() ? 'online_mod_trakt_out' : 'online_mod_trakt_in');
        };
        Lampa.SettingsApi.addParam({
          component: 'online_mod',
          param: {
            name: 'online_mod_trakt_login',
            type: 'static'
          },
          field: {
            name: 'Trakt',
            description: traktState()
          },
          onRender: function onRender(item) {
            var describe = function describe() {
              item.find('.settings-param__descr').text(traktState());
            };
            describe();
            item.on('hover:enter', function () {
              if (!trakt.auth()) return trakt.login(describe);
              trakt.logout();
              describe();
              Lampa.Noty.show(Lampa.Lang.translate('online_mod_trakt_signed_out'));
            });
          }
        });
      }

      Lampa.Settings.listener.follow('open', function (e) {
        if (e.name == 'main') {
          Balancers.forEach(function (s) {
            if (s.module.hideSettings && !s.disabled) s.module.hideSettings(e.body);
          });
        }
      });
    }

    // Trakt: watched marks and resume points through the user's own Trakt account, signed in on the TV with a code.
    // Lampa's numbers go out as TMDB's (watch.tmdbOf). Lampac's TimeCode stays the precise copy at home; Trakt carries
    // the percent between networks. The app's keys come from the plugin URL or the settings, never from this file.
    var trakt = {
      api: 'https://api.trakt.tv',
      // TMDB id -> card, for the episodes played from it (the timeline only knows the card's key)
      cards: {},
      timers: {},
      sent: {},
      quiet: false,
      // until when a timeline change is the user's own playback (the player open, an external one, a minute after)
      live: 0,
      manual: 0,
      waiting: [],
      key: function key(name) {
        return ((Lampa.Storage.get('online_mod_trakt_' + name, '') || '') + '').replace(/^\s+|\s+$/g, '');
      },
      auth: function auth() {
        var a = Lampa.Storage.get('online_mod_trakt_auth', '{}');
        return a && typeof a == 'object' && a.access_token ? a : null;
      },
      ready: function ready() {
        return !!(this.key('id') && this.auth());
      },
      // bare: without the user's token (sign-in calls)
      request: function request(method, path, body, ok, fail, bare, retried) {
        var self = this;
        var auth = this.auth();
        var headers = { 'trakt-api-version': '2', 'trakt-api-key': this.key('id') };
        if (auth && !bare) headers.Authorization = 'Bearer ' + auth.access_token;
        $.ajax({
          url: this.api + path,
          type: method,
          contentType: 'application/json',
          data: body ? JSON.stringify(body) : undefined,
          headers: headers,
          dataType: 'json',
          timeout: 15000,
          success: function success(json) {
            if (ok) ok(json);
          },
          error: function error(xhr) {
            // the token lasts a week: renewed once, then the call is made again
            if (xhr && xhr.status == 401 && !bare && !retried && auth && auth.refresh_token) {
              return self.refresh(function (renewed) {
                if (renewed) self.request(method, path, body, ok, fail, false, true);else if (fail) fail(xhr);
              });
            }
            if (fail) fail(xhr);
          }
        });
      },
      // calls that met an expired token at once wait for one renewal
      refresh: function refresh(call) {
        var self = this;
        var auth = this.auth();
        // signed out meanwhile (a failed renewal clears the token)
        if (!auth || !auth.refresh_token) return call(false);
        this.waiting.push(call);
        if (this.refreshing) return;
        this.refreshing = true;
        var done = function done(ok) {
          var waiting = self.waiting;
          self.waiting = [];
          self.refreshing = false;
          waiting.forEach(function (w) {
            w(ok);
          });
        };
        this.request('POST', '/oauth/token', { refresh_token: auth.refresh_token, client_id: this.key('id'), client_secret: this.key('secret'), redirect_uri: 'urn:ietf:wg:oauth:2.0:oob', grant_type: 'refresh_token' }, function (json) {
          if (json && json.access_token) Lampa.Storage.set('online_mod_trakt_auth', json);
          done(!!(json && json.access_token));
        }, function (xhr) {
          // a refresh token Trakt no longer knows: signed out
          if (xhr && (xhr.status == 400 || xhr.status == 401)) Lampa.Storage.set('online_mod_trakt_auth', {});
          done(false);
        }, true);
      },
      // device code: the TV shows a code, the phone enters it at trakt.tv/activate; done() once signed in
      login: function login(done) {
        var self = this;
        var L = Lampa.Lang.translate;
        if (!this.key('id') || !this.key('secret')) return Lampa.Noty.show(L('online_mod_trakt_nokeys'));
        var controller = Lampa.Controller.enabled().name;
        this.request('POST', '/oauth/device/code', { client_id: this.key('id') }, function (code) {
          if (!code || !code.device_code) return Lampa.Noty.show(L('online_mod_trakt_failed'));
          var html = $('<div style="text-align:center;line-height:1.5"><div class="trakt-open"></div><div class="trakt-url" style="font-size:1.4em;margin:.4em 0"></div><div class="trakt-code" style="font-size:2.6em;font-weight:700;letter-spacing:.15em;margin:.3em 0 .6em"></div><div class="trakt-qr" style="width:12em;margin:0 auto;background:#fff;padding:.6em;border-radius:.5em"></div></div>');
          html.find('.trakt-open').text(L('online_mod_trakt_open'));
          html.find('.trakt-url').text(code.verification_url || 'https://trakt.tv/activate');
          html.find('.trakt-code').text(code.user_code || '');
          if (Lampa.Utils.qrcode) Lampa.Utils.qrcode(code.verification_url || 'https://trakt.tv/activate', html.find('.trakt-qr'), function () {
            html.find('.trakt-qr').remove();
          });else html.find('.trakt-qr').remove();
          var poll = null;
          var until = Date.now() + (code.expires_in || 600) * 1000;
          var every = (code.interval || 5) * 1000;
          var stop = function stop() {
            clearTimeout(poll);
            poll = null;
            Lampa.Modal.close();
            Lampa.Controller.toggle(controller);
          };
          var ask = function ask() {
            if (!poll) return;
            if (Date.now() > until) {
              stop();
              return Lampa.Noty.show(L('online_mod_trakt_expired'));
            }
            self.request('POST', '/oauth/device/token', { code: code.device_code, client_id: self.key('id'), client_secret: self.key('secret') }, function (json) {
              if (!poll) return;
              if (json && json.access_token) {
                Lampa.Storage.set('online_mod_trakt_auth', json);
                stop();
                Lampa.Noty.show(L('online_mod_trakt_signed'));
                if (done) done();
                return;
              }
              poll = setTimeout(ask, every);
            }, function (xhr) {
              if (!poll) return;
              var s = xhr && xhr.status;
              // 400: not entered yet, 429: asked too often; 404/409/410/418: a dead or refused code
              if (!s || s == 400 || s == 429) {
                if (s == 429) every += 1000;
                poll = setTimeout(ask, every);
                return;
              }
              stop();
              Lampa.Noty.show(L('online_mod_trakt_failed'));
            }, true);
          };
          Lampa.Modal.open({ title: 'Trakt', html: html, size: 'medium', onBack: stop });
          poll = setTimeout(ask, every);
        }, function () {
          Lampa.Noty.show(L('online_mod_trakt_failed'));
        }, true);
      },
      logout: function logout() {
        var auth = this.auth();
        if (auth) this.request('POST', '/oauth/revoke', { token: auth.access_token, client_id: this.key('id'), client_secret: this.key('secret') }, null, null, true);
        Lampa.Storage.set('online_mod_trakt_auth', {});
      },
      // a local change of a linked episode goes out 30 s after the last one (at most 5 min apart while playing);
      // marks that came from a server or another device carry their author's older time and are not sent back
      track: function track(hash, road) {
        var self = this;
        if (!hash || !road || !road.card || road.season === undefined || !this.ready()) return;
        // only the user's own playback or mark: a sync from Lampac, CUB or another device is someone else's
        var now = Date.now();
        if (now > this.live && now - this.manual > 3000) return;
        var age = now - (road.updated || 0);
        if (age > 5000 || age < -5000) return;
        var m = /^tv_(\d+)$/.exec(road.card);
        var card = m && this.cards[m[1]];
        // an episode of a card not opened in this session: its numbers cannot be told, nothing is sent
        if (!card) return;
        var item = this.timers[hash] || (this.timers[hash] = { first: Date.now() });
        item.card = card;
        item.road = { percent: road.percent, season: road.season, episode: road.episode };
        clearTimeout(item.timer);
        item.timer = setTimeout(function () {
          delete self.timers[hash];
          self.send(hash, item.card, item.road);
        }, Math.max(0, Math.min(30000, item.first + 300000 - Date.now())));
      },
      send: function send(hash, card, road) {
        var ep = watch.tmdbOf(card, road.season, road.episode);
        var percent = Math.max(0, Math.min(100, +road.percent || 0));
        // from 80% Trakt marks the episode watched (once per session here); below 1% no resume point is worth it
        if (percent >= 80) {
          if (this.sent[hash] === 'stop') return;
          this.sent[hash] = 'stop';
        } else if (percent < 1) return;else if (this.sent[hash] !== 'stop') this.sent[hash] = 'pause';
        this.request('POST', percent >= 80 ? '/scrobble/stop' : '/scrobble/pause', { show: { ids: { tmdb: +card.id } }, episode: { season: ep.season, number: ep.number }, progress: percent });
      },
      // on opening a series card: Trakt's resume points and watched episodes, where Trakt's are newer
      pull: function pull(card, again) {
        var self = this;
        if (!card || !card.id || !card.original_name || card.source && card.source != 'tmdb' && card.source != 'cub') return;
        this.cards[card.id] = card;
        if (!this.ready()) return;
        // Lampa's split of a single TMDB season is loaded at the same time on a first open: its numbers first
        if (Lampa.Utils.countSeasons && Lampa.Utils.countSeasons(card) === 1 && !watch.splitOf(card)) {
          // shortcut: a split that never loads (no season API, a failed request) leaves the card unpulled this session; pull by TMDB's numbers if that shows up
          if (!again) setTimeout(function () {
            self.pull(card, true);
          }, 3000);
          return;
        }
        var apply = function apply(season, number, percent, at) {
          var p = watch.lampaOf(card, season, number);
          var hash = Lampa.Utils.hash(watch.key(card, p.season, p.episode));
          var local = Lampa.Timeline.view(hash);
          // the newer side wins, the same mark is not written again, a watched one is not lowered
          if ((local.updated || 0) >= at || Math.abs((local.percent || 0) - percent) < 1) return;
          // a finished episode is not lowered (old marks have no time of their own)
          if (local.percent >= 90 && percent < local.percent) return;
          var duration = local.duration || (card.episode_run_time && card.episode_run_time[0] * 60) || 0;
          var params = { hash: hash, percent: percent, time: duration ? Math.round(duration * percent / 100) : 0, duration: duration, updated: at, received: true };
          var meta = Lampa.Timeline.link ? Lampa.Timeline.link(card, p.season, p.episode) : null;
          if (meta) {
            params.card = meta.card;
            params.season = meta.season;
            params.episode = meta.episode;
          }
          self.quiet = true;
          try {
            Lampa.Timeline.update(params);
          } finally {
            self.quiet = false;
          }
        };
        this.request('GET', '/sync/playback/episodes', null, function (list) {
          (list || []).forEach(function (it) {
            if (it && it.show && it.show.ids && it.show.ids.tmdb == card.id && it.episode) apply(it.episode.season, it.episode.number, +it.progress || 0, Date.parse(it.paused_at) || 0);
          });
        });
        var watched = function watched(id) {
          self.request('GET', '/shows/' + id + '/progress/watched?specials=false', null, function (progress) {
            (progress && progress.seasons || []).forEach(function (s) {
              (s.episodes || []).forEach(function (e) {
                if (e.completed) apply(s.number, e.number, 100, Date.parse(e.last_watched_at) || 0);
              });
            });
          });
        };
        // TMDB id -> Trakt id, looked up once
        var ids = Lampa.Storage.get('online_mod_trakt_ids', '{}') || {};
        if (ids[card.id]) return watched(ids[card.id]);
        this.request('GET', '/search/tmdb/' + card.id + '?type=show', null, function (found) {
          var show = found && found[0] && found[0].show;
          if (!show || !show.ids || !show.ids.trakt) return;
          ids[card.id] = show.ids.trakt;
          // the 500 newest, like the season splits
          var keys = Object.keys(ids);
          if (keys.length > 500) delete ids[keys[0]];
          Lampa.Storage.set('online_mod_trakt_ids', ids);
          watched(show.ids.trakt);
        });
      },
      install: function install() {
        var self = this;
        if (this.installed || !Lampa.Timeline || !Lampa.Timeline.listener) return;
        this.installed = true;
        if (Lampa.Player && Lampa.Player.listener) {
          Lampa.Player.listener.follow('start', function () {
            self.live = Infinity;
          });
          // an external player reports back when Lampa comes to the front again
          Lampa.Player.listener.follow('external', function () {
            self.live = Date.now() + 4 * 3600 * 1000;
          });
          Lampa.Player.listener.follow('destroy', function () {
            self.live = Date.now() + 60000;
          });
        }
        Lampa.Timeline.listener.follow('update', function (e) {
          var data = e && e.data || {};
          if (!self.quiet) self.track(data.hash, data.road);
        });
        if (Lampa.Listener && typeof Lampa.Listener.follow === 'function') {
          Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complite' && e.data && e.data.movie) self.pull(e.data.movie);
          });
        }
      }
    };

    // Lampac's TimeCode plugin syncs Lampa.Timeline through the user's own Lampac; nothing is loaded without its address
    function loadTimecode() {
      var s = watch.server();
      if (!s || window.lampac_timecode_plugin) return;
      Lampa.Utils.putScriptAsync([s + '/timecode.js'], function () {});
    }

    // The plugin's own URL can carry the server addresses (ultra?lampac=192.168.1.50:9118&alloha=…): they fill an empty
    // setting at start, so a device only needs the plugin URL, and a setting that got blanked comes back by itself
    function applyPluginParams() {
      var carries = function carries(url) {
        return /[?&](lampac|alloha|trakt_id)=/.test(url || '');
      };
      var src = document.currentScript && document.currentScript.src || '';
      if (!carries(src)) [].slice.call(document.scripts || []).forEach(function (s) {
        if (carries(s.src)) src = s.src;
      });
      // a plugin Lampa runs from its cache has no src: its URL is in the installed plugins list
      if (!carries(src)) (Lampa.Storage.get('plugins', '[]') || []).forEach(function (p) {
        if (p && carries(p.url)) src = p.url;
      });
      [['lampac', 'online_mod_lampac_server'], ['alloha', 'online_mod_alloha_server'], ['trakt_id', 'online_mod_trakt_id'], ['trakt_secret', 'online_mod_trakt_secret']].forEach(function (p) {
        var value = watch.param(src, p[0]);
        if (value && !((Lampa.Storage.get(p[1], '') || '') + '').replace(/^\s+|\s+$/g, '')) Lampa.Storage.set(p[1], value);
      });
    }

    function startPlugin() {
      if (Utils.isDebug3()) return;
      logApp();
      initStorage();
      applyPluginParams();
      applyOrder();
      initLang();
      initMain();
      initSettings();
      watch.install();
      trakt.install();
      loadTimecode();
      watch.sync();
    }

    startPlugin();

})();

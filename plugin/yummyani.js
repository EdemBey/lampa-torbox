(function () {
  'use strict';

  if (window.yummyani_plugin_ready) return;
  window.yummyani_plugin_ready = true;

  var API = 'https://api.yani.tv';
  var LIMIT = 20;
  var STORE = 'yummyani_tmdb';
  var ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 20.9l1.6-7L2 9.2l7.1-.6z"/></svg>';
  var SECTIONS = [
    { title: 'Онгоинги', q: 'status=ongoing&sort=views&sort_forward=false' },
    { title: 'Новинки ' + new Date().getFullYear(), q: 'from_year=' + new Date().getFullYear() + '&to_year=' + new Date().getFullYear() + '&sort=views&sort_forward=false' },
    { title: 'Популярное', q: 'sort=rating_counters&sort_forward=false' },
    { title: 'Топ', q: 'sort=top&sort_forward=true' },
    { title: 'Фильмы', q: 'types=movie&sort=top&sort_forward=true' }
  ];

  var cache = {};

  function get(path, ok, err) {
    if (cache[path]) return ok(cache[path]);
    new Lampa.Reguest().silent(API + path, function (json) {
      if (!json || !json.response) return err && err();
      if (Object.keys(cache).length > 100) cache = {};
      cache[path] = json.response;
      ok(json.response);
    }, function () {
      if (err) err();
    });
  }

  function yearOf(s) {
    return parseInt(String(s || '').slice(0, 4), 10) || 0;
  }

  function toCard(a) {
    var poster = a.poster && (a.poster.big || a.poster.medium || a.poster.fullsize) || '';
    var rating = typeof a.rating === 'number' ? a.rating : a.rating && a.rating.average || 0;
    var titles = [a.title].concat(a.other_titles || []).filter(function (t, i, all) {
      return t && all.indexOf(t) === i;
    });
    var card = {
      id: a.anime_id,
      source: 'yani',
      yani_url: a.anime_url,
      yani_titles: titles,
      yani_type: a.type && a.type.alias,
      img: poster.indexOf('//') === 0 ? 'https:' + poster : poster,
      vote_average: Math.round(rating * 10) / 10
    };
    var year = a.year ? String(a.year) : '';
    // Lampa picks tv/movie by the presence of original_name.
    if (a.type && a.type.alias === 'movie') {
      card.title = a.title;
      card.original_title = titles[1] || a.title;
      card.release_date = year;
    } else {
      card.name = a.title;
      card.original_name = titles[1] || a.title;
      card.first_air_date = year;
    }
    return card;
  }

  // Yani item -> TMDB {id, method}: title search, animation only, prefer same type and year.
  function findTmdb(card, done) {
    var tv = !!card.original_name;
    var year = yearOf(card.release_date || card.first_air_date);
    var queries = (card.yani_titles || [card.title || card.name]).slice(1).concat((card.yani_titles || [])[0] || []);
    // TMDB keeps all seasons in one show: "Фрирен 2" / "Магическая битва: Смертельная миграция" -> base title.
    if (card.yani_type === 'tv') {
      queries = queries.concat(queries.map(function (q) {
        return q.replace(/\s*(\d+|[:—–]\s.*)$/, '');
      }).filter(function (q, i) {
        return q && q !== queries[i];
      }));
    }
    var lang = Lampa.Storage.field('tmdb_lang') || 'ru';

    (function next(i) {
      if (i >= queries.length) return done(null);
      var url = Lampa.TMDB.api('search/multi?query=' + encodeURIComponent(queries[i]) + '&language=' + lang + '&api_key=' + Lampa.TMDB.key());
      new Lampa.Reguest().silent(url, function (json) {
        var list = (json && json.results || []).filter(function (r) {
          return (r.media_type === 'tv' || r.media_type === 'movie') && (r.genre_ids || []).indexOf(16) >= 0;
        });
        var same = function (r) { return (r.media_type === 'tv') === tv; };
        var sameYear = function (r) { return yearOf(r.first_air_date || r.release_date) === year; };
        var hit = list.filter(function (r) { return same(r) && sameYear(r); })[0] ||
          list.filter(sameYear)[0] ||
          list.filter(same)[0];
        if (hit) done({ id: hit.id, method: hit.media_type, poster_path: hit.poster_path, backdrop_path: hit.backdrop_path });
        else next(i + 1);
      }, function () {
        done(undefined);
      });
    })(0);
  }

  // yani_url -> TMDB match (0 = searched, not found), kept across sessions.
  function remember(url, hit) {
    var map = Lampa.Storage.get(STORE, '{}');
    if (Object.keys(map).length > 3000) map = {};
    map[url] = hit || 0;
    Lampa.Storage.set(STORE, map);
  }

  // Gives yani cards Lampa's (TMDB) poster and backdrop; unmatched cards keep the yani poster.
  function enrich(cards, done) {
    var map = Lampa.Storage.get(STORE, '{}');
    if (Object.keys(map).length > 3000) map = {};
    var dirty = false;
    var left = cards.length;
    if (!left) return done(cards);
    cards.forEach(function (card) {
      var apply = function (hit) {
        if (hit) {
          card.tmdb = hit;
          card.poster_path = hit.poster_path;
          card.backdrop_path = hit.backdrop_path;
        }
        if (--left === 0) {
          if (dirty) Lampa.Storage.set(STORE, map);
          done(cards);
        }
      };
      if (map[card.yani_url] !== undefined) return apply(map[card.yani_url]);
      findTmdb(card, function (hit) {
        if (hit !== undefined) {
          map[card.yani_url] = hit || 0;
          dirty = true;
        }
        apply(hit);
      });
    });
  }

  function looksAnime(movie) {
    var animated = (movie.genres || []).some(function (g) { return g.id === 16; });
    return animated && ['ja', 'zh', 'ko'].indexOf(movie.original_language) >= 0;
  }

  // TMDB/CUB card -> yani anime_url: by KP id when the card has one, else by title + year.
  function findYani(movie, done) {
    // Non-animation pages must not wait for yani (CUB cards carry a KP id on every movie).
    if (!(movie.genres || []).some(function (g) { return g.id === 16; })) return done(null);
    var kp = +(movie.kinopoisk_id || movie.kp_id);
    if (kp) {
      return get('/anime?limit=1&kp_ids=' + kp, function (list) {
        list.length ? done(list[0].anime_url) : byTitle();
      }, byTitle);
    }
    byTitle();

    function byTitle() {
      if (!looksAnime(movie)) return done(null);
      var tv = !!(movie.original_name || movie.name);
      var year = yearOf(movie.first_air_date || movie.release_date);
      var queries = [movie.original_name || movie.original_title, movie.name || movie.title].filter(Boolean);

      (function next(i) {
        if (i >= queries.length) return done(null);
        get('/search?limit=10&q=' + encodeURIComponent(queries[i]), function (list) {
          var near = list.filter(function (a) { return Math.abs((a.year || 0) - year) <= 1; });
          var hit = near.filter(function (a) { return (a.type && a.type.alias !== 'movie') === tv && a.year === year; })[0] || near[0];
          hit ? done(hit.anime_url) : next(i + 1);
        }, function () {
          next(i + 1);
        });
      })(0);
    }
  }

  var RECS = [
    { title: 'Рекомендации нейросети · YummyAnime', ai: true },
    { title: 'Рекомендации зрителей · YummyAnime', ai: false }
  ];

  // done(rows): viewing order + both yani recommendation lists, [] when the anime is not on yani.
  function yaniRows(movie, url, done) {
    var withUrl = function (url) {
      if (!url) return done([]);
      get('/anime/' + url + '?need_videos=false', function (anime) {
        var order = anime.viewing_order && anime.viewing_order.length > 1 ? anime.viewing_order.map(toCard) : [];
        var lists = [];
        var left = RECS.length;
        RECS.forEach(function (r, i) {
          var take = function (recs) {
            lists[i] = (Array.isArray(recs) ? recs : []).filter(function (a) {
              return a.anime_id !== anime.anime_id;
            }).map(toCard);
            if (--left === 0) finish();
          };
          get('/anime/' + anime.anime_id + '/recommendations?from_ai=' + r.ai, take, take);
        });

        function finish() {
          enrich(order.concat(lists[0], lists[1]), function () {
            var rows = [];
            if (order.length) rows.push({ title: 'Порядок просмотра · YummyAnime', results: order });
            RECS.forEach(function (r, i) {
              if (lists[i].length) rows.push({ title: r.title, results: lists[i], yani_recs: true });
            });
            done(rows);
          });
        }
      }, function () {
        done([]);
      });
    };

    url ? withUrl(url) : findYani(movie, withUrl);
  }

  // Runs before Lampa builds the page, so its own recommendations/similar rows can be dropped.
  function wrapFull(name) {
    var src = Lampa.Api.sources[name];
    if (!src || !src.full) return;
    var orig = src.full;
    src.full = function (params, oncomplete, onerror) {
      orig.call(src, params, function (data) {
        var called = false;
        var finish = function (rows) {
          if (called) return;
          called = true;
          // The user left the page while we waited: don't build into a dead activity.
          if (params.component === 'full' && params !== Lampa.Activity.active()) return;
          if (rows && rows.some(function (r) { return r.yani_recs; })) {
            delete data.recomend;
            delete data.simular;
          }
          if (rows && rows.length) data.yani_rows = rows;
          oncomplete(data);
        };
        // Never hold the page longer than this; it then opens with Lampa's rows only.
        setTimeout(finish, 3000);
        data && data.movie ? yaniRows(data.movie, params.yani_url, finish) : finish();
      }, onerror);
    };
  }

  var source = {
    title: 'YummyAnime',
    category: function (params, oncomplete, onerror) {
      var parts = SECTIONS.map(function (s) {
        return function (call) {
          get('/anime?limit=' + LIMIT + '&' + s.q, function (list) {
            enrich(list.map(toCard), function (cards) {
              call({ title: s.title, url: s.q, source: 'yani', results: cards, total_pages: 2 });
            });
          }, function () {
            call();
          });
        };
      });
      function load(ok, err) {
        Lampa.Api.partNext(parts, SECTIONS.length, ok, err);
      }
      load(oncomplete, onerror);
      return load;
    },
    list: function (params, oncomplete, onerror) {
      var page = params.page || 1;
      get('/anime?limit=' + LIMIT + '&offset=' + (page - 1) * LIMIT + '&' + params.url, function (list) {
        enrich(list.map(toCard), function (cards) {
          oncomplete({ results: cards, page: page, total_pages: list.length < LIMIT ? page : page + 1 });
        });
      }, onerror);
    },
    full: function (params, oncomplete, onerror) {
      var card = params.card || {};
      var resolve = function (full) {
        findTmdb(full, function (found) {
          if (found !== undefined) remember(card.yani_url, found);
          open(found);
        });
      };
      var open = function (found) {
        if (!found) {
          Lampa.Noty.show('YummyAnime: «' + (card.title || card.name) + '» не найдено в TMDB');
          // Lampa's full onError reads status.blocked, so it needs an object.
          return onerror && onerror({});
        }
        // The activity continues as a normal TMDB card; yani_url keeps the exact yani match.
        params.id = found.id;
        params.method = found.method;
        params.source = 'tmdb';
        params.yani_url = card.yani_url;
        Lampa.Api.sources.tmdb.full(params, oncomplete, onerror);
      };
      if (card.tmdb) return open(card.tmdb);
      // List items carry only the Russian title; the full record has other_titles for the TMDB search.
      get('/anime/' + card.yani_url + '?need_videos=false', function (a) {
        resolve(toCard(a));
      }, function () {
        resolve(card);
      });
    }
  };

  function start() {
    Lampa.Api.sources.yani = source;

    Lampa.Menu.addButton(ICON, 'Аниме', function () {
      Lampa.Activity.push({ url: '', title: 'Аниме', component: 'category', source: 'yani', page: 1 });
    });

    wrapFull('tmdb');
    wrapFull('cub');

    Lampa.Listener.follow('full', function (e) {
      if (e.type !== 'complite' || !e.link || !e.link.rows || !e.data || !e.data.yani_rows) return;
      e.data.yani_rows.forEach(function (r) {
        e.link.rows.push(['cards', r]);
      });
      // Rows are created lazily on scroll; nudge it so the new ones are appended.
      e.link.emit('scroll', e.link.scroll.position());
    });
  }

  if (window.appready) start();
  else {
    Lampa.Listener.follow('app', function (e) {
      if (e.type === 'ready') start();
    });
  }
})();

(function () {
  'use strict';

  if (window.yummyani_plugin_ready) return;
  window.yummyani_plugin_ready = true;

  var API = 'https://api.yani.tv';
  var LIMIT = 20;
  var STORE = 'yummyani_tmdb3'; // v3 marks same-type guesses with `loose`
  var ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><circle cx="100.3" cy="100.3" r="82.8" fill="#333"/><path fill="#F66" d="M100.3 0C44.9 0 0 44.9 0 100.4c0 31.7 14.7 59.9 37.6 78.3.5.4 1.1.9 1.6 1.3 1 .8 2 1.6 3.1 2.3q3.6 2.55 7.5 4.8c14.8 8.6 32.1 13.6 50.5 13.6 26.5 0 50.6-10.3 68.5-27.1 1.7-1.6 3.4-3.3 5-5l.6-.6c.5-.5 1-1.1 1.4-1.6 15.4-17.6 24.7-40.7 24.7-66C200.7 44.9 155.8 0 100.3 0m76.4 101.9c-.3 14.3-4.5 27.7-11.6 39-.4.7-.8 1.3-1.3 2-4.8 7.1-10.7 13.3-17.5 18.5-.5.4-1.1.8-1.6 1.2-12.1 8.7-26.9 13.9-42.9 14.2-11.3.2-22-2-31.7-6.2-.6-.3-1.2-.5-1.8-.8-7-3.3-13.5-7.5-19.1-12.7-.5-.5-1-.9-1.5-1.4-14.2-13.6-23.2-32.6-23.6-53.8-.2-10.4 1.7-20.4 5.3-29.5.4-1.1.9-2.2 1.4-3.3.4-.9.9-1.9 1.3-2.8C35 60.4 38.7 54.9 43 50c.1-.2.3-.4.5-.5.7-.8 1.4-1.5 2.1-2.3a76.23 76.23 0 0 1 53.3-23.1c1.9 0 3.9 0 5.8.1q5.85.3 11.4 1.5c18.5 3.9 34.6 14.5 45.5 29.1.6.9 1.3 1.7 1.9 2.6 4.6 6.8 8.2 14.4 10.4 22.5.3 1.3.7 2.5.9 3.8 1.1 4.9 1.7 10 1.8 15.2v3z"/><path fill="#F66" d="m27.6 68.4 37.3 47.4 11.4-26.3-33.9-43.1zm58.7 59h44.1l-15.1-36.8-6.6-16.1-7.2 17.1c-5.1 11.9-10.1 23.9-15.2 35.8m77.8 15.5 9.4 22.1-.6.6c-1.6 1.7-3.3 3.4-5 5l-19.4.1-3.1-7.3-1.6-3.8-4.3-10.2H77l-7.7 18.2-1.8 4.2-5.1 11.9-13.4.4q-3.9-2.25-7.5-4.8c-1.1-.7-2.1-1.5-3.1-2.3 2.8-6.4 5.6-12.9 8.4-19.3l1.5-3.6c5.5-12.8 11.1-25.5 16.6-38.3 3.8-8.8 7.6-17.5 11.4-26.3 9.2-21.1 18.3-42.2 27.5-63.3.4-1 .8-1.9 1.2-2.9l8.8 1.1 1.4 3.3 24 56.6 11.2 26.4 12.4 29.2zm15-68.8L150 111l-11-26 37-47.2z"/></svg>'; // ru.yummyani.me/favicon.svg
  var ORDER_ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 5h2v2H3zm4 0h14v2H7zM3 11h2v2H3zm4 0h14v2H7zm-4 6h2v2H3zm4 0h14v2H7z"/></svg>';
  var DICE = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"><rect width="200" height="300" fill="#26282b"/>' +
    '<rect x="45" y="95" width="110" height="110" rx="18" fill="none" stroke="#fff" stroke-width="8"/>' +
    '<g fill="#fff"><circle cx="75" cy="125" r="10"/><circle cx="100" cy="150" r="10"/><circle cx="125" cy="175" r="10"/></g></svg>');
  var YEAR = new Date().getFullYear();
  var SECTIONS = [
    { title: 'Онгоинги', q: 'status=ongoing&sort=views&sort_forward=false' },
    { title: 'Случайное', q: 'sort=random', random: true },
    { title: 'Новинки ' + YEAR, q: 'from_year=' + YEAR + '&to_year=' + YEAR + '&sort=views&sort_forward=false' },
    { title: 'Популярное', q: 'sort=rating_counters&sort_forward=false' },
    { title: 'Топ 100', q: 'sort=top&sort_forward=true', max: 100 },
    { title: 'Фильмы', q: 'types=movie&sort=top&sort_forward=true' }
  ];
  var RECS = [
    { title: 'Рекомендации нейросети · YummyAnime', ai: true },
    { title: 'Рекомендации зрителей · YummyAnime', ai: false }
  ];

  var cache = {};

  function get(path, ok, err, fresh) {
    if (cache[path] && !fresh) return ok(cache[path]);
    new Lampa.Reguest().silent(API + path, function (json) {
      if (!json || !json.response) return err && err();
      if (Object.keys(cache).length > 100) cache = {};
      if (!fresh) cache[path] = json.response;
      ok(json.response);
    }, function () {
      if (err) err();
    }, false, { headers: { Lang: 'ru' } }); // without it the API answers in the browser's language
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
      yani_kind: a.type && a.type.name,
      yani_rel: a.data && a.data.text,
      yani_year: a.year || 0,
      kp: a.remote_ids && a.remote_ids.kp_id || 0,
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
    var loose = null;
    var pack = function (r, guess) {
      var p = { id: r.id, method: r.media_type, poster_path: r.poster_path, backdrop_path: r.backdrop_path };
      if (guess) p.loose = true;
      return p;
    };

    (function next(i) {
      // A year match from any title beats a same-type guess ("NARUTO" alone finds Boruto first).
      if (i >= queries.length) return done(loose);
      var url = Lampa.TMDB.api('search/multi?query=' + encodeURIComponent(queries[i]) + '&language=' + lang + '&api_key=' + Lampa.TMDB.key());
      new Lampa.Reguest().silent(url, function (json) {
        var list = (json && json.results || []).filter(function (r) {
          return (r.media_type === 'tv' || r.media_type === 'movie') && (r.genre_ids || []).indexOf(16) >= 0;
        });
        var same = function (r) { return (r.media_type === 'tv') === tv; };
        var sameYear = function (r) { return yearOf(r.first_air_date || r.release_date) === year; };
        var hit = list.filter(function (r) { return same(r) && sameYear(r); })[0] || list.filter(sameYear)[0];
        if (hit) return done(pack(hit));
        if (!loose && list.filter(same)[0]) loose = pack(list.filter(same)[0], true);
        next(i + 1);
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

  // Seasons are separate yani pages but one Lampa (TMDB) card; KP id covers the unmatched ones.
  function keyOf(card) {
    return card.tmdb ? card.tmdb.method + card.tmdb.id : card.kp ? 'kp' + card.kp : 'y' + card.id;
  }

  // Drops a card when any of its ids (TMDB, KP, yani) was already seen or belongs to this page.
  function uniq(cards, skip) {
    var seen = {};
    skip.forEach(function (k) { seen[k] = true; });
    return cards.filter(function (c) {
      var keys = [keyOf(c), 'y' + c.id];
      if (c.kp) keys.push('kp' + c.kp);
      if (keys.some(function (k) { return seen[k]; })) return false;
      keys.forEach(function (k) { seen[k] = true; });
      return true;
    });
  }

  // Viewing order as Select items; consecutive TV parts of one TMDB show become one line.
  function orderItems(order, currentId, pageKey) {
    var groups = [];
    order.forEach(function (c) {
      var last = groups[groups.length - 1];
      if (last && c.tmdb && c.yani_type === 'tv' && last.type === 'tv' && last.key === keyOf(c)) last.parts.push(c);
      else groups.push({ key: keyOf(c), type: c.yani_type, parts: [c] });
    });
    return groups.map(function (g, i) {
      var first = g.parts[0];
      var lastYear = g.parts[g.parts.length - 1].yani_year;
      var years = first.yani_year && lastYear !== first.yani_year ? first.yani_year + '–' + lastYear : first.yani_year;
      var info = [first.yani_kind, first.yani_rel, years].filter(Boolean).join(', ');
      if (g.parts.length > 1) info += ' · частей: ' + g.parts.length;
      if (first.vote_average) info += ' · ★ ' + first.vote_average;
      if (insideShow(first, pageKey)) info += ' · в Lampa — внутри сериала';
      return {
        title: (i + 1) + '. ' + (first.title || first.name),
        subtitle: info,
        selected: g.parts.some(function (p) { return p.id === currentId; }),
        card: first
      };
    });
  }

  // A special/OVA/ONA that TMDB has no card for: it matched its show (TMDB keeps it in season 0),
  // by a same-type guess or by sharing the show's year on the show's own page.
  function insideShow(card, pageKey) {
    return !!(card.tmdb && card.tmdb.method === 'tv' && card.yani_type !== 'tv' && card.yani_type !== 'movie' &&
      (card.tmdb.loose || pageKey === undefined || keyOf(card) === pageKey));
  }

  // Tells where such an entry is inside the show: season 0 episode by English title, else by unique air year.
  function specialNote(card) {
    var name = card.title || card.name;
    var say = function (ep) {
      Lampa.Noty.show('«' + name + '» — в Lampa нет отдельной карточки. Ищи в сериале: «Спецвыпуски» (сезон 0)' + (ep ? ', серия ' + ep : ''));
    };
    get('/anime/' + card.yani_url + '?need_videos=false', lookup, function () { lookup({}); });

    function lookup(full) {
      var titles = (full.other_titles || []).concat(name).join(' | ').toLowerCase();
      var url = Lampa.TMDB.api('tv/' + card.tmdb.id + '/season/0?language=en&api_key=' + Lampa.TMDB.key());
      new Lampa.Reguest().silent(url, function (json) {
        var eps = json && json.episodes || [];
        // Short names ("OVA", "Recap") would match any title.
        var hit = eps.filter(function (e) { return e.name && e.name.length >= 8 && titles.indexOf(e.name.toLowerCase()) >= 0; })[0];
        var sameYear = eps.filter(function (e) { return yearOf(e.air_date) === card.yani_year; });
        if (!hit && sameYear.length === 1) hit = sameYear[0];
        say(hit && hit.episode_number);
      }, function () {
        say(0);
      });
    }
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

  // done({order, ai, users}) for the anime on this page, or done(null) when it is not on yani.
  function yaniData(movie, pageKey, url, done) {
    var withUrl = function (url) {
      if (!url) return done(null);
      get('/anime/' + url + '?need_videos=false', function (anime) {
        var order = anime.viewing_order && anime.viewing_order.length > 1 ? anime.viewing_order.map(toCard) : [];
        var lists = [];
        var left = RECS.length;
        RECS.forEach(function (r, i) {
          var take = function (recs) {
            lists[i] = (Array.isArray(recs) ? recs : []).map(toCard);
            if (--left === 0) finish();
          };
          get('/anime/' + anime.anime_id + '/recommendations?from_ai=' + r.ai, take, take);
        });

        function finish() {
          enrich(order.concat(lists[0], lists[1]), function () {
            var self = [pageKey, 'y' + anime.anime_id];
            if (anime.remote_ids && anime.remote_ids.kp_id) self.push('kp' + anime.remote_ids.kp_id);
            done({
              order: order.length ? orderItems(order, anime.anime_id, pageKey) : [],
              ai: uniq(lists[0], self),
              users: uniq(lists[1], self),
              // Franchise entry pages for the Kodik balancer: seasons and OVA are separate there.
              urls: order.map(function (c) { return c.yani_url; }),
              shikimori: anime.remote_ids && anime.remote_ids.shikimori_id ? [anime.remote_ids.shikimori_id] : []
            });
          });
        }
      }, function () {
        done(null);
      });
    };

    url ? withUrl(url) : findYani(movie, withUrl);
  }

  // Lampa overwrites recomend/simular titles with its own; this keeps ours.
  function row(title, results) {
    var r = { results: results };
    Object.defineProperty(r, 'title', { get: function () { return title; }, set: function () {}, enumerable: true });
    return r;
  }

  // Runs before Lampa builds the page, so yani lists take the place of Lampa's recommendations/similar.
  function wrapFull(name) {
    var src = Lampa.Api.sources[name];
    if (!src || !src.full) return;
    var orig = src.full;
    src.full = function (params, oncomplete, onerror) {
      orig.call(src, params, function (data) {
        var called = false;
        var finish = function (res) {
          if (called) return;
          called = true;
          // The user left the page while we waited: don't build into a dead activity.
          if (params.component === 'full' && params !== Lampa.Activity.active()) return;
          if (res && (res.ai.length || res.users.length)) {
            delete data.recomend;
            delete data.simular;
            if (res.ai.length) data.recomend = row(RECS[0].title, res.ai);
            if (res.users.length) data.simular = row(RECS[1].title, res.users);
          }
          if (res && res.urls.length) {
            data.movie.yani_order_urls = res.urls;
            data.movie.yani_shikimori = res.shikimori;
          }
          if (res && res.order.length) {
            data.yani_order = res.order;
            data.yani_page = pageKey;
          }
          oncomplete(data);
        };
        // Never hold the page longer than this; it then opens with Lampa's rows only.
        setTimeout(finish, 3000);
        if (!data || !data.movie) return finish();
        var pageKey = (params.method || (data.movie.name ? 'tv' : 'movie')) + data.movie.id;
        yaniData(data.movie, pageKey, params.yani_url, finish);
      }, onerror);
    };
  }

  function addOrderButton(e) {
    var buttons = e.body.find('.full-start-new__buttons, .full-start__buttons').first();
    if (!buttons.length || buttons.find('.button--yani-order').length) return;
    var btn = $('<div class="full-start__button selector button--yani-order">' + ORDER_ICON + '<span>Порядок просмотра</span></div>');
    btn.on('hover:enter', function () {
      var ctrl = Lampa.Controller.enabled().name;
      Lampa.Select.show({
        title: 'Порядок просмотра · YummyAnime',
        items: e.data.yani_order,
        onSelect: function (a) {
          // This page, another season of the same show or a special living inside it:
          // Kodik has each part as its own entry, so open it straight on that part.
          if (a.selected || keyOf(a.card) === e.data.yani_page || insideShow(a.card, e.data.yani_page)) return openKodik(a.card, e.data.movie);
          // Own TMDB page: open it as usual.
          Lampa.Activity.push({ url: '', component: 'full', id: a.card.id, method: a.card.original_name ? 'tv' : 'movie', card: a.card, source: 'yani' });
        },
        onBack: function () {
          Lampa.Controller.toggle(ctrl);
        }
      });
    });
    var play = buttons.find('.button--play');
    play.length ? play.after(btn) : buttons.append(btn);
  }

  // Opens the Kodik balancer straight on one yani part (online_mod reads `yani_only_shikimori`).
  // The TMDB card is kept as-is, so watch history and resume keep working.
  function openKodik(card, base) {
    get('/anime/' + card.yani_url + '?need_videos=false', function (a) {
      var shiki = a.remote_ids && a.remote_ids.shikimori_id;
      if (!shiki) return Lampa.Noty.show('«' + (a.title || card.title) + '» нет в Kodik');
      var movie = {};
      for (var k in base) movie[k] = base[k];
      movie.yani_only_shikimori = shiki;
      Lampa.Activity.push({
        url: '',
        title: 'Онлайн',
        component: 'online_mod',
        page: 1,
        search: a.title,
        balancer: 'kodik',
        movie: movie
      });
    }, function () {
      Lampa.Noty.show('YummyAnime: не удалось получить данные');
    });
  }

  function randomCard() {
    return { id: 'random', source: 'yani', yani_random: true, title: 'Случайное аниме', img: DICE };
  }

  var source = {
    title: 'YummyAnime',
    category: function (params, oncomplete, onerror) {
      var parts = SECTIONS.map(function (s) {
        return function (call) {
          get('/anime?limit=' + LIMIT + '&' + s.q, function (list) {
            enrich(list.map(toCard), function (cards) {
              if (s.random) cards.unshift(randomCard());
              call({ title: s.title, url: s.q, source: 'yani', results: cards, total_pages: 2 });
            });
          }, function () {
            call();
          }, s.random);
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
      var section = SECTIONS.filter(function (s) { return s.q === params.url; })[0] || {};
      var pages = section.max ? Math.ceil(section.max / LIMIT) : Infinity;
      get('/anime?limit=' + LIMIT + '&offset=' + (page - 1) * LIMIT + '&' + params.url, function (list) {
        enrich(list.map(toCard), function (cards) {
          oncomplete({ results: cards, page: page, total_pages: list.length < LIMIT || page >= pages ? page : page + 1 });
        });
      }, onerror, section.random);
    },
    full: function (params, oncomplete, onerror) {
      var tries = 3;
      var fail = function (card) {
        if (params.card && params.card.yani_random && --tries > 0) return random();
        Lampa.Noty.show('YummyAnime: «' + (card.title || card.name || '') + '» не найдено в TMDB');
        // Lampa's full onError reads status.blocked, so it needs an object.
        if (onerror) onerror({});
      };
      var open = function (card, found) {
        if (!found) return fail(card);
        // Opened from a row: still say where the special is inside the show.
        card.tmdb = found;
        if (insideShow(card)) specialNote(card);
        // The activity continues as a normal TMDB card; yani_url keeps the exact yani match.
        params.id = found.id;
        params.method = found.method;
        params.source = 'tmdb';
        params.yani_url = card.yani_url;
        Lampa.Api.sources.tmdb.full(params, oncomplete, onerror);
      };
      var search = function (card, full) {
        findTmdb(full, function (found) {
          if (found !== undefined) remember(card.yani_url, found);
          open(card, found);
        });
      };
      var resolve = function (card) {
        var known = card.tmdb || Lampa.Storage.get(STORE, '{}')[card.yani_url];
        if (known) return open(card, known);
        // List items carry only the Russian title; the full record has other_titles for the TMDB search.
        get('/anime/' + card.yani_url + '?need_videos=false', function (a) {
          search(card, toCard(a));
        }, function () {
          search(card, card);
        });
      };
      var random = function () {
        get('/anime?limit=1&sort=random', function (list) {
          list.length ? resolve(toCard(list[0])) : fail({});
        }, function () {
          if (onerror) onerror({});
        }, true);
      };
      params.card && params.card.yani_random ? random() : resolve(params.card || {});
    }
  };

  // Shikimori ids of the whole viewing order for the Kodik balancer (online_mod).
  // Starter page's own id is already known; other parts need their record, cached by `get`.
  function shikimoriIds(movie, done) {
    var urls = (movie.yani_order_urls || []).slice();
    var ids = (movie.yani_shikimori || []).slice();
    var i = 0;
    var running = 0;
    var closed = false;
    var timer = setTimeout(finish, 3000);

    function finish() {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      var out = [];
      ids.forEach(function (id) {
        id = +id;
        if (id && out.indexOf(id) < 0) out.push(id);
      });
      done(out);
    }

    function tick() {
      if (closed) return;
      while (running < 4 && i < urls.length) {
        running++;
        get('/anime/' + urls[i++] + '?need_videos=false', function (a) {
          if (a.remote_ids && a.remote_ids.shikimori_id) ids.push(a.remote_ids.shikimori_id);
          running--;
          tick();
        }, function () {
          running--;
          tick();
        });
      }
      if (!running && i >= urls.length) finish();
    }

    urls.length ? tick() : finish();
  }

  window.YummyAnime = window.YummyAnime || {};
  window.YummyAnime.shikimoriIds = shikimoriIds;

  function start() {
    Lampa.Api.sources.yani = source;
    ['yummyani_tmdb', 'yummyani_tmdb2'].forEach(function (old) {
      if (Lampa.Storage.get(old, '')) Lampa.Storage.set(old, '');
    });

    // Lampa hides its anime / feed / releases items outside ru/uk/be; add the same screens ourselves.
    if (!Lampa.Lang.selected(['ru', 'uk', 'be'])) {
      var have = {};
      $('.menu__item').each(function () {
        have[$(this).attr('data-action')] = true;
      });
      var item = function (sprite, title, action, run) {
        if (have[action]) return;
        Lampa.Menu.addButton('<svg><use xlink:href="#sprite-' + sprite + '"></use></svg>', title, run)
          .attr('data-action', action);
      };
      var anime = Lampa.Lang.translate('menu_anime');
      item('anime', anime, 'anime', function () {
        Lampa.Router.call('category', { url: 'anime', title: anime + ' - CUB', source: 'cub' });
      });
      if (window.lampa_settings && window.lampa_settings.feed) {
        item('feed', 'Feed', 'feed', function () {
          Lampa.Router.call('feed', { title: 'Feed' });
        });
      }
      item('hd', Lampa.Lang.translate('menu_relises'), 'relise', function () {
        Lampa.Router.call('relise', { title: Lampa.Lang.translate('menu_relises') });
      });
    }

    Lampa.Menu.addButton(ICON, 'YummyAnime', function () {
      Lampa.Activity.push({ url: '', title: 'YummyAnime', component: 'category', source: 'yani', page: 1 });
    });

    wrapFull('tmdb');
    wrapFull('cub');

    Lampa.Listener.follow('full', function (e) {
      if (e.type === 'complite' && e.body && e.data && e.data.yani_order) addOrderButton(e);
    });
  }

  if (window.appready) start();
  else {
    Lampa.Listener.follow('app', function (e) {
      if (e.type === 'ready') start();
    });
  }
})();

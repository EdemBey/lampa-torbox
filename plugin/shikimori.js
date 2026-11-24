// Shikimori score for anime: a badge on posters and a block in the movie card.
// Setting "Рейтинг аниме" (Interface): Shikimori instead of TMDB on anime, TMDB only, or both.
(function () {
  'use strict';

  if (window.shikimori_rating_plugin) return;
  window.shikimori_rating_plugin = true;

  var API = 'https://shikimori.io/api/animes';
  var TTL = 7 * 24 * 3600 * 1000;
  var GAP = 700; // Shikimori allows 90 requests a minute
  var network = new Lampa.Reguest();
  var queue = [];
  var busy = false;
  var waiting = {};

  function isAnime(d) {
    if (!d) return false;
    if (d.yani_shikimori && d.yani_shikimori.length) return true;
    var ids = d.genre_ids || (d.genres || []).map(function (g) { return g.id; });
    return d.original_language === 'ja' && ids.indexOf(16) !== -1;
  }

  function next() {
    if (busy || !queue.length) return;
    busy = true;
    queue.shift()(function () {
      setTimeout(function () {
        busy = false;
        next();
      }, GAP);
    });
  }

  function request(url, cb, urgent) {
    queue[urgent ? 'unshift' : 'push'](function (done) {
      network.timeout(15000);
      network.silent(url, function (json) {
        done();
        cb(json);
      }, function () {
        done();
        cb(null);
      });
    });
    next();
  }

  // done(score, ok): ok=false means a network error, so the miss is not cached.
  function lookup(d, done, urgent) {
    var sid = d.yani_shikimori && d.yani_shikimori[0];
    if (sid) {
      return request(API + '/' + sid, function (a) {
        done(a ? parseFloat(a.score) || 0 : 0, !!a);
      }, urgent);
    }
    var year = parseInt((d.release_date || d.first_air_date || '').slice(0, 4)) || 0;
    var names = [d.original_title || d.original_name, d.title || d.name].filter(function (n, i, all) {
      return n && all.indexOf(n) === i;
    });
    (function tryName(i) {
      if (i >= names.length) return done(0, true);
      request(API + '?limit=10&kind=' + (d.name ? '!movie' : 'movie') + '&search=' + encodeURIComponent(names[i]), function (list) {
        if (!list) return done(0, false);
        var hit = list.filter(function (a) {
          var y = parseInt((a.aired_on || '').slice(0, 4)) || 0;
          return !year || !y || Math.abs(y - year) <= 1;
        })[0];
        if (hit) done(parseFloat(hit.score) || 0, true);
        else tryName(i + 1);
      }, urgent);
    })(0);
  }

  function get(d, cb, urgent) {
    var key = (d.source || 'tmdb') + '_' + (d.name ? 'tv' : 'movie') + '_' + d.id;
    var sid = d.yani_shikimori && d.yani_shikimori[0];
    var wkey = key + (sid ? '_id' : ''); // an id lookup must not join a queued name search
    var hit = Lampa.Storage.cache('shikimori_rating', 1000, {})[key];
    // A score found by name search must not shadow the exact Shikimori id once it is known.
    if (hit && Date.now() - hit.t < TTL && (hit.id || !sid)) return cb(hit.s);
    if (waiting[wkey]) return waiting[wkey].push(cb);
    waiting[wkey] = [cb];
    lookup(d, function (score, ok) {
      if (ok) {
        var cache = Lampa.Storage.cache('shikimori_rating', 1000, {});
        cache[key] = { s: score, t: Date.now(), id: sid ? 1 : 0 };
        Lampa.Storage.set('shikimori_rating', cache);
      }
      var cbs = waiting[wkey];
      delete waiting[wkey];
      cbs.forEach(function (f) { f(score); });
    }, urgent);
  }

  // UI

  // 'shiki': Shikimori replaces TMDB on anime; 'tmdb': no Shikimori at all; 'both': side by side.
  function mode() {
    return Lampa.Storage.field('shikimori_mode') || 'shiki';
  }

  function addSetting() {
    Lampa.SettingsApi.addParam({
      component: 'interface',
      param: {
        name: 'shikimori_mode',
        type: 'select',
        values: {
          shiki: 'Только Шикимори на аниме',
          tmdb: 'Только TMDB',
          both: 'Показывать оба'
        },
        'default': 'shiki'
      },
      field: {
        name: 'Рейтинг аниме',
        description: 'Какую оценку показывать на постерах и в карточке аниме'
      }
    });
  }

  if (window.appready) addSetting();
  else {
    Lampa.Listener.follow('app', function (e) {
      if (e.type === 'ready') addSetting();
    });
  }

  $('head').append('<style>' +
    '.card--shiki .card__vote{display:none!important}' +
    '.card__shiki{position:absolute;right:.4em;bottom:.4em;display:flex;align-items:center;padding:.25em .5em;border-radius:.7em;background:rgba(0,0,0,.7);color:#fff;font-size:1.1em;font-weight:600;line-height:1}' +
    '.card--shiki-both .card__shiki{right:auto;left:.4em}' +
    '.card__shiki span{margin-right:.3em;padding:.1em .2em;border:.12em solid currentColor;border-radius:.3em;font-size:.6em}' +
    '</style>');

  // Lampa fires a non-bubbling 'visible' on each .card it shows; capture catches it at the document.
  document.addEventListener('visible', function (e) {
    var card = e.target;
    if (!card || !card.classList || !card.classList.contains('card')) return;
    if (mode() === 'tmdb' || !isAnime(card.card_data) || card.querySelector('.card__shiki')) return;
    get(card.card_data, function (score) {
      var view = card.querySelector('.card__view');
      if (!score || !view || card.querySelector('.card__shiki')) return;
      var badge = document.createElement('div');
      var mark = document.createElement('span');
      badge.className = 'card__shiki';
      mark.textContent = 'SH';
      badge.appendChild(mark);
      badge.appendChild(document.createTextNode(score.toFixed(1)));
      card.classList.add(mode() === 'both' ? 'card--shiki-both' : 'card--shiki');
      view.appendChild(badge);
    });
  }, true);

  Lampa.Listener.follow('full', function (e) {
    if (e.type !== 'complite' || mode() === 'tmdb' || !isAnime(e.data && e.data.movie)) return;
    var render = e.object.activity.render();
    get(e.data.movie, function (score) {
      if (!score || $('.rate--shiki', render).length) return;
      var el = $('<div class="full-start__rate rate--shiki"><div></div><div>SHIKI</div></div>');
      el.find('> div').eq(0).text(score.toFixed(1));
      $('.rate--kp', render).last().after(el);
      // TMDB goes only when Shikimori took its place, so a card never ends up with no score.
      if (mode() === 'shiki') $('.rate--tmdb', render).addClass('hide');
    }, true);
  });
})();

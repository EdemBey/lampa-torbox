// Lampa theme: redesign CSS + faster background, missing backdrops for history cards, fullscreen description. Settings → «Тема оформления».
(function () {
  'use strict';

  if (window.__lampa_theme_loaded__) return;
  window.__lampa_theme_loaded__ = true;

  var KEY = 'lampa_theme_enabled';
  var CSS = "\n/* body + .background: глубокий фон, бэкдроп виднее, сильная виньетка слева и снизу */\nbody{background:#07080c;font-family:\"SegoeUI\",\"Segoe UI\",Roboto,\"Helvetica Neue\",Arial,sans-serif;-webkit-font-smoothing:antialiased}\n.background{background:#07080c}\n.background__one,.background__two,.background__fade{-webkit-filter:brightness(1.5) saturate(1.3);filter:brightness(1.5) saturate(1.3)}\n.background:after{content:\"\";position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;background:-webkit-linear-gradient(left,rgba(5,6,10,.8) 0,rgba(5,6,10,.4) 16%,rgba(5,6,10,0) 45%),-webkit-linear-gradient(bottom,rgba(5,6,10,.9) 0,rgba(5,6,10,.4) 14%,rgba(5,6,10,0) 38%),-webkit-linear-gradient(top,rgba(5,6,10,.5) 0,rgba(5,6,10,0) 14%);background:linear-gradient(90deg,rgba(5,6,10,.8) 0,rgba(5,6,10,.4) 16%,rgba(5,6,10,0) 45%),linear-gradient(0deg,rgba(5,6,10,.9) 0,rgba(5,6,10,.4) 14%,rgba(5,6,10,0) 38%),linear-gradient(180deg,rgba(5,6,10,.5) 0,rgba(5,6,10,0) 14%)}\n\n/* .head: прозрачная, верхний градиент */\n.head{background:-webkit-linear-gradient(top,rgba(5,6,10,.8),rgba(5,6,10,0));background:linear-gradient(180deg,rgba(5,6,10,.8),rgba(5,6,10,0))}\n.head__title{font-size:1.5em;font-weight:700;letter-spacing:.01em;text-shadow:0 .1em .5em rgba(0,0,0,.6)}\n.head__time{padding:.45em 1em;border-radius:2em;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.08)}\n.head__time-now{font-size:1.25em;font-weight:700}\n.head__time-date{display:none}\n\n/* .wrap__left: стеклянная панель (ширину и сдвиг задаёт Lampa), фокус = белая пилюля */\n.wrap__left:before{content:\"\";position:absolute;z-index:-1;left:0;top:4em;bottom:0;width:100%;background:rgba(14,16,22,.82);border-right:1px solid rgba(255,255,255,.1);box-shadow:.3em 0 2em rgba(0,0,0,.5);-webkit-backdrop-filter:blur(1.2em);backdrop-filter:blur(1.2em)}\nbody.menu--open .wrap__left:before{width:15em}\n.menu__list{padding-left:.7em;padding-right:.7em}\n.menu__item{padding:.95em 1em;margin-bottom:.25em;border-radius:3em;color:rgba(255,255,255,.72);-webkit-transition:background-color .2s,color .2s;transition:background-color .2s,color .2s}\n.menu__item + li{margin-top:0}\n.menu__text{font-weight:500}\n.menu__item.focus,.menu__item.hover{background-color:#fff;color:#000;box-shadow:0 .5em 1.4em rgba(0,0,0,.5)}\n\n/* .items-line: крупные жирные заголовки с акцентной меткой, больше воздуха */\n.items-line{padding-bottom:3em}\n.items-line__head{margin-bottom:0}\n.scroll--horizontal{padding-top:1.9em;padding-bottom:1em}\n.items-line__title{font-size:1.9em;font-weight:700;letter-spacing:.005em;text-shadow:0 .1em .5em rgba(0,0,0,.6)}\n.items-line__title:before{content:\"\";display:inline-block;width:.24em;height:.85em;margin-right:.5em;border-radius:.2em;background:#ffb020;vertical-align:-.08em;box-shadow:0 0 .8em rgba(255,176,32,.55)}\n.items-line__more{padding:.45em 1.2em;border-radius:2em;font-weight:600;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.08)}\n\n/* .card: радиус, тень, фокус = белое кольцо + scale + глубокая тень */\n.card{-webkit-transition:-webkit-transform .2s;transition:transform .2s}\n.card__view,.card__img{border-radius:1.1em}\n.card__view{box-shadow:0 .6em 1.6em rgba(0,0,0,.55);-webkit-transition:box-shadow .2s;transition:box-shadow .2s}\n.card__vote{right:.6em;bottom:.6em;font-size:1.1em;font-weight:700;padding:.2em .6em;border-radius:2em;background:rgba(5,6,10,.82);color:#fff;border:1px solid rgba(255,255,255,.16);text-shadow:none}\n.card__vote:before{content:\"\\2605\";margin-right:.3em;font-size:.9em;color:#ffb020}\n.card__quality{left:.6em;top:.6em;bottom:auto;font-size:.8em;font-weight:800;padding:.3em .7em;border-radius:2em;background:#ffb020;color:#000;letter-spacing:.03em}\n.card__icons-inner{background:rgba(5,6,10,.75)}\n.card__title{font-size:1.2em;font-weight:500;margin-top:.8em;opacity:.6;-webkit-transition:opacity .2s;transition:opacity .2s}\n.card__age{opacity:.4}\n.card.focus{-webkit-transform:scale(1.08);transform:scale(1.08)}\n.card.focus .card__view{box-shadow:0 1.4em 3em rgba(0,0,0,.8)}\n.card.focus .card__view:after{top:-.45em;left:-.45em;right:-.45em;bottom:-.45em;border-width:.28em;border-radius:1.55em}\n.card.focus .card__title{opacity:1;font-weight:700}\n.card.focus .card__age{opacity:.7}\n\n/* .full-start__button + .simple-button: пилюли, фокус = белая заливка */\n.full-start__button,.simple-button{border-radius:3em;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.08);-webkit-transition:background-color .2s,color .2s;transition:background-color .2s,color .2s}\n.full-start__button{font-size:1.2em;height:2.6em;padding:.3em 1.4em;margin-right:.6em}\n.simple-button{font-size:1.2em;height:2.6em;padding:.3em 1.4em}\n.full-start__button.focus,.simple-button.focus{background-color:#fff;color:#000;box-shadow:0 .6em 1.6em rgba(0,0,0,.4)}\n\n/* .full-start-new + img.full-start__background: большой бэкдроп, диагональная маска */\n.full-start__background.loaded{opacity:1;-webkit-filter:brightness(1.1) saturate(1.2);filter:brightness(1.1) saturate(1.2);-webkit-mask-image:-webkit-linear-gradient(top right,#000 25%,rgba(0,0,0,0) 80%);-webkit-mask-image:linear-gradient(to bottom left,#000 25%,rgba(0,0,0,0) 80%);mask-image:linear-gradient(to bottom left,#000 25%,rgba(0,0,0,0) 80%)}\n.full-start-new__poster{border-radius:1.2em;box-shadow:0 1.5em 3.5em rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.08)}\n.full-start-new__head{font-size:1em;letter-spacing:.08em;text-transform:uppercase;opacity:.55}\n.full-start-new__title{font-size:3.6em;font-weight:800;line-height:1.05;letter-spacing:-.015em;-webkit-line-clamp:2;line-clamp:2;text-shadow:0 .1em .6em rgba(0,0,0,.6)}\n.full-start-new__tagline{font-style:italic;opacity:.65}\n.full-start__rate{padding:.4em 1em;border-radius:1.1em;background:rgba(5,6,10,.55);border:1px solid rgba(255,255,255,.12);font-size:1.1em}\n.full-start__rate>div:first-child{font-weight:800;font-size:1.1em}\n.full-start-new__reactions .reaction{background:rgba(5,6,10,.6);border:1px solid rgba(255,255,255,.1)}\n.rate--tmdb>div:first-child{color:#3ecbf5}\n.rate--kp>div:first-child{color:#ff9a3c}\n.rate--imdb>div:first-child{color:#f5c518}\n.source--name{text-transform:uppercase;letter-spacing:.06em;font-size:.7em}\n.full-start__pg,.full-start__status{border:1px solid rgba(255,255,255,.4);border-radius:.4em;font-size:1em}\n.full-start-new__details{opacity:.78}\n.full-start-new__buttons{margin-top:1.8em}\n\n/* .full-descr: стеклянная панель, фокус = белое кольцо */\n.full-descr__text{padding:1.2em 1.5em;border-radius:1.2em;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.06);color:rgba(255,255,255,.85);opacity:1;-webkit-transition:background-color .2s,box-shadow .2s;transition:background-color .2s,box-shadow .2s}\n.full-descr__text.focus{background:rgba(255,255,255,.12);box-shadow:0 0 0 .2em #fff}\n.full-descr__details{opacity:.5}\n\n/* .full-person: режиссёры и актёры, круглое фото, фокус = белая заливка как у кнопок */\n.full-person{padding:.6em 1.6em .6em .6em;margin-right:1em;border-radius:1.6em;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.06);-webkit-transition:-webkit-transform .2s,background-color .2s,box-shadow .2s;transition:transform .2s,background-color .2s,box-shadow .2s}\n.full-person__photo{width:6em;height:6em;border-radius:50%;box-shadow:0 .4em 1em rgba(0,0,0,.5)}\n.full-person__photo>img{height:100%;object-fit:cover}\n.full-person__photo>span{color:#333}\n.full-person__body{max-width:11em}\n.full-person__name,.full-person__role{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.full-person__name{font-size:1.25em;font-weight:600}\n.full-person__role{font-size:1em;margin-top:.5em;opacity:.55}\n.full-person.focus{-webkit-transform:scale(1.04);transform:scale(1.04);background-color:#fff;color:#000;box-shadow:0 1em 2.2em rgba(0,0,0,.55)}\n\n/* .items-line__title с иконкой (Lampa рисует его через .full-person--small): выглядит как обычный заголовок */\n.items-line__title{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center}\n.items-line__title .full-person,.items-line__title .full-person.focus{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;width:auto;font-size:1em;margin:0;padding:0;background:none;color:inherit;border:0;border-radius:0;box-shadow:none;-webkit-transform:none;transform:none;opacity:1}\n.items-line__title .full-person__photo{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center;width:1.15em;height:1.15em;min-width:0;margin:0 .45em 0 0;border-radius:50%;box-shadow:none;-webkit-flex-shrink:0;flex-shrink:0}\n.items-line__title .full-person--svg .full-person__photo{padding:0!important}.items-line__title .full-person--svg .full-person__photo svg{width:.68em!important;height:.68em!important}\n.items-line__title .full-person__body{font-size:1em;padding:0;margin:0;max-width:none}\n.items-line__title .full-person__name{font-size:1em;font-weight:inherit;line-height:inherit;letter-spacing:inherit;margin:0;white-space:nowrap;overflow:visible}\n.items-line__title .full-person__role{display:none}\n\n/* .full-episode + .time-line: стеклянные строки, акцентный прогресс */\n.full-episode{border-radius:1.2em;background:rgba(255,255,255,.06);box-shadow:0 .5em 1.4em rgba(0,0,0,.35);-webkit-transition:-webkit-transform .2s,background-color .2s;transition:transform .2s,background-color .2s}\n.full-episode__img{border-radius:1.2em 0 0 1.2em}\n.full-episode__num{display:inline-block;padding:.2em .6em;border-radius:2em;background:rgba(255,176,32,.2);color:#ffd27a;font-weight:700;opacity:1;font-size:.8em;letter-spacing:.04em;text-transform:uppercase}\n.full-episode__name{font-size:1.25em;font-weight:600}\n.full-episode__date{opacity:.45}\n.time-line{height:.3em;background:rgba(255,255,255,.18)}\n.time-line>div{background:#ffb020}\n.full-episode.focus{-webkit-transform:scale(1.025);transform:scale(1.025);background:rgba(255,255,255,.12)}\n.full-episode.focus:after{border-width:.25em;border-radius:1.5em}\n.torrent-filter{padding-bottom:1.5em}\n\n/* .selectbox: только цвета и фокус, позицию и анимацию выезда задаёт Lampa */\n.selectbox__layer{background:rgba(0,0,0,.55)}\n.selectbox__content{background:rgba(16,18,24,.94);box-shadow:-2em 0 4em rgba(0,0,0,.5);border-left:1px solid rgba(255,255,255,.08)}\n.selectbox__title{font-weight:700}\n.selectbox-item{margin:0 1em .3em;border-radius:1em;-webkit-transition:background-color .2s,color .2s;transition:background-color .2s,color .2s}\n.selectbox-item.focus{background-color:#fff;color:#000}\n.selectbox-item.focus.selected:after{border-color:#000}\n\n/* .online-mod-variants: только отступы и цвета, структура и белый фокус пользователя сохранены */\n.online-mod-variants__still{border-radius:1.3em;box-shadow:0 1.5em 3.5em rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.08)}\n.online-mod-variants__still-bar{height:.3em}\n.online-mod-variants__still-bar i{background:#ffb020}\n.online-mod-variants__title{letter-spacing:-.01em}\n.online-mod-variants__stats>div{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.06)}\n.online-mod-variants__colhead{padding-bottom:1em}\n.online-mod-variants__resume{background:rgba(255,176,32,.16);border:1px solid rgba(255,176,32,.3)}\n.online-mod-variant{margin-bottom:.6em;border-radius:1em;background:rgba(255,255,255,.07);box-shadow:inset 0 0 0 1px rgba(255,255,255,.05)}\n.online-mod-variants__voice{border-radius:.8em;background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.09)}\n.online-mod-variants__util{background:rgba(255,255,255,.08)}\n\n/* описание на весь экран: модалка с классом lampa-descr-modal (ставит JS ниже) */\n.modal.lampa-descr-modal{padding:0;background:rgba(5,6,10,.72);-webkit-backdrop-filter:blur(1.4em);backdrop-filter:blur(1.4em)}\n.modal.lampa-descr-modal .modal__content{max-width:60em;width:100%;background:transparent;padding:0 2em;border-radius:0}\n.lampa-descr-full{font-size:1.3em;line-height:1.6;font-weight:300;padding:3em 0}\n";

  function isOn() {
    var v = true;
    try { if (window.Lampa && Lampa.Storage) v = String(Lampa.Storage.get(KEY, 'true')) !== 'false'; } catch (e) {}
    return v;
  }

  function apply() {
    var el = document.getElementById('lampa-theme-css');
    if (!el) {
      el = document.createElement('style');
      el.id = 'lampa-theme-css';
      el.appendChild(document.createTextNode(CSS));
      document.head.appendChild(el);
    }
    el.disabled = !isOn();
  }

  function addSetting() {
    if (!window.Lampa || !Lampa.SettingsApi || Lampa.SettingsApi.getComponent('lampa_theme')) return;
    Lampa.SettingsApi.addComponent({
      component: 'lampa_theme',
      name: 'Тема оформления',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 3a9 9 0 0 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.3-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4c2 0 3.6-1.6 3.6-3.6C21 6.6 17 3 12 3zM6.5 12a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/></svg>'
    });
    Lampa.SettingsApi.addParam({
      component: 'lampa_theme',
      param: { name: KEY, type: 'trigger', default: true },
      field: { name: 'Включить тему', description: 'Редизайн интерфейса, быстрая смена фона, полноэкранное описание' },
      onChange: apply
    });
  }

  // Background canvases load with crossOrigin; a TMDB URL cached earlier by a plain <img> (card page) then fails CORS.
  // A fixed query param gives the canvas its own cache entry.
  function bgUrl(url) {
    return typeof url === 'string' && /image\.tmdb\.org|imagetmdb/.test(url) && url.indexOf('lampa_bg') < 0 ? url + (url.indexOf('?') < 0 ? '?' : '&') + 'lampa_bg=1' : url;
  }

  // shortcut: Background.change() debounces with a hardcoded setTimeout(…, 1000); we debounce ourselves, preload, then let it run with 0. Revisit if Lampa changes change().
  // Lampa draws every image that finishes loading, even stale ones; preloading and passing only the latest URL stops the flashes after fast scrolling.
  function patchBackground() {
    var B = window.Lampa && Lampa.Background;
    if (!B || !B.change || B.__themePatched) return;
    B.__themePatched = true;
    var origChange = B.change, origImm = B.immediately, timer, latest = '';
    function fast(url) {
      var st = window.setTimeout;
      window.setTimeout = function (fn, ms) { return st.call(window, fn, ms === 1000 ? 0 : ms); };
      try { return origChange.call(B, url); } finally { window.setTimeout = st; }
    }
    B.change = function (url) {
      url = bgUrl(url);
      if (!isOn() || !url || !Lampa.Storage.field('background') || Lampa.Storage.field('light_version')) {
        latest = '';
        clearTimeout(timer);
        return origChange.call(B, url);
      }
      latest = url;
      clearTimeout(timer);
      timer = setTimeout(function () {
        var img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = img.onerror = function () { if (latest === url) fast(url); };
        img.src = url;
      }, 150);
    };
    if (origImm) B.immediately = function (url) { latest = ''; clearTimeout(timer); return origImm.call(B, bgUrl(url)); };
  }

  function openDescr() {
    if (!isOn() || !window.Lampa || !Lampa.Modal) return;
    var prev = Lampa.Controller.enabled().name;
    Lampa.Modal.open({
      title: '',
      size: 'full',
      html: $('<div class="lampa-descr-full"></div>').html($(this).html()),
      onBack: function () {
        Lampa.Modal.close();
        Lampa.Controller.toggle(prev);
      }
    });
    $('.modal').last().addClass('lampa-descr-modal');
  }

  // History cards are stored without backdrop_path, so Lampa falls back to a blurred poster; fetch it from TMDB on focus.
  function fixBackdrops() {
    var cache = {}, pending = {};
    document.addEventListener('hover:focus', function (e) {
      var el = e.target, card = el && el.classList && el.classList.contains('card') && el.card_data;
      if (!card || !isOn() || card.backdrop_path || !/^\d+$/.test(String(card.id))) return;
      if (card.source !== 'tmdb' && card.source !== 'cub') return;
      if (!window.Lampa || !Lampa.Reguest || !Lampa.TMDB || !Lampa.Utils) return;
      var media = card.name ? 'tv' : 'movie', key = media + card.id;
      if (cache[key]) { card.backdrop_path = cache[key]; return; }
      if (key in cache || pending[key]) return;
      pending[key] = true;
      new Lampa.Reguest().silent(Lampa.TMDB.api(media + '/' + card.id + '?language=' + Lampa.Storage.get('language', 'ru') + '&api_key=' + Lampa.TMDB.key()), function (r) {
        delete pending[key];
        cache[key] = (r && r.backdrop_path) || '';
        if (!cache[key]) return;
        card.backdrop_path = cache[key];
        if (el.classList.contains('focus') && Lampa.Background) Lampa.Background.change(Lampa.Utils.cardImgBackgroundBlur(card));
      }, function () {
        delete pending[key];
        cache[key] = '';
      });
    }, true);
  }

  function ready() {
    patchBackground();
    fixBackdrops();
    document.addEventListener('hover:enter', function (e) {
      var t = e.target;
      if (t && t.classList && t.classList.contains('full-descr__text')) openDescr.call(t);
    }, true);
    addSetting();
    apply();
  }

  apply();

  if (window.Lampa) {
    if (window.appready) ready();
    else if (Lampa.Listener) {
      Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') ready();
      });
    }
  }
})();

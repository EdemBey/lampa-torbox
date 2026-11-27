// Lampa theme: redesign CSS + faster background, missing backdrops for history cards, fullscreen description. Settings → «Тема оформления».
(function () {
  'use strict';

  if (window.__lampa_theme_loaded__) return;
  window.__lampa_theme_loaded__ = true;

  var KEY = 'lampa_theme_enabled';

  // @module theme-bake
  // Baking of the main background. Why: on the weak TV box (Mali-G31, WebView 158, 1080p) the GPU blends every full-screen layer on every frame.
  // Measured share of janky frames while scrolling a row: whole theme 69-71%; without the background CSS filter 53%; without the gradient layers 43-47%; no theme 18%.
  // So the filter and the .background:after gradients are painted once into the background canvases (after Lampa has drawn them) and the CSS layers are turned off.
  // shortcut: .lampa-bb-shade (billboard) is not baked: it sits outside .background (body child, z-index 0), so it is not dimmed by body.menu--open .background{opacity:.5} and it is hidden under search/settings/selectbox; baked in, it would change the picture. Revisit if the billboard moves into .background.
  // shortcut: only the TV/desktop path of Background.draw is hooked (last multiply fillRect, then fadeTo); the mobile path (destination-out, no fade) keeps the CSS layers.
  // shortcut: the hook trusts the Lampa core of tv-perf/C2-loader (canvases .background__one/__two, final multiply fillRect); another core layout needs a new hook point.
  var BAKE_KEY = 'lampa_theme_fast';
  var BG_FILTER = 'brightness(1.5) saturate(1.3)'; // the only copy: the CSS rule below and the canvas filter both use it
  // Must match the standard-syntax `.background:after` rule in CSS below (tools/theme-bake.test.mjs compares them). Layers top first, as CSS lists them; stops = [percent, alpha].
  var BG_GRAD = { rgb: '5,6,10', layers: [
    { deg: 90, stops: [[0, 0.85], [18, 0.5], [50, 0]] },
    { deg: 0, stops: [[0, 0.75], [25, 0.55], [45, 0.3], [62, 0]] },
    { deg: 180, stops: [[0, 0.5], [14, 0]] }
  ] };
  // not applied until the first bake: an empty canvas must keep the CSS gradients over the plain background colour
  var BAKE_CSS = '\nbody.lampa-theme--fast .background__one,body.lampa-theme--fast .background__two,body.lampa-theme--fast .background__fade{-webkit-filter:none;filter:none}' +
    '\nbody.lampa-theme--fast.lampa-theme--baked .background:after{display:none}\n';
  var bake = { on: false, hooked: false, broken: false, busy: false, tmp: null };

  // CSS gradient line (start and end points) of a w x h box for an angle in degrees, clockwise from up
  function gradLine(deg, w, h) {
    var r = deg * Math.PI / 180, dx = Math.sin(r), dy = -Math.cos(r), len = Math.abs(w * dx) + Math.abs(h * dy);
    return { x0: w / 2 - dx * len / 2, y0: h / 2 - dy * len / 2, x1: w / 2 + dx * len / 2, y1: h / 2 + dy * len / 2 };
  }

  // The gradients go in screen coordinates (vw x vh); the transform maps them onto a canvas of cw x ch that CSS stretches over the screen
  function bakeGrad(ctx, cw, ch, vw, vh) {
    var L = BG_GRAD.layers, i, j, p, g;
    ctx.save();
    ctx.setTransform(cw / vw, 0, 0, ch / vh, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    for (i = L.length - 1; i >= 0; i--) {
      p = gradLine(L[i].deg, vw, vh);
      g = ctx.createLinearGradient(p.x0, p.y0, p.x1, p.y1);
      for (j = 0; j < L[i].stops.length; j++) g.addColorStop(L[i].stops[j][0] / 100, 'rgba(' + BG_GRAD.rgb + ',' + L[i].stops[j][1] + ')');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, vw, vh);
    }
    ctx.restore();
  }

  // filter through a temporary canvas: drawImage canvas to canvas reads no pixels, so a CORS-tainted canvas is fine
  function bakeFilter(ctx, cw, ch) {
    var t = bake.tmp || (bake.tmp = document.createElement('canvas')), tc;
    t.width = cw;
    t.height = ch;
    tc = t.getContext('2d');
    tc.drawImage(ctx.canvas, 0, 0);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, cw, ch);
    ctx.filter = BG_FILTER;
    ctx.drawImage(t, 0, 0);
    ctx.restore();
    t.width = t.height = 0;
  }

  function bakeCanvas(ctx) {
    var c = ctx.canvas, vw = window.innerWidth, vh = window.innerHeight;
    if (!c.width || !c.height || !vw || !vh) return;
    bake.busy = true;
    try {
      bakeFilter(ctx, c.width, c.height);
      bakeGrad(ctx, c.width, c.height, vw, vh);
      document.body.classList.add('lampa-theme--baked');
    } catch (e) {
      bake.broken = true;
      setTimeout(bakeSync, 0);
    }
    bake.busy = false;
  }

  // Background.draw ends with exactly one fillRect in 'multiply' mode on the target canvas and then calls fadeTo, which starts reading the canvases
  // 2 frames + 80 ms later: baking inside that fillRect is once per draw (draw starts with clearRect) and before the canvas can be shown.
  function bakeHook() {
    if (bake.hooked) return true;
    var ctxs = [], names = ['one', 'two'], i, el;
    for (i = 0; i < names.length; i++) {
      el = document.querySelector('.background__' + names[i]);
      if (!el || !el.getContext) return false;
      ctxs.push(el.getContext('2d'));
    }
    ctxs.forEach(function (ctx) {
      var orig = ctx.fillRect;
      ctx.fillRect = function () {
        orig.apply(this, arguments);
        if (bake.on && !bake.busy && this.globalCompositeOperation === 'multiply') bakeCanvas(this);
      };
    });
    bake.hooked = true;
    return true;
  }

  function bakeWant() {
    var v = true, c, ok = false;
    try { v = String(Lampa.Storage.get(BAKE_KEY, 'true')) !== 'false'; } catch (e) {}
    if (!v || !isOn() || bake.broken) return false;
    if (/^(filter|grad|all)$/.test(diagVal())) return false; // DIAG-TEMP: those switches cancel the CSS layers, a baked copy would ignore them
    try { if (Lampa.Platform.screen('mobile') || Lampa.Storage.field('light_version')) return false; } catch (e) {}
    // without ctx.filter the CSS path stays
    try {
      c = document.createElement('canvas').getContext('2d');
      if (c && 'filter' in c) { c.filter = BG_FILTER; ok = c.filter !== 'none'; }
    } catch (e) {}
    return ok;
  }

  // On a change the current background is drawn again from the cached image (Background.update): the canvases get the new look, never baked twice
  function bakeSync() {
    if (!document.body) return;
    var on = bakeWant() && bakeHook();
    if (on === bake.on) return;
    bake.on = on;
    document.body.classList.toggle('lampa-theme--fast', on);
    if (!on) document.body.classList.remove('lampa-theme--baked');
    try { Lampa.Background.update(); } catch (e) {}
  }
  // @end theme-bake
  // @module theme-shadow
  // Why: measured on the TV, card shadows (blurred box-shadow, animated on focus) cost about 20 points of janky frames. In fast mode the blur is painted once into a sprite
  // and laid under the card as a 9-slice border-image on .card__view::before (no layout change: absolute, border-image-outset; not clipped: .card__view has no overflow).
  // Same stacking as box-shadow: after the focus ring (.card__view::after, z-index -1), before the poster. Sprite pixels per em = the card font size, all CSS lengths are in em.
  // shortcut: .card__view::before is the only free pseudo, so the focus shadow replaces the rest one at once with a 0.2 s opacity fade-in instead of the old box-shadow growth.
  // Numbers in em: copies of the box-shadow values of .card__view and .card.focus .card__view in CSS below (tools/theme-shadow.test.mjs compares them).
  var SHADOW = { r: 1.1, inset: 0.01, rest: { dy: 0.6, blur: 1.6, a: 0.55 }, focus: { dy: 1.4, blur: 3, a: 0.8 } };
  var shadow = { em: 0 };

  // sprite of a shadow: a rounded rect with the shadow drawn and the rect itself cut out (box-shadow paints nothing under the box); corner slices hold the whole arc, the stretched middle is wider than 6 sigma so the blur there is the full one
  function shadowSprite(s, em) {
    var pad = Math.ceil((s.dy + 1.5 * s.blur) * em - 1e-6), r = SHADOW.r * em, t = pad + Math.ceil(r - 1e-6), n = 2 * t + Math.ceil(3 * s.blur * em), c = document.createElement('canvas'), x = c.getContext('2d'), a = pad, b = n - pad;
    c.width = c.height = n;
    function path(k) {
      var l = a + k, h = b - k, q = r - k;
      x.beginPath();
      x.moveTo(l + q, l);
      x.arcTo(h, l, h, h, q);
      x.arcTo(h, h, l, h, q);
      x.arcTo(l, h, l, l, q);
      x.arcTo(l, l, h, l, q);
      x.closePath();
    }
    x.shadowColor = 'rgba(0,0,0,' + s.a + ')'; // canvas sigma = shadowBlur / 2, the same as CSS blur radius / 2
    x.shadowBlur = s.blur * em;
    x.shadowOffsetY = s.dy * em;
    x.fillStyle = '#000';
    path(0);
    x.fill();
    x.shadowColor = 'transparent';
    x.globalCompositeOperation = 'destination-out';
    path(SHADOW.inset * em); // cut slightly inside the poster edge (concentric); measured: 0 gives a bright rim, 1 px or more a dark one (the original box-shadow has a faint light AA rim), about 0.15 px matches best
    x.fill();
    return 'url(' + c.toDataURL() + ') ' + t + ' fill/' + t / em + 'em/' + pad / em + 'em';
  }

  function shadowCss(em) {
    var P = 'body.lampa-theme--shadow .card';
    return P + ' .card__view,' + P + '.focus .card__view{box-shadow:none;-webkit-transition:none;transition:none}' +
      P + ' .card__view:before{content:"";position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;border:0 solid transparent;border-image:' + shadowSprite(SHADOW.rest, em) + '}' +
      P + '.focus .card__view:before{border-image:' + shadowSprite(SHADOW.focus, em) + ';-webkit-animation:lampa-shadow-in .2s;animation:lampa-shadow-in .2s}' +
      '@-webkit-keyframes lampa-shadow-in{from{opacity:.5}}@keyframes lampa-shadow-in{from{opacity:.5}}';
  }

  function shadowSync() {
    var body = document.body, on = !!body && body.classList.contains('lampa-theme--fast') && !/^(shadow|all)$/.test(diagVal()), c, em, st; // DIAG-TEMP: the diag switch removes shadows
    if (on) {
      c = document.querySelector('.card') || body;
      em = parseFloat(window.getComputedStyle(c).fontSize) || 16;
      if (Math.abs(em - shadow.em) > shadow.em * 0.05) {
        try {
          st = document.getElementById('lampa-theme-shadow');
          if (!st) {
            st = document.createElement('style');
            st.id = 'lampa-theme-shadow';
            document.head.appendChild(st);
          }
          st.textContent = shadowCss(em);
          shadow.em = em;
        } catch (e) { on = false; }
      }
    }
    if (body) body.classList.toggle('lampa-theme--shadow', on && shadow.em > 0);
  }
  // @end theme-shadow
  var CSS = "\n/* body + .background: глубокий фон, бэкдроп виднее, сильная виньетка слева и снизу */\nbody{background:#07080c;font-family:\"SegoeUI\",\"Segoe UI\",Roboto,\"Helvetica Neue\",Arial,sans-serif;-webkit-font-smoothing:antialiased}\n.background{background:#07080c}\n.background__one,.background__two,.background__fade{-webkit-filter:" + BG_FILTER + ";filter:" + BG_FILTER + "}\n.background:after{content:\"\";position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;background:-webkit-linear-gradient(left,rgba(5,6,10,.85) 0,rgba(5,6,10,.5) 18%,rgba(5,6,10,0) 50%),-webkit-linear-gradient(bottom,rgba(5,6,10,.75) 0,rgba(5,6,10,.55) 25%,rgba(5,6,10,.3) 45%,rgba(5,6,10,0) 62%),-webkit-linear-gradient(top,rgba(5,6,10,.5) 0,rgba(5,6,10,0) 14%);background:linear-gradient(90deg,rgba(5,6,10,.85) 0,rgba(5,6,10,.5) 18%,rgba(5,6,10,0) 50%),linear-gradient(0deg,rgba(5,6,10,.75) 0,rgba(5,6,10,.55) 25%,rgba(5,6,10,.3) 45%,rgba(5,6,10,0) 62%),linear-gradient(180deg,rgba(5,6,10,.5) 0,rgba(5,6,10,0) 14%)}\n\n/* .head: прозрачная, верхний градиент */\n.head{background:-webkit-linear-gradient(top,rgba(5,6,10,.85),rgba(5,6,10,.7));background:linear-gradient(180deg,rgba(5,6,10,.85),rgba(5,6,10,.7))}\n.head:after{content:\"\";position:absolute;left:0;right:0;top:100%;height:3.2em;pointer-events:none;background:-webkit-linear-gradient(top,rgba(5,6,10,.7),rgba(5,6,10,0));background:linear-gradient(180deg,rgba(5,6,10,.7),rgba(5,6,10,0))}\n.head__title{font-size:1.5em;font-weight:700;letter-spacing:.01em;text-shadow:0 .1em .5em rgba(0,0,0,.6)}\n.head__time{padding:.45em 1em;border-radius:2em;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.08)}\n.head__time-now{font-size:1.25em;font-weight:700}\n.head__time-date{display:none}\n\n/* .wrap__left: стеклянная панель (ширину и сдвиг задаёт Lampa), фокус = белая пилюля */\n.wrap__left:before{content:\"\";position:absolute;z-index:-1;left:0;top:4em;bottom:0;width:100%;background:rgba(14,16,22,.82);border-right:1px solid rgba(255,255,255,.1);box-shadow:.3em 0 2em rgba(0,0,0,.5);-webkit-backdrop-filter:blur(1.2em);backdrop-filter:blur(1.2em)}\nbody.menu--open .wrap__left:before{width:15em}\n.menu__list{padding-left:.7em;padding-right:.7em}\n.menu__item{padding:.95em 1em;margin-bottom:.25em;border-radius:3em;color:rgba(255,255,255,.72);-webkit-transition:background-color .2s,color .2s;transition:background-color .2s,color .2s}\n.menu__item + li{margin-top:0}\n.menu__text{font-weight:500}\n.menu__item.focus,.menu__item.hover{background-color:#fff;color:#000;box-shadow:0 .5em 1.4em rgba(0,0,0,.5)}\n\n/* .items-line: крупные жирные заголовки с акцентной меткой, больше воздуха */\n.items-line{padding-bottom:1em}\n.items-line__head{margin-bottom:-.3em}\n.scroll--horizontal{padding-top:1.9em;padding-bottom:1em}\n.items-line__title{font-size:1.9em;font-weight:700;letter-spacing:.005em;text-shadow:0 .1em .5em rgba(0,0,0,.6)}\n.items-line__title:before{content:\"\";display:inline-block;width:.24em;height:.85em;margin-right:.5em;border-radius:.2em;background:#ffb020;vertical-align:-.08em;box-shadow:0 0 .8em rgba(255,176,32,.55)}\n.items-line__more{padding:.45em 1.2em;border-radius:2em;font-weight:600;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.08)}\n\n/* .card: радиус, тень, фокус = белое кольцо + scale + глубокая тень */\n.card{-webkit-transition:-webkit-transform .2s;transition:transform .2s}\n.card__view,.card__img{border-radius:1.1em}\n.card__view{box-shadow:0 .6em 1.6em rgba(0,0,0,.55);-webkit-transition:box-shadow .2s;transition:box-shadow .2s}\n.card__vote{right:.6em;bottom:.6em;font-size:1.1em;font-weight:700;padding:.2em .6em;border-radius:2em;background:rgba(5,6,10,.82);color:#fff;border:1px solid rgba(255,255,255,.16);text-shadow:none}\n.card__vote:before{content:\"\\2605\";margin-right:.3em;font-size:.9em;color:#ffb020}\n.card__quality{left:.6em;top:.6em;bottom:auto;font-size:.8em;font-weight:800;padding:.3em .7em;border-radius:2em;background:#ffb020;color:#000;letter-spacing:.03em}\n.card__icons-inner{background:rgba(5,6,10,.75)}\n.card__title{font-size:1.2em;font-weight:500;margin-top:.6em;color:rgba(255,255,255,.85);text-shadow:0 .1em .4em rgba(0,0,0,.8);-webkit-transition:opacity .2s;transition:opacity .2s}\n.card__age{color:rgba(255,255,255,.55);text-shadow:0 .1em .4em rgba(0,0,0,.8)}\n.items-line .card .card__type{display:none}\n.card.focus{-webkit-transform:scale(1.08);transform:scale(1.08)}\n.card.focus .card__view{box-shadow:0 1.4em 3em rgba(0,0,0,.8)}\n.card.focus .card__view:after{top:-.45em;left:-.45em;right:-.45em;bottom:-.45em;border-width:.28em;border-radius:1.55em}\n.card.focus .card__title{color:#fff;font-weight:700}\n.card.focus .card__age{color:rgba(255,255,255,.7)}\n\n/* .full-start__button + .simple-button: пилюли, фокус = белая заливка */\n.full-start__button,.simple-button{border-radius:3em;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.08);-webkit-transition:background-color .2s,color .2s;transition:background-color .2s,color .2s}\n.full-start__button{font-size:1.2em;height:2.6em;padding:.3em 1.4em;margin-right:.6em}\n.simple-button{font-size:1.2em;height:2.6em;padding:.3em 1.4em}\n.full-start__button.focus,.simple-button.focus{background-color:#fff;color:#000;box-shadow:0 .6em 1.6em rgba(0,0,0,.4)}\n\n/* .full-start-new + img.full-start__background: большой бэкдроп, диагональная маска */\n.full-start__background.loaded{opacity:1;-webkit-filter:brightness(1.1) saturate(1.2);filter:brightness(1.1) saturate(1.2);-webkit-mask-image:-webkit-linear-gradient(top right,#000 25%,rgba(0,0,0,0) 80%);-webkit-mask-image:linear-gradient(to bottom left,#000 25%,rgba(0,0,0,0) 80%);mask-image:linear-gradient(to bottom left,#000 25%,rgba(0,0,0,0) 80%)}\n.full-start-new__poster{border-radius:1.2em;box-shadow:0 1.5em 3.5em rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.08)}\n.full-start-new__head{font-size:1em;letter-spacing:.08em;text-transform:uppercase;opacity:.55}\n.full-start-new__title{font-size:3.6em;font-weight:800;line-height:1.05;letter-spacing:-.015em;-webkit-line-clamp:2;line-clamp:2;text-shadow:0 .1em .6em rgba(0,0,0,.6)}\n.full-start-new__tagline{font-style:italic;opacity:.65}\n.full-start__rate{padding:.4em 1em;border-radius:1.1em;background:rgba(5,6,10,.55);border:1px solid rgba(255,255,255,.12);font-size:1.1em}\n.full-start__rate>div:first-child{font-weight:800;font-size:1.1em}\n.full-start-new__reactions .reaction{background:rgba(5,6,10,.6);border:1px solid rgba(255,255,255,.1)}\n.rate--tmdb>div:first-child{color:#3ecbf5}\n.rate--kp>div:first-child{color:#ff9a3c}\n.rate--imdb>div:first-child{color:#f5c518}\n.source--name{text-transform:uppercase;letter-spacing:.06em;font-size:.7em}\n.full-start__pg,.full-start__status{border:1px solid rgba(255,255,255,.4);border-radius:.4em;font-size:1em}\n.full-start-new__details{opacity:.78}\n.full-start-new__buttons{margin-top:1.8em}\n\n/* .full-descr: стеклянная панель, фокус = белое кольцо */\n.full-descr__text{padding:1.2em 1.5em;border-radius:1.2em;background:rgba(10,12,18,.62);-webkit-backdrop-filter:blur(.8em);backdrop-filter:blur(.8em);border:1px solid rgba(255,255,255,.06);font-weight:400;color:rgba(255,255,255,.92);opacity:1;-webkit-transition:background-color .2s,box-shadow .2s;transition:background-color .2s,box-shadow .2s}\n.full-descr__text.focus{background:rgba(10,12,18,.78);box-shadow:inset 0 0 0 .28em #fff;-webkit-mask-image:none;mask-image:none}\n.full-descr__details{opacity:.5}\n\n/* .full-person: режиссёры и актёры, круглое фото, фокус = белая заливка как у кнопок */\n.full-person{padding:.6em 1.6em .6em .6em;margin-right:1em;border-radius:1.6em;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.06);-webkit-transition:-webkit-transform .2s,background-color .2s,box-shadow .2s;transition:transform .2s,background-color .2s,box-shadow .2s}\n.full-person__photo{width:6em;height:6em;border-radius:50%;box-shadow:0 .4em 1em rgba(0,0,0,.5)}\n.full-person__photo>img{height:100%;object-fit:cover}\n.full-person__photo>span{color:#333}\n.full-person__body{max-width:11em}\n.full-person__name,.full-person__role{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.full-person__name{font-size:1.25em;font-weight:600}\n.full-person__role{font-size:1em;margin-top:.5em;opacity:.55}\n.full-person.focus{-webkit-transform:scale(1.04);transform:scale(1.04);background-color:#fff;color:#000;box-shadow:0 1em 2.2em rgba(0,0,0,.55)}\n\n/* .items-line__title с иконкой (Lampa рисует его через .full-person--small): выглядит как обычный заголовок */\n.items-line__title{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center}\n.items-line__title .full-person,.items-line__title .full-person.focus{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;width:auto;font-size:1em;margin:0;padding:0;background:none;color:inherit;border:0;border-radius:0;box-shadow:none;-webkit-transform:none;transform:none;opacity:1}\n.items-line__title .full-person__photo{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center;width:1.15em;height:1.15em;min-width:0;margin:0 .45em 0 0;border-radius:50%;box-shadow:none;-webkit-flex-shrink:0;flex-shrink:0}\n.items-line__title .full-person--svg .full-person__photo{padding:0!important}.items-line__title .full-person--svg .full-person__photo svg{width:.68em!important;height:.68em!important}\n.items-line__title .full-person__body{font-size:1em;padding:0;margin:0;max-width:none}\n.items-line__title .full-person__name{font-size:1em;font-weight:inherit;line-height:inherit;letter-spacing:inherit;margin:0;white-space:nowrap;overflow:visible}\n.items-line__title .full-person__role{display:none}\n\n/* .full-episode + .time-line: стеклянные строки, акцентный прогресс */\n.full-episode{border-radius:1.2em;background:rgba(255,255,255,.06);box-shadow:0 .5em 1.4em rgba(0,0,0,.35);-webkit-transition:-webkit-transform .2s,background-color .2s;transition:transform .2s,background-color .2s}\n.full-episode__img{border-radius:1.2em 0 0 1.2em}\n.full-episode__num{display:inline-block;padding:.2em .6em;border-radius:2em;background:rgba(255,176,32,.2);color:#ffd27a;font-weight:700;opacity:1;font-size:.8em;letter-spacing:.04em;text-transform:uppercase}\n.full-episode__name{font-size:1.25em;font-weight:600}\n.full-episode__date{opacity:.45}\n.time-line{height:.3em;background:rgba(255,255,255,.18)}\n.time-line>div{background:#ffb020}\n.full-episode.focus{-webkit-transform:scale(1.025);transform:scale(1.025);background:rgba(255,255,255,.12)}\n.full-episode.focus:after{border-width:.25em;border-radius:1.5em}\n.torrent-filter{padding-bottom:1.5em}\n\n/* .selectbox: только цвета и фокус, позицию и анимацию выезда задаёт Lampa */\n.selectbox__layer{background:rgba(0,0,0,.55)}\n.selectbox__content{background:rgba(16,18,24,.94);box-shadow:-2em 0 4em rgba(0,0,0,.5);border-left:1px solid rgba(255,255,255,.08)}\n.selectbox__title{font-weight:700}\n.selectbox-item{margin:0 1em .3em;border-radius:1em;-webkit-transition:background-color .2s,color .2s;transition:background-color .2s,color .2s}\n.selectbox-item.focus{background-color:#fff;color:#000}\n.selectbox-item.focus.selected:after{border-color:#000}\n\n/* .online-mod-variants: только отступы и цвета, структура и белый фокус пользователя сохранены */\n.online-mod-variants__still{border-radius:1.3em;box-shadow:0 1.5em 3.5em rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.08)}\n.online-mod-variants__still-bar{height:.3em}\n.online-mod-variants__still-bar i{background:#ffb020}\n.online-mod-variants__title{letter-spacing:-.01em}\n.online-mod-variants__stats>div{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.06)}\n.online-mod-variants__colhead{padding-bottom:1em}\n.online-mod-variants__resume{background:rgba(255,176,32,.16);border:1px solid rgba(255,176,32,.3)}\n.online-mod-variant{margin-bottom:.6em;border-radius:1em;background:rgba(255,255,255,.07);box-shadow:inset 0 0 0 1px rgba(255,255,255,.05)}\n.online-mod-variants__voice{border-radius:.8em;background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.09)}\n.online-mod-variants__util{background:rgba(255,255,255,.08)}\n\n/* описание на весь экран: модалка с классом lampa-descr-modal (ставит JS ниже) */\n.modal.lampa-descr-modal{padding:0;background:rgba(5,6,10,.72);-webkit-backdrop-filter:blur(1.4em);backdrop-filter:blur(1.4em)}\n.modal.lampa-descr-modal .modal__content{max-width:60em;width:100%;background:transparent;padding:0 2em;border-radius:0}\n.lampa-descr-full{font-size:1.3em;line-height:1.6;font-weight:300;padding:3em 0}\n\n\n/* .full-start-new: hero внизу-слева, фон открыт; постер маленький (вкл/выкл в настройках) */\nbody .full-start-new{position:relative;min-height:calc(100vh - 6.5em);box-sizing:border-box;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:end;-webkit-align-items:flex-end;align-items:flex-end;padding-bottom:2.5em;\nbackground:-webkit-radial-gradient(0% 100%,ellipse farthest-side,rgba(5,6,10,.92) 0%,rgba(5,6,10,.6) 45%,rgba(5,6,10,0) 100%);\nbackground:radial-gradient(ellipse 75% 85% at 0% 100%,rgba(5,6,10,.92) 0%,rgba(5,6,10,.6) 45%,rgba(5,6,10,0) 100%)}\nbody .full-start-new__body{-webkit-box-flex:1;-webkit-flex:1 1 auto;flex:1 1 auto;-webkit-box-align:end;-webkit-align-items:flex-end;align-items:flex-end}\nbody .full-start-new__right{max-width:46em;width:100%}\nbody .full-start__background.loaded,body .full-start__background{-webkit-mask-image:-webkit-linear-gradient(top,#000 62%,rgba(0,0,0,0) 100%);mask-image:linear-gradient(to bottom,#000 62%,rgba(0,0,0,0) 100%);filter:none}\nbody .full-start-new__rate-line{margin:0 0 .9em;-webkit-flex-wrap:wrap;flex-wrap:wrap;-webkit-box-align:center;-webkit-align-items:center;align-items:center}\nbody .full-start-new__rate-line .full-start__rate{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-orient:horizontal;-webkit-box-direction:reverse;-webkit-flex-direction:row-reverse;flex-direction:row-reverse;-webkit-box-align:center;-webkit-align-items:center;align-items:center;background:none!important;border:0!important;box-shadow:none!important;padding:0!important;margin:0 1.1em 0 0!important;font-size:1.05em;font-weight:600}\nbody .full-start-new__rate-line .full-start__rate>div{margin:0!important;padding:0!important;background:none!important}\nbody .full-start-new__rate-line .full-start__rate .rate--icon{width:1em;height:1em;margin:0 .35em 0 0!important;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center}\nbody .full-start-new__rate-line .full-start__rate .rate--icon svg,body .full-start-new__rate-line .full-start__rate .rate--icon img{width:1em!important;height:1em!important;max-width:1em;max-height:1em}\nbody .full-start-new__rate-line .full-start__pg,body .full-start-new__rate-line .full-start__status{font-size:.75em;padding:.15em .6em;margin:0 .8em 0 0;border-radius:.4em;opacity:.8}\nbody .full-start-new__details{margin-bottom:.8em}\nbody .full-start-new__reactions{display:none}\nbody .full-start-new__buttons{margin-top:1.2em}\nbody .full-start-new__buttons .full-start__button{padding-left:.6em;padding-right:.6em;margin-right:0}\nbody .full-start-new__buttons .full-start__button:first-child{padding-left:1.2em;padding-right:1.2em}\nbody .full-start-new__title{font-size:4.2em}\nbody .full-start__background{left:0!important;width:100%;-webkit-transition:opacity .4s;transition:opacity .4s}\nbody.lampa-theme--card-down .full-start__background.loaded{opacity:.28!important}\n@media (min-width:900px){\nbody .full-start-new__left{display:block;-webkit-box-flex:0;-webkit-flex:0 0 auto;flex:0 0 auto;width:12em;margin:0 2em 0 0;-webkit-align-self:flex-end;align-self:flex-end}\nbody .full-start-new__left .full-start-new__poster{width:100%;margin:0;border-radius:1em;overflow:visible;-webkit-box-shadow:0 .6em 2em rgba(0,0,0,.55);box-shadow:0 .6em 2em rgba(0,0,0,.55)}\nbody .full-start-new__left .full-start-new__img{display:block;width:100%;height:auto;border-radius:1em}\n}\n";

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
      el.appendChild(document.createTextNode(CSS + BAKE_CSS));
      document.head.appendChild(el);
    }
    el.disabled = !isOn();

    var np = document.getElementById('lampa-theme-noposter');
    if (!np) {
      np = document.createElement('style');
      np.id = 'lampa-theme-noposter';
      np.appendChild(document.createTextNode('@media (min-width:900px){body .full-start-new__left{display:none!important}}'));
      document.head.appendChild(np);
    }
    var poster = true;
    try { if (window.Lampa && Lampa.Storage) poster = String(Lampa.Storage.get('lampa_theme_poster', 'true')) !== 'false'; } catch (e) {}
    np.disabled = !(isOn() && !poster);
    if (!isOn() && document.body) document.body.classList.remove('lampa-theme--card-down');
    bbSync();
    bakeSync();
    shadowSync();
    diagApply(); // DIAG-TEMP
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
    Lampa.SettingsApi.addParam({
      component: 'lampa_theme',
      param: { name: 'lampa_theme_poster', type: 'trigger', default: true },
      field: { name: 'Постер на карточке', description: 'Маленький постер рядом с названием' },
      onChange: apply
    });
    Lampa.SettingsApi.addParam({
      component: 'lampa_theme',
      param: { name: 'lampa_theme_billboard', type: 'trigger', default: true },
      field: { name: 'Афиша на главной', description: 'Описание и рейтинги выбранной карточки над рядами' },
      onChange: apply
    });
    Lampa.SettingsApi.addParam({
      component: 'lampa_theme',
      param: { name: BAKE_KEY, type: 'trigger', default: true },
      field: { name: 'Оптимизация отрисовки', description: 'Яркость и затемнение фона запекаются в картинку: плавнее прокрутка на слабых ТВ-приставках' },
      onChange: apply
    });
    // DIAG-TEMP begin
    Lampa.SettingsApi.addParam({
      component: 'lampa_theme',
      param: {
        name: DIAG_KEY,
        type: 'select',
        values: { off: 'Выкл', mask: 'Без маски прокрутки', shadow: 'Без теней карточек', filter: 'Без фильтра фона', backdrop: 'Без размытия', grad: 'Без градиентных слоёв', radius: 'Без скруглений и рамки фокуса', bgfast: 'Без быстрой смены фона', all: 'Без всего перечисленного' },
        default: 'off'
      },
      field: { name: 'Диагностика (временно)', description: 'Отключает части оформления для замера производительности на ТВ' },
      onChange: apply
    });
    // DIAG-TEMP end
  }

  // DIAG-TEMP begin
  // Each group cancels theme rules only; classes sit on body, selectors repeat the originals with one more class (billboard rules are injected later with !important).
  var DIAG_KEY = 'lampa_theme_diag';
  var DIAG_GROUPS = ['mask', 'shadow', 'filter', 'backdrop', 'grad', 'radius'];
  var DIAG_CSS = [
    // mask: theme mask-image on the card page backdrop and on the billboard row scroller
    'body.lampa-theme-diag--mask .full-start__background.loaded,body.lampa-theme-diag--mask .full-start__background{-webkit-mask-image:none!important;mask-image:none!important}',
    'body.lampa-theme-diag--mask.lampa-theme--billboard .activity--active .activity__body>div>.scroll{-webkit-mask-image:none!important;mask-image:none!important}',
    // shadow: card and row-title shadows, focus shadow and the box-shadow transition
    'body.lampa-theme-diag--shadow .card__view,body.lampa-theme-diag--shadow .card.focus .card__view{box-shadow:none!important;-webkit-transition:none!important;transition:none!important}',
    'body.lampa-theme-diag--shadow .card__title,body.lampa-theme-diag--shadow .card__age,body.lampa-theme-diag--shadow .items-line__title{text-shadow:none!important}',
    'body.lampa-theme-diag--shadow .items-line__title:before{box-shadow:none!important}',
    // filter: brightness/saturate on the background layers and the card page backdrop
    'body.lampa-theme-diag--filter .background__one,body.lampa-theme-diag--filter .background__two,body.lampa-theme-diag--filter .background__fade,body.lampa-theme-diag--filter .full-start__background.loaded,body.lampa-theme-diag--filter .full-start__background{-webkit-filter:none!important;filter:none!important}',
    // backdrop: every backdrop-filter of the theme
    'body.lampa-theme-diag--backdrop .wrap__left:before,body.lampa-theme-diag--backdrop .full-descr__text,body.lampa-theme-diag--backdrop .modal.lampa-descr-modal{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}',
    // grad: fullscreen gradient layers
    'body.lampa-theme-diag--grad .background:after,body.lampa-theme-diag--grad .lampa-bb-shade{display:none!important}',
    'body.lampa-theme-diag--grad .full-start-new{background:none!important}',
    // radius: card rounding, the theme focus-ring geometry and the focus scale
    'body.lampa-theme-diag--radius .card__view,body.lampa-theme-diag--radius .card__img{border-radius:0!important}',
    'body.lampa-theme-diag--radius .card.focus .card__view:after{border-radius:0!important}',
    'body.lampa-theme-diag--radius .card.focus,body.lampa-theme-diag--radius .full-person.focus,body.lampa-theme-diag--radius .full-episode.focus{-webkit-transform:none!important;transform:none!important}',
    'body.lampa-theme-diag--radius .card{-webkit-transition:none!important;transition:none!important}'
  ].join('\n');

  function diagVal() {
    var v = 'off';
    try { if (window.Lampa && Lampa.Storage) v = String(Lampa.Storage.get(DIAG_KEY, 'off')); } catch (e) {}
    return v;
  }

  function diagApply() {
    if (!document.body || !document.head) return;
    var st = document.getElementById('lampa-theme-diag-css');
    if (!st) {
      st = document.createElement('style');
      st.id = 'lampa-theme-diag-css';
      st.appendChild(document.createTextNode(DIAG_CSS));
      document.head.appendChild(st);
    }
    var v = isOn() ? diagVal() : 'off';
    for (var i = 0; i < DIAG_GROUPS.length; i++) document.body.classList.toggle('lampa-theme-diag--' + DIAG_GROUPS[i], v === DIAG_GROUPS[i] || v === 'all');
  }
  // DIAG-TEMP end

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
      if (diagVal() === 'bgfast' || diagVal() === 'all') { latest = ''; clearTimeout(timer); return origChange.call(B, url); } // DIAG-TEMP
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

  // Copies into card only the fields it lacks; r is a TMDB details response.
  function fillCard(card, r) {
    ['backdrop_path', 'overview', 'vote_average', 'release_date', 'first_air_date', 'number_of_seasons', 'number_of_episodes', 'runtime'].forEach(function (k) {
      if (!card[k] && r[k]) card[k] = r[k];
    });
    if (!card.runtime && r.episode_run_time && r.episode_run_time[0]) card.runtime = r.episode_run_time[0];
    if (!(card.genres && card.genres.length) && r.genres && r.genres.length) card.genres = r.genres;
    return card;
  }

  // TMDB details of history cards, keyed media+id. They live here, not in Lampa's card objects: those get saved back to storage.
  var details = {};

  // a copy of the card with the cached details filled in
  function bbMerge(card) {
    var d = {}, k;
    for (k in card) if (Object.prototype.hasOwnProperty.call(card, k)) d[k] = card[k];
    return fillCard(d, details[(card.name ? 'tv' : 'movie') + card.id] || {});
  }

  // Lampa stores history cards trimmed (no backdrop, overview, genres, sometimes no rating): fetch the details from TMDB on focus.
  // Only backdrop_path is written into the card (Lampa reads it for the background); the rest is merged at billboard render time.
  function fixBackdrops() {
    var pending = {};
    document.addEventListener('hover:focus', function (e) {
      var el = e.target, card = el && el.classList && el.classList.contains('card') && el.card_data;
      if (!card || !isOn() || (card.backdrop_path && (card.overview || !bbEnabled())) || !/^\d+$/.test(String(card.id))) return;
      if (card.source !== 'tmdb' && card.source !== 'cub') return;
      if (!window.Lampa || !Lampa.Reguest || !Lampa.TMDB || !Lampa.Utils) return;
      var media = card.name ? 'tv' : 'movie', key = media + card.id;
      if (key in details) {
        if (!card.backdrop_path && details[key].backdrop_path) card.backdrop_path = details[key].backdrop_path;
        return;
      }
      if (pending[key]) return;
      pending[key] = true;
      new Lampa.Reguest().silent(Lampa.TMDB.api(media + '/' + card.id + '?language=' + Lampa.Storage.get('language', 'ru') + '&api_key=' + Lampa.TMDB.key()), function (r) {
        delete pending[key];
        details[key] = fillCard({}, r || {});
        var noBg = !card.backdrop_path;
        if (noBg && details[key].backdrop_path) card.backdrop_path = details[key].backdrop_path;
        if (!el.classList.contains('focus')) return;
        if (noBg && card.backdrop_path && Lampa.Background) Lampa.Background.change(Lampa.Utils.cardImgBackgroundBlur(card));
        bbRefresh(card);
      }, function () {
        delete pending[key];
        details[key] = {};
      });
    }, true);
  }

  // Billboard: title, meta, ratings and overview of the focused card above the rows of home/catalog screens.
  var BB_IDS = [28, 12, 16, 35, 80, 99, 18, 10751, 14, 36, 27, 10402, 9648, 10749, 878, 10770, 53, 10752, 37, 10759, 10762, 10763, 10764, 10765, 10766, 10767, 10768];
  // shortcut: genre names only ru/en; other languages get English, add maps if asked
  var BB_NAMES = {
    ru: 'Боевик|Приключения|Мультфильм|Комедия|Криминал|Документальный|Драма|Семейный|Фэнтези|История|Ужасы|Музыка|Детектив|Мелодрама|Фантастика|ТВ фильм|Триллер|Военный|Вестерн|Боевик и приключения|Детский|Новости|Реалити|НФ и фэнтези|Мыльная опера|Ток-шоу|Война и политика',
    en: 'Action|Adventure|Animation|Comedy|Crime|Documentary|Drama|Family|Fantasy|History|Horror|Music|Mystery|Romance|Sci-Fi|TV Movie|Thriller|War|Western|Action & Adventure|Kids|News|Reality|Sci-Fi & Fantasy|Soap|Talk|War & Politics'
  };
  var bb = { root: null, shade: null, style: null, timer: 0, last: null, on: false, genres: {}, kp: {}, sh: {}, cacheAt: 0, rt1: 0, rt2: 0 };

  function bbQ(s, c) { return (c || document).querySelector(s); }

  // closest() is needed to find the focused card; without it the rows must not shrink
  function bbEnabled() {
    var v = true;
    try { v = String(Lampa.Storage.get('lampa_theme_billboard', 'true')) !== 'false'; } catch (e) {}
    return isOn() && v && !!document.documentElement.closest;
  }

  function bbBuild() {
    var H = window.innerHeight, head = (bbQ('.head') || {}).offsetHeight || 66;
    var bottom = Math.round(H * 0.45), rows = bottom - 34;
    var act = bbQ('.activity--active');
    var actTop = act ? act.getBoundingClientRect().top : head;
    var t = bbQ('.activity--active .items-line__title');
    var left = t ? Math.round(t.getBoundingClientRect().left) : 112;
    if (left < 90 || left > 300) left = 112;
    // the rows area ends right after one (shrunk) row, so the next row's title never peeks in at any window height
    // rows differ by a few px (caption lines): take the shortest, so a taller row loses only its last blank pixels to the fade
    var lines = bb.on ? document.querySelectorAll('.activity--active .items-line') : [], m = 0, h = H - rows - 34;
    for (var i = 0; i < lines.length && i < 8; i++) if (lines[i].offsetHeight && (!m || lines[i].offsetHeight < m)) m = lines[i].offsetHeight;
    if (m) h = Math.min(h, m + 41);
    h = Math.max(80, h);
    var B = 'body.lampa-theme--billboard ';
    bb.style.textContent =
      '.lampa-bb,.lampa-bb-shade{display:none}' +
      B + '.lampa-bb-shade{display:block}' +
      '.lampa-bb-shade{position:fixed;left:0;top:0;right:0;bottom:0;z-index:0;pointer-events:none;' +
      'background:-webkit-linear-gradient(left,rgba(8,10,16,.92) 0%,rgba(8,10,16,.7) 38%,rgba(8,10,16,0) 78%),' +
      '-webkit-linear-gradient(top,rgba(8,10,16,.55) 0%,rgba(8,10,16,0) 25%,rgba(8,10,16,0) 38%,rgba(8,10,16,.88) 62%,rgba(8,10,16,.95) 100%);' +
      'background:linear-gradient(to right,rgba(8,10,16,.92) 0%,rgba(8,10,16,.7) 38%,rgba(8,10,16,0) 78%),' +
      'linear-gradient(to bottom,rgba(8,10,16,.55) 0%,rgba(8,10,16,0) 25%,rgba(8,10,16,0) 38%,rgba(8,10,16,.88) 62%,rgba(8,10,16,.95) 100%)}' +
      '.lampa-bb{position:fixed;z-index:3;pointer-events:none;left:' + left + 'px;top:' + head + 'px;height:' + (rows + 12 - head) + 'px;width:46em;max-width:60%;' +
      '-webkit-flex-direction:column;flex-direction:column;-webkit-justify-content:flex-end;justify-content:flex-end}' +
      B + '.lampa-bb{display:-webkit-flex;display:flex}' +
      '.lampa-bb__in{padding-bottom:.4em;-webkit-transition:opacity .22s ease,-webkit-transform .22s ease;transition:opacity .22s ease,transform .22s ease}' +
      '.lampa-bb--out .lampa-bb__in{opacity:0;-webkit-transform:translateY(10px);transform:translateY(10px)}' +
      '.lampa-bb__chip{display:inline-block;font-size:.72em;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#fff;background:rgba(255,255,255,.16);border-radius:.4em;padding:.35em .8em;margin-bottom:.9em}' +
      '.lampa-bb__title{font-size:2.2em;font-weight:800;line-height:1.08;color:#fff;text-shadow:0 2px 16px rgba(0,0,0,.55);margin-bottom:.28em;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}' +
      '.lampa-bb__meta{font-size:.95em;color:rgba(255,255,255,.62);margin-bottom:.35em;font-weight:500}' +
      '.lampa-bb__rate{font-size:.9em;font-weight:600;color:rgba(255,255,255,.9);margin-bottom:.8em;min-height:1.3em}' +
      '.lampa-bb__r{margin-right:1.3em}.lampa-bb__r i{font-style:normal;font-weight:800;margin-right:.15em}' +
      '.lampa-bb__text{font-size:1.05em;line-height:1.5;color:rgba(255,255,255,.85);overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;max-width:42em}' +
      B + '.activity--active .activity__body>div>.scroll{margin-top:' + Math.max(0, Math.round(rows - actTop)) + 'px !important;height:' + h + 'px !important;' +
      '-webkit-mask-image:-webkit-linear-gradient(top,rgba(0,0,0,0) 0,rgba(0,0,0,0) 36px,#000 56px,#000 ' + (h - 24) + 'px,rgba(0,0,0,0) ' + h + 'px) !important}' +
      'body.search--open .lampa-bb,body.search--open .lampa-bb-shade,body.settings--open .lampa-bb,body.settings--open .lampa-bb-shade,body.selectbox--open .lampa-bb,body.selectbox--open .lampa-bb-shade{display:none !important}' +
      B + '.activity--active .items-line .card{font-size:' + (H > 700 ? '.68em' : '.6em') + '}' +
      B + '.activity--active .items-line .card .card__title{-webkit-line-clamp:2 !important;overflow:hidden !important}';
  }

  // The rows area is shrunk only on screens made of .items-line rows; the class is set by every focus event and by apply()
  function bbSync() {
    if (!bb.root) return false;
    var a = bbQ('.activity--active');
    var comp = '';
    try { comp = (Lampa.Activity.active() || {}).component; } catch (e) {}
    // only the home and the section pages are made of rows; category_full, actor, bookmarks etc. are grids or lists
    var on = bbEnabled() && (comp === 'main' || comp === 'category') && !!(a && bbQ('.items-line', a));
    if (on !== bb.on) {
      bb.on = on;
      bb.last = null;
      if (on) bbCaches(true);
      document.body.classList.toggle('lampa-theme--billboard', on);
      if (on) bbBuild();
      // the rows change height with the class, but Lampa has already scrolled for the old height (stale offset, e.g. back from a card page): make it realign the focused row
      try { Lampa.Activity.active().activity.resize(); } catch (e) {}
      var c = on && bbQ('.activity--active .items-line .card.focus');
      if (c) bbOnFocus({ target: c });
    }
    return on;
  }

  // shortcut: ratings appear only for titles whose card page was opened before (plugins fill the caches there); prefetch would need the plugins' APIs
  function bbCache(k) {
    try {
      var o = Lampa.Storage.get(k, '{}');
      if (typeof o === 'string') o = JSON.parse(o);
      return o && typeof o === 'object' ? o : {};
    } catch (e) { return {}; }
  }

  // the caches can be large; re-read them at most every 30 s
  function bbCaches(force) {
    var now = Date.now();
    if (!force && now - bb.cacheAt < 30000) return;
    bb.kp = bbCache('kp_rating');
    bb.sh = bbCache('shikimori_rating');
    bb.cacheAt = now;
  }

  function bbRatings(d, tv) {
    bbCaches();
    var kp = bb.kp[d.id] || {}, sh = bb.sh['tmdb_' + (tv ? 'tv' : 'movie') + '_' + d.id] || {};
    var list = [
      ['★', '#ffc83d', d.vote_average],
      ['КП', '#ff7a1a', kp.kp || d.kp_rating],
      ['IMDb', '#f5c518', kp.imdb || d.imdb_rating],
      ['Shiki', '#7fa8ff', sh.s]
    ], out = [];
    list.forEach(function (r) {
      var v = parseFloat(r[2]);
      if (v > 0) out.push('<span class="lampa-bb__r"><i style="color:' + r[1] + '">' + r[0] + '</i> ' + v.toFixed(1) + '</span>');
    });
    return out.join('');
  }

  // shown only when TMDB has no overview either
  function bbFallback(d) {
    var p = [];
    if (d.number_of_seasons) p.push('S' + d.number_of_seasons + (d.number_of_episodes ? ' · ' + d.number_of_episodes + ' ep.' : ''));
    else if (d.runtime) p.push(d.runtime + ' min');
    if (d.status) p.push(d.status);
    return p.join(' · ');
  }

  // TMDB/Lampa texts can arrive HTML-escaped; they go in via textContent, so decode the common entities (&amp; last, no double decoding)
  function bbText(s) {
    return String(s == null ? '' : s).replace(/&nbsp;/g, '\u00a0').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&');
  }

  function bbArr(v) { return Object.prototype.toString.call(v) === '[object Array]' ? v : []; }

  function bbMeta(d) {
    var meta = [], date = String(d.release_date || d.first_air_date || '');
    if (date) meta.push(date.slice(0, 4));
    var g = (bbArr(d.genres).length ? bbArr(d.genres).map(function (x) { return x && x.name; }) : bbArr(d.genre_ids).map(function (i) { return bb.genres[i]; })).filter(Boolean).slice(0, 3);
    if (g.length) meta.push(g.join(', '));
    return meta.join(' \u00a0·\u00a0 ');
  }

  function bbRender(card) {
    var d = bbMerge(card);
    var tv = !!(d.name || d.first_air_date || d.number_of_seasons || d.media_type === 'tv');
    bbQ('.lampa-bb__chip', bb.root).textContent = Lampa.Lang.translate(tv ? 'menu_tv' : 'menu_movies');
    bbQ('.lampa-bb__title', bb.root).textContent = bbText(d.title || d.name);
    bbQ('.lampa-bb__meta', bb.root).textContent = bbText(bbMeta(d));
    // innerHTML is safe here: bbRatings builds the markup only from constants and toFixed() numbers
    bbQ('.lampa-bb__rate', bb.root).innerHTML = bbRatings(d, tv);
    bbQ('.lampa-bb__text', bb.root).textContent = bbText(d.overview || bbFallback(d));
  }

  // fixBackdrops cached the details after the billboard drew the card
  function bbRefresh(d) {
    if (bb.root && bb.on && bb.last === d) bbRender(d);
  }

  // Lampa marks its overlays with these body classes; the CSS hides the billboard under them
  function bbOverlay() {
    var c = document.body.classList;
    return c.contains('search--open') || c.contains('settings--open') || c.contains('selectbox--open');
  }

  function bbOnFocus(e) {
    var el = e.target;
    if (!el || !el.closest || !bbSync() || el.closest('.search') || bbOverlay()) return;
    var card = el.closest('.items-line .card'), d = card && card.card_data;
    if (!d || d === bb.last) return;
    bb.last = d;
    clearTimeout(bb.timer);
    bb.timer = setTimeout(function () {
      bb.root.classList.add('lampa-bb--out');
      setTimeout(function () { bbRender(d); bb.root.classList.remove('lampa-bb--out'); }, 160);
    }, 120);
  }

  function bbRebuild() {
    if (!bb.on) return;
    bbBuild();
    try { Lampa.Activity.active().activity.resize(); } catch (e) {}
  }

  function bbResize() {
    clearTimeout(bb.rt1);
    clearTimeout(bb.rt2);
    bb.rt1 = setTimeout(bbRebuild, 100);
    bb.rt2 = setTimeout(bbRebuild, 600);
  }

  function bbInit() {
    if (bb.root) return;
    var n = BB_NAMES[Lampa.Storage.get('language', 'ru') === 'ru' ? 'ru' : 'en'].split('|');
    for (var i = 0; i < BB_IDS.length; i++) bb.genres[BB_IDS[i]] = n[i];
    bb.style = document.createElement('style');
    bb.style.id = 'lampa-theme-billboard-css';
    bb.shade = document.createElement('div');
    bb.shade.className = 'lampa-bb-shade';
    bb.root = document.createElement('div');
    bb.root.className = 'lampa-bb lampa-bb--out';
    bb.root.innerHTML = '<div class="lampa-bb__in"><div class="lampa-bb__chip"></div><div class="lampa-bb__title"></div><div class="lampa-bb__meta"></div><div class="lampa-bb__rate"></div><div class="lampa-bb__text"></div></div>';
    document.head.appendChild(bb.style);
    document.body.appendChild(bb.shade);
    document.body.appendChild(bb.root);
    document.addEventListener('hover:focus', bbOnFocus, true);
    // resize_end comes after Lampa has rescaled the font; the window event is a fallback. One timer pair serves both, and a second
    // rebuild follows because the rows keep settling after the rescale.
    if (Lampa.Listener) Lampa.Listener.follow('resize_end', bbResize);
    window.addEventListener('resize', bbResize);
    if (Lampa.Listener) Lampa.Listener.follow('resize_end', shadowSync);
  }

  function ready() {
    patchBackground();
    fixBackdrops();
    bbInit();
    document.addEventListener('hover:enter', function (e) {
      var t = e.target;
      if (t && t.classList && t.classList.contains('full-descr__text')) openDescr.call(t);
    }, true);
    // the card's backdrop stays bright on its first screen and dims once the focus moves down to the description, episodes, actors
    document.addEventListener('hover:focus', function (e) {
      var t = e.target, act = t && t.closest ? t.closest('.activity') : null;
      var down = isOn() && !!act && !!act.querySelector('.full-start-new') && !t.closest('.full-start-new');
      document.body.classList.toggle('lampa-theme--card-down', down);
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

(function () {
  'use strict';

  if (window.buttons_fix_plugin_ready) return;
  window.buttons_fix_plugin_ready = true;

  // buttons stay in one row and scroll horizontally.
  $('head').append('<style>'
    + '.full-start-new__left{align-self:flex-start !important}'
    + '.full-start-new__buttons,.full-start__buttons{display:flex !important;flex-wrap:nowrap !important;overflow-x:auto !important;overflow-y:hidden !important;scrollbar-width:none !important;position:relative !important;scroll-behavior:smooth !important;padding:.6em .8em 1.2em !important;margin-top:1.2em !important;margin-bottom:-1.2em !important}'
    + '.full-start-new__buttons::-webkit-scrollbar,.full-start__buttons::-webkit-scrollbar{display:none !important}'
    + '.full-start-new__buttons>*,.full-start__buttons>*{flex-shrink:0 !important}'
    + '.full-start-new__buttons .full-start__button,.full-start__buttons .full-start__button,.full-start-new__buttons .full-start__button span,.full-start__buttons .full-start__button span{white-space:nowrap !important}'
    + '.full-start-new__buttons.has-overflow-right,.full-start__buttons.has-overflow-right{-webkit-mask-image:linear-gradient(to right,#000 72%,transparent 100%) !important;mask-image:linear-gradient(to right,#000 72%,transparent 100%) !important}'
    + '</style>');

  function fixRow(row) {
    if (!row || !row.style) return;
    row.style.setProperty('display', 'flex', 'important');
    row.style.setProperty('flex-wrap', 'nowrap', 'important');
    row.style.setProperty('overflow-x', 'auto', 'important');
    row.style.setProperty('overflow-y', 'hidden', 'important');
    if (!row._fadeBound) {
      row._fadeBound = true;
      row.addEventListener('scroll', function () { updateFade(row); }, { passive: true });
    }
    updateFade(row);
  }

  function updateFade(row) {
    if (!row) return;
    var more = row.scrollLeft + row.clientWidth < row.scrollWidth - 2;
    if (more) row.classList.add('has-overflow-right');
    else row.classList.remove('has-overflow-right');
  }

  function reveal(row, el) {
    if (!row || !el) return;
    fixRow(row);
    var l = el.offsetLeft, r = l + el.offsetWidth;
    if (l - 16 < row.scrollLeft) row.scrollLeft = l - 16;
    else if (r + 16 > row.scrollLeft + row.clientWidth) row.scrollLeft = r - row.clientWidth + 16;
    // update fade after the (smooth) scroll settles
    setTimeout(function () { updateFade(row); }, 250);
    updateFade(row);
  }

  // Buttons stay in one row and scroll horizontally, so left/right walks them in order.
  function step(html, d) {
    var row = $(html).find('.full-start-new__buttons, .full-start__buttons').first();
    if (!row.length) return false;
    fixRow(row[0]);
    var all = row.find('.selector').filter(function () {
      return this.offsetParent !== null && !this.classList.contains('hide');
    });
    var i = all.index(all.filter('.focus'));
    if (i < 0 || i + d < 0 || i + d >= all.length) return false;
    Lampa.Controller.collectionFocus(all[i + d], html);
    reveal(row[0], all[i + d]);
    return true;
  }

  $(document).on('hover:focus', '.full-start-new__buttons .selector, .full-start__buttons .selector', function () {
    var row = $(this).closest('.full-start-new__buttons, .full-start__buttons')[0];
    reveal(row, this);
  });

  // Fix rows whenever a full card is built (plugins may append buttons later).
  if (window.Lampa && Lampa.Listener && Lampa.Listener.follow) {
    Lampa.Listener.follow('full', function (e) {
      if (!e || !e.body) return;
      e.body.find('.full-start-new__buttons, .full-start__buttons').each(function () {
        fixRow(this);
        updateFade(this);
      });
    });
  }

  var add = Lampa.Controller.add;
  Lampa.Controller.add = function (name, ctrl) {
    if (name == 'full_start' && ctrl && ctrl.link && ctrl.link.html) {
      ['left', 'right'].forEach(function (dir) {
        var orig = ctrl[dir];
        ctrl[dir] = function () {
          if (!step(ctrl.link.html, dir == 'right' ? 1 : -1) && orig) return orig.apply(this, arguments);
        };
      });
    }
    return add.apply(this, arguments);
  };
})();

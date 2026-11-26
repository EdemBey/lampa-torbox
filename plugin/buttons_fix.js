(function () {
  'use strict';

  if (window.buttons_fix_plugin_ready) return;
  window.buttons_fix_plugin_ready = true;

  // buttons stay in one row and scroll horizontally.
  $('head').append('<style>.full-start-new__left{align-self:flex-start !important}.full-start-new__buttons,.full-start__buttons{display:flex !important;flex-wrap:nowrap !important;overflow-x:auto !important;overflow-y:hidden !important;scrollbar-width:none !important;position:relative !important}.full-start-new__buttons{margin-top:1.2em !important}.full-start__buttons{margin-top:1.2em !important}.full-start-new__buttons::-webkit-scrollbar,.full-start__buttons::-webkit-scrollbar{display:none !important}.full-start-new__buttons>*,.full-start__buttons>*{flex-shrink:0 !important}.full-start-new__buttons .full-start__button,.full-start__buttons .full-start__button{white-space:nowrap !important}</style>');

  function reveal(row, el) {
    var l = el.offsetLeft, r = l + el.offsetWidth;
    if (l - 16 < row.scrollLeft) row.scrollLeft = l - 16;
    else if (r + 16 > row.scrollLeft + row.clientWidth) row.scrollLeft = r - row.clientWidth + 16;
  }

  // Buttons stay in one row and scroll horizontally, so left/right walks them in order.
  function step(html, d) {
    var row = $(html).find('.full-start-new__buttons, .full-start__buttons').first();
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
    reveal($(this).closest('.full-start-new__buttons, .full-start__buttons')[0], this);
  });

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

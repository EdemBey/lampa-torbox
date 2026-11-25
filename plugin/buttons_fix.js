(function () {
  'use strict';

  if (window.buttons_fix_plugin_ready) return;
  window.buttons_fix_plugin_ready = true;

  // buttons.js wraps the button row on focus; Lampa bottom-aligns the poster, so it would jump.
  $('head').append('<style>.full-start-new__left{align-self:flex-start}</style>');

  // Labels show on focus and the rows re-wrap, so left/right walk the buttons in order, across rows.
  function step(html, d) {
    var row = $(html).find('.full-start-new__buttons, .full-start__buttons').first();
    var all = row.find('.selector').filter(function () {
      return this.offsetParent !== null && !this.classList.contains('hide');
    });
    var i = all.index(all.filter('.focus'));
    if (i < 0 || i + d < 0 || i + d >= all.length) return false;
    Lampa.Controller.collectionFocus(all[i + d], html);
    return true;
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

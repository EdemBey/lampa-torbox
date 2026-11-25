(function () {
  'use strict';

  if (window.buttons_fix_plugin_ready) return;
  window.buttons_fix_plugin_ready = true;

  // buttons.js wraps the button row on focus; Lampa bottom-aligns the poster, so it would jump.
  $('head').append('<style>.full-start-new__left{align-self:flex-start}</style>');
})();

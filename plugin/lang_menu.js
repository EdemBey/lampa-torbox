// Lampa shows its anime / feed / releases items only for ru/uk/be interfaces.
// This adds the same screens for every other language; the content stays as Lampa serves it.
(function () {
  'use strict';

  if (window.lang_menu_plugin_ready) return;
  window.lang_menu_plugin_ready = true;

  function start() {
    if (Lampa.Lang.selected(['ru', 'uk', 'be'])) return;

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

  if (window.appready) start();
  else {
    Lampa.Listener.follow('app', function (e) {
      if (e.type === 'ready') start();
    });
  }
})();

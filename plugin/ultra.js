// Loads the plugins listed in ultra.json next to this file (fetched from GitHub at start,
// so a new plugin only needs its name added there). Fallback: the GitHub folder listing.
(function () {
  'use strict';

  if (window.ultra_plugin_ready) return;
  window.ultra_plugin_ready = true;

  var self = document.currentScript;
  var base = self && self.src ? self.src.replace(/[^/]*$/, '') : 'https://edembey.github.io/lampa-torbox/plugin/';
  var list = null;

  function get(url, ok, err) {
    var xhr = new XMLHttpRequest();
    xhr.timeout = 10000;
    xhr.open('GET', url, true);
    xhr.onload = function () {
      if (xhr.status < 200 || xhr.status >= 300) return err();
      try { ok(JSON.parse(xhr.responseText)); } catch (e) { err(); }
    };
    xhr.onerror = err;
    xhr.ontimeout = err;
    xhr.send();
  }

  // Installed by hand from any mirror (jsDelivr, github.io): never inject it twice.
  function loaded(url) {
    var name = url.split('/').pop().split('?')[0];
    var tags = document.querySelectorAll('script[src]');
    for (var i = 0; i < tags.length; i++) {
      if (tags[i].getAttribute('src').split('/').pop().split('?')[0] === name) return true;
    }
    return false;
  }

  // One at a time: yani wraps Api sources, so order must be deterministic.
  function next(i) {
    if (i >= list.length) return;
    var url = /^https?:/.test(list[i]) ? list[i] : base + list[i];
    if (loaded(url)) return next(i + 1);
    var done = false;
    var step = function () {
      if (done) return;
      done = true;
      clearTimeout(timer);
      next(i + 1);
    };
    var timer = setTimeout(step, 15000);
    var tag = document.createElement('script');
    tag.src = url;
    tag.onload = tag.onerror = step;
    document.head.appendChild(tag);
  }

  // ultra.json is gone or on an older release: take every .js from the GitHub plugin folder.
  function fallback() {
    var m = (base.match(/^https?:\/\/([^.]+)\.github\.io\/([^/]+)\//) || []).slice(1);
    if (!m.length) return;
    get('https://api.github.com/repos/' + m[0] + '/' + m[1] + '/contents/plugin?ref=master', function (files) {
      if (!files || !files.forEach) return;
      list = files.filter(function (f) {
        return /\.js$/.test(f.name) && f.name !== 'ultra.js';
      }).map(function (f) {
        return base + f.name;
      });
      next(0);
    }, function () {});
  }

  get(base + 'ultra.json', function (data) {
    list = data && data.plugins;
    if (list && list.length && list.forEach) next(0);
    else fallback();
  }, fallback);
})();

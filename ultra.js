// Lampa bundle: loads every plugin listed in plugin/ultra.json, from plugin/ next to this file,
// one after another. Edit the plugins or that list, never this file. Query params on ultra.js
// (for example torrentio_key, read by torbox-lampa-plugin.js from its own script url) are passed
// on to each plugin.
// Install: https://edembey.github.io/lampa-torbox/ultra.js
(function () {
  'use strict';
  var self = (document.currentScript && document.currentScript.src) || 'https://edembey.github.io/lampa-torbox/ultra.js';
  var url = self.split('#')[0];
  var dir = url.split('?')[0].replace(/[^\/]*$/, '') + 'plugin/';
  var query = url.indexOf('?') === -1 ? '' : url.slice(url.indexOf('?'));

  function load(list) {
    (function next(i) {
      if (i >= list.length) return;
      var s = document.createElement('script');
      s.src = dir + list[i] + query;
      // One plugin that fails to load must not keep the rest from loading.
      s.onload = s.onerror = function () { next(i + 1); };
      document.head.appendChild(s);
    })(0);
  }

  var x = new XMLHttpRequest();
  x.open('GET', dir + 'ultra.json');
  x.onload = function () {
    var list = null;
    try { list = JSON.parse(x.responseText).plugins; } catch (e) {}
    if (x.status === 200 && list && list.length) load(list);
    else console.log('ultra.js: plugin/ultra.json unreadable, status ' + x.status);
  };
  x.onerror = function () { console.log('ultra.js: plugin/ultra.json failed to load'); };
  x.send();
})();

// ==UserScript==
// @name         Lampa HDrezka bridge
// @namespace    https://edembey.github.io/lampa-torbox/
// @version      1.0
// @description  Lets online_mod reach HDrezka from a browser Lampa (no CORS, bot check) without a server
// @match        *://lampa.mx/*
// @match        *://*.lampa.mx/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      rezka.ag
// @connect      hdrezka.ag
// @sandbox      JavaScript
// @run-at       document-start
// ==/UserScript==

// Note: any script on lampa.mx can use your HDrezka session through this bridge; install only plugins you trust.

(function () {
  'use strict';

  var PREFIX = 'https://rezka-bridge.invalid/';

  function parse(rest) {
    rest = String(rest || '');
    if (rest.charAt(0) === '/') rest = rest.slice(1);

    if (rest.indexOf('enc2/') === 0) {
      var after = rest.slice(5);
      var slash = after.indexOf('/');
      var seg = slash === -1 ? after : after.slice(0, slash);
      var decoded;
      try {
        decoded = decodeURIComponent(seg);
      } catch (e) {
        return null;
      }
      var buf;
      try {
        buf = atob(decoded);
      } catch (e) {
        return null;
      }
      rest = buf;
    }

    var headers = {};
    var cookiePlus = false;
    while (true) {
      if (rest.indexOf('param/') === 0) {
        var afterP = rest.slice(6);
        var slashP = afterP.indexOf('/');
        var segP = slashP === -1 ? afterP : afterP.slice(0, slashP);
        var remainder = slashP === -1 ? '' : afterP.slice(slashP + 1);
        var eq = segP.indexOf('=');
        var name = eq === -1 ? segP : segP.slice(0, eq);
        var value = eq === -1 ? '' : segP.slice(eq + 1);
        var decodedValue;
        try {
          decodedValue = decodeURIComponent(value);
        } catch (e) {
          return null;
        }
        headers[name] = decodedValue;
        rest = remainder;
      } else if (rest.indexOf('cookie_plus/') === 0) {
        cookiePlus = true;
        rest = rest.slice('cookie_plus/'.length);
      } else {
        break;
      }
    }

    var u;
    try {
      u = new URL(rest);
    } catch (e) {
      return null;
    }
    if (u.protocol !== 'https:' || u.port || !/(^|\.)(hd)?rezka\.ag$/i.test(u.hostname)) return null;
    return { url: rest, headers: headers, cookiePlus: cookiePlus };
  }

  var timer = setInterval(function () {
    if (!unsafeWindow.jQuery) return;
    unsafeWindow.jQuery.ajaxTransport('+*', function (options) {
      if (String(options.url).indexOf(PREFIX) !== 0) return;
      var gmRequest = null;
      return {
        send: function (headers, complete) {
          var parsed = parse(String(options.url).slice(PREFIX.length));
          if (!parsed) {
            complete(400, 'bad url', { text: 'bad url' });
            return;
          }
          var reqHeaders = {};
          var hasUA = false;
          for (var k in parsed.headers) {
            if (parsed.headers.hasOwnProperty(k) && String(k).toLowerCase() !== 'cookie') {
              reqHeaders[k] = parsed.headers[k];
              if (String(k).toLowerCase() === 'user-agent') hasUA = true;
            }
          }
          if (!hasUA) reqHeaders['User-Agent'] = 'okhttp/4.12.0';
          // The browser's own cookie jar for rezka.ag keeps the session (anonymous: false);
          // extension requests may not see Set-Cookie, so the jar is the reliable store.
          var isPost = options.type === 'POST';
          if (isPost) {
            reqHeaders['Content-Type'] = options.contentType || 'application/x-www-form-urlencoded';
            reqHeaders['X-Requested-With'] = 'XMLHttpRequest';
          }
          var gmOptions = {
            method: isPost ? 'POST' : 'GET',
            url: parsed.url,
            headers: reqHeaders,
            anonymous: false,
            redirect: 'manual',
            timeout: 20000,
            onload: function (r) {
              var setCookies = [];
              var lines = String(r.responseHeaders || '').split(/\r\n|\n/);
              for (var i = 0; i < lines.length; i++) {
                if (/^set-cookie:/i.test(lines[i])) {
                  setCookies.push(lines[i].replace(/^set-cookie:\s*/i, '').trim());
                }
              }
              if (parsed.cookiePlus) {
                var cookie = setCookies.length ? setCookies : ['rezka_bridge=1'];
                var text = JSON.stringify({
                  currentUrl: r.finalUrl,
                  status: r.status,
                  cookie: cookie,
                  headers: { 'set-cookie': cookie },
                  body: r.responseText
                });
                complete(200, 'OK', { text: text }, 'Content-Type: application/json');
              } else {
                complete(r.status, r.statusText || '', { text: r.responseText }, r.responseHeaders);
              }
            },
            onerror: function () {
              complete(0, 'error', { text: '' });
            },
            onabort: function () {
              complete(0, 'error', { text: '' });
            },
            ontimeout: function () {
              complete(0, 'error', { text: '' });
            }
          };
          if (isPost) gmOptions.data = options.data;
          gmRequest = GM_xmlhttpRequest(gmOptions);
        },
        abort: function () {
          if (gmRequest && typeof gmRequest.abort === 'function') gmRequest.abort();
        }
      };
    });
    unsafeWindow.online_mod_rezka_bridge = PREFIX;
    clearInterval(timer);
  }, 200);
})();

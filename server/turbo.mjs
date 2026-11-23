// Turbo (obrut.show) for online_mod. The embed page carries the whole PlayerJS playlist
// (seasons → episodes → voices → quality files), but obrut serves it only after a
// "confirm you are human" checkbox, and only to a client holding the wd_approval cookie.
// A person has to tick that box once: /embed, /include and /build are reverse-proxied here,
// so the checkbox runs in the user's browser while every request — and the approval cookie —
// belongs to this server. After that the server reads playlists on its own until obrut
// asks again, and online_mod then shows the checkbox again.
import { Readable, pipeline } from 'node:stream';

const TIMEOUT = 20000;
const PARENT = 'https://onomovie.ru/';
// cfetch drops a header given as ''; Chrome client hints would contradict the user's own User-Agent.
const NO_HINTS = { 'Sec-Ch-Ua': '', 'Sec-Ch-Ua-Mobile': '', 'Sec-Ch-Ua-Platform': '' };

// One user per helper: the obrut host, the approval cookies and the browser that earned them.
const state = { host: '', cookies: new Map(), ua: '', approved: false };

const isTurboHost = (h) => /(^|\.)obrut\.show$/i.test(h || '');
export const isCdnHost = (h) => /(^|\.)superdupercdn\.com$/i.test(h || '');

// Injected into every proxied check-page HTML so the Lampa modal's remote-driven
// cursor can be turned into real pointer/mouse events inside the page.
export const CURSOR_JS = '<script>(function(){var a=Element.prototype.attachShadow;if(a)Element.prototype.attachShadow=function(o){return a.call(this,Object.assign({},o,{mode:"open"}));};if(/\\/include\\//.test(location.pathname))return;window.addEventListener("message",function(e){if(e.source!==parent)return;var p=e.data&&e.data.turboCursor;if(!p)return;var doc=document,root=null,x=p.x,y=p.y,el,i=0;while(i++<10){el=(root||doc).elementFromPoint(x,y);if(!el)break;if(el.tagName==="IFRAME"){try{if(el.contentDocument){var r=el.getBoundingClientRect();x-=r.left;y-=r.top;doc=el.contentDocument;root=null;continue;}}catch(err){}}if(el.shadowRoot){var se=el.shadowRoot.elementFromPoint(x,y);if(se&&se!==el){root=el.shadowRoot;continue;}}break;}if(!el)return;var V=doc.defaultView;var PE=V.PointerEvent||V.MouseEvent;var ME=V.MouseEvent;function fire(type,Ctor,down,delay){setTimeout(function(){var ev=new Ctor(type,{bubbles:true,cancelable:true,composed:true,view:V,clientX:x,clientY:y,screenX:x,screenY:y,button:0,buttons:(down?1:0),pointerId:1,pointerType:"mouse",isPrimary:true,detail:1});el.dispatchEvent(ev);},delay);}var j1=60+Math.floor(Math.random()*61);fire("pointerover",PE,false,0);fire("pointerenter",PE,false,0);fire("mouseover",ME,false,0);fire("mouseenter",ME,false,0);fire("pointermove",PE,false,0);fire("mousemove",ME,false,0);fire("pointerdown",PE,true,j1);fire("mousedown",ME,true,j1);setTimeout(function(){if(el.focus)try{el.focus();}catch(e){}},j1);var j2=j1+80+Math.floor(Math.random()*71);fire("pointerup",PE,false,j2);fire("mouseup",ME,false,j2);fire("click",ME,false,j2+10);});})();</script>';

export function injectCursor(html) {
  const s = String(html);
  const m = s.match(/<head(\s[^>]*)?>/i);
  if (!m) return CURSOR_JS + s;
  return s.replace(/<head(\s[^>]*)?>/i, (match) => match + CURSOR_JS);
}

export function browserCookie(setCookie, https) {
  // Always drop obrut's domain attribute so the browser treats it as this origin's cookie.
  let s = String(setCookie).replace(/;\s*domain=[^;]*/i, '');
  if (!https) return s;
  // Normalize SameSite for the cross-site iframe context.
  if (/;\s*samesite=/i.test(s)) {
    s = s.replace(/;\s*samesite=[^;]*/i, '; SameSite=None');
  } else {
    s = s + '; SameSite=None';
  }
  // Secure is required for SameSite=None; add it only if upstream did not send it.
  const hasSecure = /(?:^|;)\s*secure(?:\s*(?:;|$))/i.test(s);
  if (!hasSecure) s = s + '; Secure';
  return s;
}

function rememberCookies(headers) {
  for (const line of headers.getSetCookie ? headers.getSetCookie() : []) {
    const pair = line.split(';')[0];
    const i = pair.indexOf('=');
    if (i > 0) state.cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
}

function cookieHeader(fromBrowser) {
  const jar = new Map(state.cookies);
  // The challenge script also sets cookies from JS; those reach us only through the browser.
  for (const part of String(fromBrowser || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) jar.set(part.slice(0, i).trim(), part.slice(i + 1).trim());
  }
  return [...jar].map(([k, v]) => k + '=' + v).join('; ');
}

// PlayerJS hides the config as junk + base64(JSON) with "//" + btoa("c/c/c") markers spliced in.
export function decodePlaylist(html) {
  const at = html.indexOf('new Player("');
  if (at < 0) return null;
  let s = html.slice(at + 12);
  s = s.slice(0, s.indexOf('"'));
  let b64 = s.slice(s.indexOf('eyJ'));
  for (const c of 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
    b64 = b64.split('//' + Buffer.from(c + '/' + c + '/' + c).toString('base64')).join('');
  }
  try {
    return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

// Rewrite every URL in an HLS playlist so the browser fetches it through this helper
// (no Origin/Referer reaches the CDN). Pure: no I/O.
export function rewritePlaylist(text, playlistUrl, base) {
  return String(text).split('\n').map((line) => {
    const t = line.trim();
    if (t === '' || t.startsWith('#')) {
      // Rewrite URIs inside tags such as EXT-X-KEY / EXT-X-MAP / EXT-X-MEDIA.
      if (t.startsWith('#') && /URI="/.test(line)) {
        return line.replace(/URI="([^"]*)"/g, (_, uri) => {
          const abs = new URL(uri, playlistUrl).href;
          const to = new URL(abs).pathname.endsWith('.m3u8') ? '/turbo/hls' : '/turbo/seg';
          return 'URI="' + base + to + '?u=' + encodeURIComponent(abs) + '"';
        });
      }
      return line;
    }
    const abs = new URL(t, playlistUrl).href;
    const to = new URL(abs).pathname.endsWith('.m3u8') ? '/turbo/hls' : '/turbo/seg';
    return base + to + '?u=' + encodeURIComponent(abs);
  }).join('\n');
}

// Only what online_mod needs: titles and quality strings, no ads or player options.
function slim(list) {
  return (list || []).map((n) => {
    const o = { title: n.title };
    if (n.t1) o.t1 = n.t1;
    if (n.file) o.file = n.file;
    if (n.folder) o.folder = slim(n.folder);
    return o;
  });
}

async function playlist(embed, get = fetch) {
  const up = await get(embed, {
    headers: { Referer: PARENT, 'User-Agent': state.ua || 'Mozilla/5.0', Cookie: cookieHeader(''), ...NO_HINTS },
    signal: AbortSignal.timeout(TIMEOUT),
  });
  rememberCookies(up.headers);
  const html = await up.text();
  const cfg = up.ok ? decodePlaylist(html) : null;
  if (cfg && Array.isArray(cfg.file)) {
    state.approved = true;
    return { file: slim(cfg.file) };
  }
  state.approved = false;
  return { verify: true, status: up.status };
}

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Private-Network': 'true' });
  res.end(JSON.stringify(body));
};

// Returns true when the request was a Turbo one.
export async function handleTurbo(req, res, url, base, get = fetch) {
  try {
    const q = url.searchParams;
    const path = url.pathname;

    if (path === '/turbo/playlist' || path === '/turbo/verify') {
      let embed;
      try { embed = new URL(q.get('url') || ''); } catch { json(res, 400, { error: 'bad url' }); return true; }
      if (embed.protocol !== 'https:' || !isTurboHost(embed.hostname)) { json(res, 400, { error: 'not a turbo url' }); return true; }
      state.host = embed.hostname;
      if (path === '/turbo/verify') {
        // Asked for a check, so the approval we hold is dead: /turbo/status waits for a new one.
        state.cookies.delete('wd_approval');
        state.approved = false;
        // The checkbox page, served from this origin so its requests come back through us.
        res.writeHead(302, { Location: base + embed.pathname + embed.search });
        res.end();
        return true;
      }
      json(res, 200, await playlist(embed.href, get));
      return true;
    }

    // Cheap poll while the checkbox is open: set once obrut serves the player through the proxy.
    if (path === '/turbo/status') {
      json(res, 200, { approved: state.approved });
      return true;
    }

    if (path === '/turbo/stream') {
      let target;
      try { target = new URL(q.get('u') || ''); } catch { json(res, 400, { error: 'bad stream url' }); return true; }
      if (target.protocol !== 'https:' || !isTurboHost(target.hostname)) { json(res, 400, { error: 'not a turbo stream' }); return true; }
      // The stream link answers only with obrut's own Referer and hands back a public CDN url.
      const up = await get(target.href, {
        redirect: 'manual',
        headers: { Referer: 'https://' + (state.host || target.hostname.replace(/^cdn-/, '')) + '/', 'User-Agent': state.ua || 'Mozilla/5.0', ...NO_HINTS },
        signal: AbortSignal.timeout(TIMEOUT),
      });
      const location = up.headers.get('location');
      await up.body?.cancel();
      if (up.status >= 300 && up.status < 400 && location) {
        const cdnHost = new URL(location, target.href).hostname;
        if (!isCdnHost(cdnHost)) { json(res, 502, { error: 'unexpected stream host' }); return true; }
        const plUrl = new URL(location, target.href).href;
        let fetchedUrl = plUrl;
        let r = await get(plUrl, {
          redirect: 'manual',
          headers: { 'User-Agent': state.ua || 'Mozilla/5.0', ...NO_HINTS },
          signal: AbortSignal.timeout(TIMEOUT),
        });
        if (r.status >= 300 && r.status < 400) {
          const loc2 = r.headers.get('location');
          await r.body?.cancel();
          if (!loc2 || !isCdnHost(new URL(loc2, plUrl).hostname)) { json(res, 502, { error: 'unexpected stream host' }); return true; }
          fetchedUrl = new URL(loc2, plUrl).href;
          r = await get(fetchedUrl, {
            redirect: 'manual',
            headers: { 'User-Agent': state.ua || 'Mozilla/5.0', ...NO_HINTS },
            signal: AbortSignal.timeout(TIMEOUT),
          });
        }
        if (Number(r.headers.get('content-length') || 0) > 5 * 1024 * 1024) {
          await r.body?.cancel();
          json(res, 502, { error: 'playlist too large' });
          return true;
        }
        const body = await r.text();
        if (body.includes('#EXTM3U')) {
          res.writeHead(200, { 'Content-Type': 'application/vnd.apple.mpegurl', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Private-Network': 'true' });
          res.end(rewritePlaylist(body, fetchedUrl, base));
        } else json(res, 502, { error: 'playlist: ' + r.status });
      } else json(res, 502, { error: 'stream: ' + up.status });
      return true;
    }

    if (path === '/turbo/hls') {
      let target;
      try { target = new URL(q.get('u') || ''); } catch { json(res, 400, { error: 'bad hls url' }); return true; }
      if (target.protocol !== 'https:' || !isCdnHost(target.hostname)) { json(res, 400, { error: 'not a superdupercdn url' }); return true; }
      let fetchedUrl = target.href;
      let r = await get(target.href, {
        redirect: 'manual',
        headers: { 'User-Agent': state.ua || 'Mozilla/5.0', ...NO_HINTS },
        signal: AbortSignal.timeout(TIMEOUT),
      });
      if (r.status >= 300 && r.status < 400) {
        const loc = r.headers.get('location');
        await r.body?.cancel();
        if (!loc || !isCdnHost(new URL(loc, target.href).hostname)) { json(res, 502, { error: 'unexpected stream host' }); return true; }
        fetchedUrl = new URL(loc, target.href).href;
        r = await get(fetchedUrl, {
          redirect: 'manual',
          headers: { 'User-Agent': state.ua || 'Mozilla/5.0', ...NO_HINTS },
          signal: AbortSignal.timeout(TIMEOUT),
        });
      }
      if (Number(r.headers.get('content-length') || 0) > 5 * 1024 * 1024) {
        await r.body?.cancel();
        json(res, 502, { error: 'playlist too large' });
        return true;
      }
      const body = await r.text();
      if (body.includes('#EXTM3U')) {
        res.writeHead(200, { 'Content-Type': 'application/vnd.apple.mpegurl', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Private-Network': 'true' });
        res.end(rewritePlaylist(body, fetchedUrl, base));
      } else json(res, 502, { error: 'playlist: ' + r.status });
      return true;
    }

    if (path === '/turbo/seg') {
      let target;
      try { target = new URL(q.get('u') || ''); } catch { json(res, 400, { error: 'bad seg url' }); return true; }
      if (target.protocol !== 'https:' || !isCdnHost(target.hostname)) { json(res, 400, { error: 'not a superdupercdn url' }); return true; }
      const headers = { 'User-Agent': state.ua || 'Mozilla/5.0', 'Accept-Encoding': '', ...NO_HINTS };
      if (req.headers.range) headers.Range = req.headers.range;
      let up = await get(target.href, { headers, redirect: 'manual', signal: AbortSignal.timeout(45000) });
      if (up.status >= 300 && up.status < 400) {
        const loc = up.headers.get('location');
        await up.body?.cancel();
        if (!loc || !isCdnHost(new URL(loc, target.href).hostname)) { json(res, 502, { error: 'unexpected stream host' }); return true; }
        up = await get(new URL(loc, target.href).href, { headers, redirect: 'manual', signal: AbortSignal.timeout(45000) });
      }
      if (res.destroyed) { await up.body?.cancel(); return true; }
      const out = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Private-Network': 'true', 'Content-Type': up.headers.get('content-type') || 'video/mp2t' };
      for (const h of ['content-length', 'content-range', 'accept-ranges']) if (up.headers.get(h)) out[h] = up.headers.get(h);
      res.writeHead(up.status, out);
      if (!up.body) { res.end(); return true; }
      const body = Readable.fromWeb(up.body);
      body.on('error', () => res.destroy());
      pipeline(body, res, () => {});
      return true;
    }

    // Reverse proxy for the checkbox page and its scripts (absolute paths on obrut's side).
    if (state.host && /^\/(embed|include|build)\//.test(path)) {
      state.ua = req.headers['user-agent'] || state.ua;
      const target = 'https://' + state.host + path + url.search;
      const headers = {
        'User-Agent': state.ua,
        Accept: req.headers.accept || '*/*',
        'Accept-Language': req.headers['accept-language'] || 'ru',
        Cookie: cookieHeader(req.headers.cookie),
        Referer: path.startsWith('/embed/') ? PARENT : 'https://' + state.host + '/',
        ...NO_HINTS,
      };
      if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];
      if (req.method === 'POST') headers.Origin = 'https://' + state.host;
      const body = req.method === 'POST' ? await new Promise((ok) => {
        const parts = [];
        let size = 0;
        let overflow = false;
        req.on('data', (d) => {
          if (overflow) return;
          size += d.length;
          if (size > 65536) { overflow = true; req.destroy(); ok(null); return; }
          parts.push(d);
        });
        req.on('end', () => { if (!overflow) ok(Buffer.concat(parts)); });
      }) : undefined;
      if (body === null) { json(res, 413, { error: 'body too large' }); return true; }
      const up = await get(target, { method: req.method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT) });
      rememberCookies(up.headers);
      const buf = Buffer.from(await up.arrayBuffer());
      // The player itself came back: whatever cookies made that work are the approval.
      if (path.startsWith('/embed/') && up.ok && buf.includes('new Player("')) {
        for (const part of String(req.headers.cookie || '').split(';')) {
          const i = part.indexOf('=');
          if (i > 0) state.cookies.set(part.slice(0, i).trim(), part.slice(i + 1).trim());
        }
        state.approved = true;
      }
      const out = { 'Content-Type': up.headers.get('content-type') || 'text/html; charset=utf-8', 'Cache-Control': 'no-store' };
      const location = up.headers.get('location');
      if (location) out.Location = location.replace(/^https:\/\/[^/]*obrut\.show/i, base);
      // Same cookies for the browser (without obrut's domain), so the checkbox script sees them.
      // Inside Lampa this page is a cross-site iframe, where only SameSite=None cookies survive.
      const secure = base.startsWith('https:');
      const cookies = (up.headers.getSetCookie ? up.headers.getSetCookie() : []).map((c) => browserCookie(c, secure));
      if (cookies.length) out['Set-Cookie'] = cookies;
      let finalBuf = buf;
      const ct = up.headers.get('content-type') || '';
      if (ct.includes('text/html') && (/^\/embed\//.test(path) || /^\/include\//.test(path))) {
        const str = buf.toString('utf8');
        if (!str.includes('new Player("')) {
          finalBuf = Buffer.from(injectCursor(str));
          // The script pushes any <meta charset> past the first 1024 bytes the browser sniffs.
          out['Content-Type'] = 'text/html; charset=utf-8';
        }
      }
      res.writeHead(up.status, out);
      res.end(finalBuf);
      return true;
    }

    return false;
  } catch (e) {
    if (!res.headersSent) json(res, 502, { error: e.message });
    else res.end();
    return true;
  }
}
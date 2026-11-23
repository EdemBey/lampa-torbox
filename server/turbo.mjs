// Turbo (obrut.show) for online_mod. The embed page carries the whole PlayerJS playlist
// (seasons → episodes → voices → quality files), but obrut serves it only after a
// "confirm you are human" checkbox, and only to a client holding the wd_approval cookie.
// A person has to tick that box once: /embed, /include and /build are reverse-proxied here,
// so the checkbox runs in the user's browser while every request — and the approval cookie —
// belongs to this server. After that the server reads playlists on its own until obrut
// asks again, and online_mod then shows the checkbox again.
const TIMEOUT = 20000;
const PARENT = 'https://onomovie.ru/';
// Shown instead of obrut's player once the check passes: the phone (or the TV iframe) only had to tick the box.
const DONE_PAGE = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Turbo</title><body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#111;color:#fff;font:600 1.3em system-ui,sans-serif;text-align:center"><div><div style="font-size:3em;color:#4caf50">✓</div>Готово, смотрите на телевизоре</div></body>';

// One user per helper: the obrut host, the approval cookies and the browser that earned them.
const state = { host: '', cookies: new Map(), ua: '', approved: false };

const isTurboHost = (h) => /(^|\.)obrut\.show$/i.test(h || '');
export const isCdnHost = (h) => /(^|\.)superdupercdn\.com$/i.test(h || '');

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

async function playlist(embed) {
  const up = await fetch(embed, {
    headers: { Referer: PARENT, 'User-Agent': state.ua || 'Mozilla/5.0', Cookie: cookieHeader('') },
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
export async function handleTurbo(req, res, url, base) {
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
      json(res, 200, await playlist(embed.href));
      return true;
    }

    // Cheap poll while the checkbox is open: set once obrut serves the player through the proxy.
    if (path === '/turbo/status') {
      json(res, 200, { approved: state.approved });
      return true;
    }

    // Only this hop needs obrut's Referer, which a browser cannot set; the player follows the CDN redirects itself.
    if (path === '/turbo/stream') {
      let target;
      try { target = new URL(q.get('u') || ''); } catch { json(res, 400, { error: 'bad stream url' }); return true; }
      if (target.protocol !== 'https:' || !isTurboHost(target.hostname)) { json(res, 400, { error: 'not a turbo stream' }); return true; }
      const up = await fetch(target.href, {
        redirect: 'manual',
        headers: { Referer: 'https://' + (state.host || target.hostname.replace(/^cdn-/, '')) + '/', 'User-Agent': state.ua || 'Mozilla/5.0' },
        signal: AbortSignal.timeout(TIMEOUT),
      });
      const location = up.headers.get('location');
      await up.body?.cancel();
      if (up.status >= 300 && up.status < 400 && location) {
        const next = new URL(location, target.href);
        if (!isCdnHost(next.hostname) || next.protocol !== 'https:') { json(res, 502, { error: 'unexpected stream host' }); return true; }
        let cdn = next.href;
        // z.superdupercdn.com takes 5+ s to redirect to its edge (lucky.z…), longer than hls.js waits for a
        // manifest, so the helper takes that redirect itself (headers only) and hands out the edge link.
        try {
          const hop = await fetch(cdn, { method: 'HEAD', redirect: 'manual', headers: { 'User-Agent': state.ua || 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) });
          const edge = hop.headers.get('location') && new URL(hop.headers.get('location'), cdn);
          if (hop.status >= 300 && hop.status < 400 && edge && edge.protocol === 'https:' && isCdnHost(edge.hostname)) cdn = edge.href;
        } catch {}
        // Lampa asks with json=1 and hands the link to its player: a redirect from here to the CDN makes the browser send Origin: null, which the CDN refuses.
        if (q.get('json')) { json(res, 200, { url: cdn }); return true; }
        res.writeHead(302, { Location: cdn, 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Private-Network': 'true', 'Cache-Control': 'no-store' });
        res.end();
        return true;
      }
      json(res, 502, { error: 'stream: ' + up.status });
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
      // obrut answers the checkbox POST with 404 when it comes through curl-impersonate, so the check stays on Node fetch.
      const up = await fetch(target, { method: req.method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT) });
      rememberCookies(up.headers);
      let buf = Buffer.from(await up.arrayBuffer());
      let done = false;
      // The player itself came back: whatever cookies made that work are the approval.
      if (path.startsWith('/embed/') && up.ok && buf.includes('new Player("')) {
        for (const part of String(req.headers.cookie || '').split(';')) {
          const i = part.indexOf('=');
          if (i > 0) state.cookies.set(part.slice(0, i).trim(), part.slice(i + 1).trim());
        }
        state.approved = true;
        buf = Buffer.from(DONE_PAGE);
        done = true;
      }
      const out = { 'Content-Type': done ? 'text/html; charset=utf-8' : up.headers.get('content-type') || 'text/html; charset=utf-8', 'Cache-Control': 'no-store' };
      const location = up.headers.get('location');
      if (location) out.Location = location.replace(/^https:\/\/[^/]*obrut\.show/i, base);
      // Same cookies for the browser (without obrut's domain), so the checkbox script sees them.
      // Inside Lampa this page is a cross-site iframe, where only SameSite=None cookies survive.
      const secure = base.startsWith('https:');
      const cookies = (up.headers.getSetCookie ? up.headers.getSetCookie() : []).map((c) => browserCookie(c, secure));
      if (cookies.length) out['Set-Cookie'] = cookies;
      res.writeHead(up.status, out);
      res.end(buf);
      return true;
    }

    return false;
  } catch (e) {
    if (!res.headersSent) json(res, 502, { error: e.message });
    else res.end();
    return true;
  }
}
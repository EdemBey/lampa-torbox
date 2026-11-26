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
let lastPlaylist = null;

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

// Bandwidth and resolution from the CDN's own hls.m3u8.
const QUALITY = { 240: [406000, '426x240'], 360: [696000, '640x360'], 480: [1328000, '854x480'], 720: [2892000, '1280x720'], 1080: [5592000, '1920x1080'] };

// One master playlist: each voice is an audio rendition of the same file, each quality a video variant.
export function masterPlaylist({ base, tracks, def, qualities, audioQ }) {
  const lines = ['#EXTM3U'];
  for (const t of tracks) {
    const name = String(t.name).replace(/["\r\n,]/g, ' ').trim().slice(0, 80);
    lines.push(`#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",NAME="${name}",DEFAULT=${t.n === def ? 'YES' : 'NO'},AUTOSELECT=YES,URI="${base}${audioQ}.mp4:hls:manifest-v1-a${t.n}.m3u8"`);
  }
  for (const q of [...qualities].sort((a, b) => a - b)) {
    if (!QUALITY[q]) continue;
    lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${QUALITY[q][0]},RESOLUTION=${QUALITY[q][1]},AUDIO="aud"`);
    lines.push(`${base}${q}.mp4:hls:manifest-v1.m3u8`);
  }
  return lines.join('\n') + '\n';
}

// DDD's voice menu: each link is this helper's playlist route, which serves the CDN playlist with absolute urls.
export function dddVoiceovers({ voices, u, base, tail }) {
  const out = [];
  for (const v of voices) {
    if (!v.file) continue;
    const parts = v.file.split(',').map((p) => p.match(/^\s*\[([^\]]+)\]\s*(\S+)/)).filter(Boolean).map((m) => ({ label: m[1], url: m[2] }));
    const quals = parts.map((p) => ({ n: parseInt(p.label, 10), url: p.url })).filter((p) => !isNaN(p.n)).sort((a, b) => b.n - a.n);
    const auto = (parts.find((p) => /auto/i.test(p.label)) || quals[0] || {}).url;
    if (!auto) continue;
    out.push({
      id: v.title,
      name: v.title,
      selected: parts.some((p) => p.url === u),
      url: `${base}/turbo/stream.m3u8?u=${encodeURIComponent(auto)}${tail}`,
      qualities: quals.map((p) => ({ name: p.n + 'p', url: `${base}/turbo/stream.m3u8?u=${encodeURIComponent(p.url)}${tail}` })),
    });
  }
  if (out.length && !out.some((v) => v.selected)) out[0].selected = true;
  return { voiceovers: out };
}

// Playlist lines are relative to the CDN path; the player fetches them from this helper's origin, so make them absolute.
export function absolutePlaylist(text, playlistUrl) {
  return text.split('\n').map((line) => {
    if (line.startsWith('#')) return line.replace(/URI="([^"]*)"/g, (m, x) => `URI="${new URL(x, playlistUrl).href}"`);
    const t = line.trim();
    return t ? new URL(t, playlistUrl).href : line;
  }).join('\n');
}

// obrut's stream link → the CDN link. Failures come back as { status, body } instead of a reply.
async function resolveCdn(u) {
  let target;
  try { target = new URL(u || ''); } catch { return { status: 400, body: { error: 'bad stream url' } }; }
  if (target.protocol !== 'https:' || !isTurboHost(target.hostname)) return { status: 400, body: { error: 'not a turbo stream' } };
  const up = await fetch(target.href, {
    redirect: 'manual',
    headers: { Referer: 'https://' + (state.host || target.hostname.replace(/^cdn-/, '')) + '/', 'User-Agent': state.ua || 'Mozilla/5.0' },
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const location = up.headers.get('location');
  await up.body?.cancel();
  if (up.status >= 300 && up.status < 400 && location) {
    const next = new URL(location, target.href);
    if (!isCdnHost(next.hostname) || next.protocol !== 'https:') return { status: 502, body: { error: 'unexpected stream host' } };
    // z.superdupercdn.com often stalls 20+ s from home networks before redirecting to its edge, and the edge
    // serves the same path, so players get the edge host directly.
    // shortcut: the edge name is hard-coded (always lucky.z so far); look it up again if the CDN renames it.
    if (next.hostname === 'z.superdupercdn.com') next.hostname = 'lucky.z.superdupercdn.com';
    return { cdn: next.href };
  }
  return { status: 502, body: { error: 'stream: ' + up.status } };
}

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
      const r = await resolveCdn(q.get('u'));
      if (!r.cdn) { json(res, r.status, r.body); return true; }
      // Lampa asks with json=1 and hands the link to its player: a redirect from here to the CDN makes the browser send Origin: null, which the CDN refuses.
      if (q.get('json')) { json(res, 200, { url: r.cdn }); return true; }
      res.writeHead(302, { Location: r.cdn, 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Private-Network': 'true', 'Cache-Control': 'no-store' });
      res.end();
      return true;
    }

    // The CDN playlist served from this origin, so DDD takes its voice and segment links from here.
    if (path === '/turbo/stream.m3u8') {
      const r = await resolveCdn(q.get('u'));
      if (!r.cdn) { json(res, r.status, r.body); return true; }
      const up = await fetch(r.cdn, { redirect: 'follow', headers: { 'User-Agent': state.ua || 'Mozilla/5.0' }, signal: AbortSignal.timeout(TIMEOUT) });
      if (!isCdnHost(new URL(up.url).hostname)) { await up.body?.cancel(); json(res, 502, { error: 'unexpected stream host' }); return true; }
      const text = await up.text();
      if (!text.includes('#EXTM3U')) { json(res, 502, { error: 'playlist' }); return true; }
      res.writeHead(200, { 'Content-Type': 'application/vnd.apple.mpegurl', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Private-Network': 'true', 'Cache-Control': 'no-store' });
      res.end(absolutePlaylist(text, up.url));
      return true;
    }

    if (path === '/turbo/master.m3u8') {
      let b;
      try { b = new URL(q.get('base') || ''); } catch { b = null; }
      if (!b || b.protocol !== 'https:' || !isCdnHost(b.hostname) || !b.pathname.endsWith('/') || b.search || b.hash) { json(res, 400, { error: 'bad base' }); return true; }
      const tracks = q.getAll('a').map((a) => { const m = a.match(/^(\d{1,2}):([\s\S]*)$/); return m && { n: Number(m[1]), name: m[2] }; });
      if (!tracks.length || tracks.length > 32 || tracks.some((t) => !t)) { json(res, 400, { error: 'bad tracks' }); return true; }
      const def = Number(q.get('d') ?? tracks[0].n);
      const audioQ = Number(q.get('aq') ?? 240);
      const qualities = (q.get('q') !== null ? [q.get('q')] : (q.get('qs') ?? '240,360,480,720,1080').split(',')).map(Number);
      const known = [240, 360, 480, 720, 1080];
      if (!/^\d{1,2}$/.test(q.get('d') ?? '0') || !known.includes(audioQ) || !qualities.every((x) => known.includes(x))) { json(res, 400, { error: 'bad quality' }); return true; }
      res.writeHead(200, { 'Content-Type': 'application/vnd.apple.mpegurl', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Private-Network': 'true', 'Cache-Control': 'no-store' });
      res.end(masterPlaylist({ base: b.href, tracks, def, qualities, audioQ }));
      return true;
    }

    // DDD asks for one episode's voices; the item's own query (e, s, ep, u) says which episode.
    if (path === '/turbo/voiceovers') {
      let embed;
      try { embed = new URL(q.get('e') || ''); } catch { json(res, 400, { error: 'bad url' }); return true; }
      if (embed.protocol !== 'https:' || !isTurboHost(embed.hostname)) { json(res, 400, { error: 'not a turbo url' }); return true; }
      const s = q.get('s') ?? '';
      const ep = q.get('ep') ?? '';
      if (!/^\d+$/.test(s) || !/^\d+$/.test(ep)) { json(res, 400, { error: 'bad episode' }); return true; }
      state.host = embed.hostname;
      // Each DDD episode start would fetch obrut's embed page, which makes its human check fire sooner.
      let file;
      if (lastPlaylist && lastPlaylist.href === embed.href && Date.now() - lastPlaylist.time < 5 * 60 * 1000) {
        file = lastPlaylist.file;
      } else {
        const pl = await playlist(embed.href);
        if (pl.verify) { json(res, 503, { error: 'verify' }); return true; }
        file = pl.file;
        lastPlaylist = { href: embed.href, file, time: Date.now() };
      }
      const season = file[Number(s)];
      const item = season && season.folder && season.folder[Number(ep)];
      if (!item || !item.folder) { json(res, 404, { error: 'no episode' }); return true; }
      const tail = '&e=' + encodeURIComponent(embed.href) + '&s=' + s + '&ep=' + ep;
      json(res, 200, dddVoiceovers({ voices: item.folder, u: q.get('u') || '', base, tail }));
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
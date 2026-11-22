// Alloha helper for online_mod. The player signs every CDN request with three things:
// a Borth header built from the page fingerprint, a guard token from /sarn + /vorf, and a
// per-quality edge hash that arrives over its websocket. All three are reproduced here in
// plain Node, so no browser is needed. Alloha hands out usable tokens only to
// residential-looking IPs, so entrypoint.sh sends the traffic through Cloudflare WARP.
import crypto from 'node:crypto';
import http from 'node:http';
import { Readable, pipeline } from 'node:stream';
import { borthFor, episodeKey, mapPlaylist, pickQuality, QUALITIES, YB } from './alloha-sign.mjs';

const PORT = Number(process.env.PORT || 8790);
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36';
const PARENT = 'https://onomovie.ru';
// Alloha answers in a second or two; anything slower is a stalled proxy and Lampa has given up.
const TIMEOUT = 20000;

async function playerPage(src) {
  const up = await fetch(src, { headers: { Referer: PARENT + '/', 'User-Agent': UA }, signal: AbortSignal.timeout(TIMEOUT) });
  const body = (await up.text()).replace(/\n/g, '');
  const fl = body.match(/ fileList = JSON\.parse\('(\{.*\})'\);/);
  const vp = body.match(/name="viewporti" content="([^"]+)"/);
  return { status: up.status, fileList: fl ? JSON.parse(fl[1].replace(/\\'/g, "'")) : null, viewport: vp && vp[1] };
}

// The player proves itself to the CDN with a guard token from /sarn + /vorf. That token is
// the part with a short life, and it can be renewed on its own: /bnsi (which hands out the
// websocket session) refuses a client that still has one active, so it is never re-asked
// just to get a fresh guard.
async function signGuard(src, origin, id) {
  const sarn = await (await fetch(`${origin}/sarn`, {
    headers: { 'User-Agent': UA, Referer: src, acceptis: `${YB}.${id}` },
    signal: AbortSignal.timeout(TIMEOUT),
  })).json();
  const proof = crypto.createHash('sha256').update([sarn.nonce, YB, sarn.uap, origin, origin].join('|')).digest('hex');
  const vorf = await (await fetch(`${origin}/vorf`, {
    method: 'POST',
    headers: { 'User-Agent': UA, Referer: src, Origin: origin, 'Content-Type': 'application/json', 'accepts-block': YB },
    body: JSON.stringify({ challenge: sarn.challenge, proof, parentOrigin: origin, referrer: PARENT + '/' }),
    signal: AbortSignal.timeout(TIMEOUT),
  })).json();
  if (!vorf.token) throw new Error('guard: ' + (vorf.ok ? 'no token' : 'refused'));
  return vorf.token;
}

// The player page, its signed quality list and the websocket session id are resolved once
// per episode and reused until the session really dies.
async function resolveInfo(src) {
  const origin = new URL(src).origin;
  const page = await playerPage(src);
  if (!page.fileList || !page.viewport) throw new Error('player page: ' + page.status);
  // The page turns the requested translation into active.id; id_file is the shared movie id,
  // so asking bnsi with it would always resolve the default audio.
  const id = page.fileList.active.id || page.fileList.active.id_file;
  const token = new URL(src).searchParams.get('token') || '';
  const kind = page.fileList.type === 'trailer' ? 'trailers' : 'movies';
  const bnsiRes = await fetch(`${origin}/bnsi/${kind}/${id}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest',
      'User-Agent': UA, Referer: src, Origin: origin, Borth: borthFor(page.viewport),
    },
    body: `token=${encodeURIComponent(token)}&av1=true&autoplay=0&audio=&subtitle=`,
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const bnsi = await bnsiRes.json();
  const sources = bnsi.hlsSource || [];
  const source = sources.find((x) => x['default']) || sources[0];
  if (!source || !source.quality) throw new Error('bnsi: ' + bnsiRes.status + ' without hlsSource');
  // Without a websocket session Alloha hands out urls the CDN cannot decrypt, so this is fatal.
  if (!bnsi.pnr || !bnsi.pnk) throw new Error('bnsi: no websocket session (Alloha refuses this client right now)');

  const qualities = {};
  for (const [label, links] of Object.entries(source.quality)) {
    const link = String(links).split(' or ').filter(Boolean)[0];
    if (link) qualities[label] = link;
  }
  return { src, origin, id, guard: await signGuard(src, origin, id), pnr: bnsi.pnr, pnk: bnsi.pnk, qualities };
}

// Episodes resolved for playback, plus the in-flight and recently failed ones.
const infos = new Map();
const pending = new Map();
const failures = new Map();
// Episodes the CDN has stopped serving for a while, keyed to the same episode key.
const sessionBlocks = new Map();
const SESSION_BLOCK = 60 * 1000;
// How long a resolved episode survives without being used; while it plays it is touched and kept.
const INFO_TTL = 30 * 60 * 1000;
// A resolve costs four upstream requests and Alloha throttles them, so a refusal blocks the
// key for a while. A plain network failure only needs a moment, and hls.js gives up early.
const FAIL_ALLoha = 30000;
const FAIL_NETWORK = 2000;

const keyOf = episodeKey;

async function iframeInfo(src) {
  const key = keyOf(src);
  // Anything still in use is returned as is: a resolve cannot be repeated while its websocket
  // session is alive, and the guard inside it is renewed separately.
  const hit = infos.get(key);
  if (hit) { hit.t = Date.now(); return hit.v; }
  const blocked = sessionBlocks.get(key);
  if (blocked && Date.now() < blocked) {
    const e = new Error('cdn session blocked');
    e.until = blocked;
    throw e;
  }
  const until = failures.get(key);
  if (until && Date.now() < until) {
    const e = new Error('resolve cooling down');
    e.until = until;
    throw e;
  }
  // A seek fires a dozen segment requests at once; one resolve has to serve them all.
  if (!pending.has(key)) {
    pending.set(key, resolveInfo(src)
      .then((v) => { infos.set(key, { t: Date.now(), v }); failures.delete(key); return v; })
      // Nothing about a failure is cached, but the key stays blocked for a moment, otherwise
      // every retry of every segment starts a fresh resolve.
      .catch((e) => {
        // Alloha throttles a repeated /bnsi by answering 404 "content not found", so a refusal
        // and a throttle both wait the long cooldown; only a real network blip is retried soon.
        const refusal = /no websocket session|guard:|bnsi: 404 without hlsSource/.test(e.message);
        failures.set(key, Date.now() + (refusal ? FAIL_ALLoha : FAIL_NETWORK));
        throw e;
      })
      .finally(() => pending.delete(key)));
  }
  return pending.get(key);
}

// One recovery per episode: the promise is shared, and after a successful one the next 15s
// are left alone so ten parallel segments cannot sign the same episode ten times.
const recoveries = new Map();
const RECOVER_QUIET = 15000;

// The edge hash signs every quality of the episode, so one socket serves them all. A second
// socket per quality is what got the session blocked: the CDN tolerates a couple, not one per
// switch. The socket is reopened only when it really dies.
const sessions = new Map();
const pendingSessions = new Map();
const SESSION_TTL = 10 * 60 * 1000;

// The player reports what it plays: playback_start when the socket opens, resumed when the
// video starts, then playing every 30 s with the current position (app.js: Ph() and the PT
// interval). A session that downloads without these looks like a bot and the CDN closes it
// after about five minutes.
function report(s, type) {
  // A throw inside an undici event listener is an uncaught exception, and that is fatal.
  try {
    if (s.ws?.readyState !== 1) return false;
    s.ws.send(JSON.stringify({ type, current_time: Math.floor(s.pos || 0), resolution: s.q, track_id: '1', speed: 1, subtitle: -1, ts: Date.now() }));
    return true;
  } catch (e) { return false; }
}

function connect(s) {
  return new Promise((ok, bad) => {
    const { info } = s;
    const ws = new WebSocket(`${info.pnr}?sid=${encodeURIComponent(info.pnk)}&v=2.1&t=${Date.now()}`,
      { headers: { Origin: info.origin, 'User-Agent': UA } });
    s.ws = ws;
    let settled = false;
    const timer = setTimeout(() => { ws.close(); fail('edge hash timeout'); }, 10000);
    const fail = (msg) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      bad(new Error(msg));
    };
    ws.onopen = () => report(s, 'playback_start');
    ws.onmessage = (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      if (!m.edge_hash) return;
      s.edge = m.edge_hash;
      if (!settled) { settled = true; clearTimeout(timer); ok(); if (!s.paused) report(s, 'resumed'); }
    };
    // A late close from a socket that was already replaced must not orphan the new one.
    ws.onerror = () => { if (s.ws === ws) s.ws = null; fail('edge socket failed'); };
    ws.onclose = () => { if (s.ws === ws) s.ws = null; fail('edge socket closed'); };
  });
}

async function sessionFor(src, want) {
  const info = await iframeInfo(src);
  const q = pickQuality(info.qualities, want);
  const key = keyOf(src);
  const hit = sessions.get(key);
  // The heartbeat reports the quality currently being played, which changes on every switch.
  if (hit && hit.s.edge) { hit.t = Date.now(); hit.s.q = q; return hit.s; }
  if (!pendingSessions.has(key)) {
    const s = { key, src, info, q, edge: null, ws: null };
    pendingSessions.set(key, connect(s)
      .then(() => { sessions.set(key, { t: Date.now(), s }); return s; })
      .finally(() => pendingSessions.delete(key)));
  }
  return pendingSessions.get(key);
}

function dropSession(s) {
  if (sessions.get(s.key)?.s === s) sessions.delete(s.key);
  s.ws?.close();
}

// The websocket session id dies with the socket, so a failed reconnect also invalidates the
// episode it came from: only a fresh /bnsi hands out a usable one.
function dropEpisode(s) {
  dropSession(s);
  infos.delete(keyOf(s.src));
}

// Keeps every used session alive, and forgets the ones nobody played for ten minutes.
setInterval(() => {
  const now = Date.now();
  for (const [key, hit] of infos) if (now - hit.t > INFO_TTL) infos.delete(key);
  for (const [key, until] of failures) if (now >= until) failures.delete(key);
  for (const [key, until] of sessionBlocks) if (now >= until) sessionBlocks.delete(key);
  for (const [key, hit] of recoveries) if (!hit.promise && now - hit.at > 5 * 60 * 1000) recoveries.delete(key);
  for (const [key, hit] of sessions) {
    // Like the player: playing only while the position moves, one paused when it stops, and
    // resumed before the next playing. State moves only on a report that actually went out,
    // so a tick without a live socket is retried on the next one.
    const s = hit.s;
    if (s.pos !== s.reportedPos) {
      if (!s.paused || report(s, 'resumed')) {
        s.paused = false;
        if (report(s, 'playing')) s.reportedPos = s.pos;
      }
    } else if (!s.paused && s.reportedPos != null) {
      if (report(s, 'paused')) s.paused = true;
    }
    if (now - hit.t > SESSION_TTL) { sessions.delete(key); hit.s.ws?.close(); }
    // The socket stays open for minutes (measured), so a missing one means it dropped; only a
    // reconnect that keeps failing means the session itself is spent.
    else if (!hit.s.ws) {
      connect(hit.s).catch(async () => {
        await new Promise((r) => setTimeout(r, 2000));
        connect(hit.s).catch(() => dropEpisode(hit.s));
      });
    }
  }
}, 30000).unref();

const headersFor = (s) => ({
  Origin: s.info.origin, Referer: s.info.origin + '/', 'User-Agent': UA,
  'Accepts-Controls': s.edge, Authorizations: 'Bearer ' + s.info.guard,
});

// A 401/403/410 means something we sign with has expired. The player recovers by renewing its
// proof and reopening the websocket, so the ladder does the same, cheapest step first, and
// only re-resolves the episode at the end (that is what Alloha throttles).
//
// One recovery serves the whole episode: a seek fires ten segments at once and they all see
// the same 403, so without the shared promise and the quiet window that follows it the server
// would sign the same episode dozens of times a minute — which is exactly what gets it refused.
const RETRY_STATUS = /^(401|403|410)$/;

function recoverOnce(key, s) {
  const now = Date.now();
  const hit = recoveries.get(key);
  if (hit) {
    if (hit.promise) return hit.promise;
    if (now - hit.at < RECOVER_QUIET) return Promise.resolve();
  }
  const p = (async () => {
    s.info.guard = await signGuard(s.info.src, s.info.origin, s.info.id);
    dropSession(s);
    try {
      await sessionFor(s.info.src, s.q);
      console.log('recover: guard renewed, socket reopened');
    } catch (e) {
      // The session id died with its socket, and only a fresh /bnsi hands out a usable one.
      infos.delete(key);
      await sessionFor(s.info.src, s.q);
      console.log('recover: episode re-resolved');
    }
  })().then(
    () => recoveries.set(key, { at: Date.now() }),
    () => recoveries.delete(key),
  );
  recoveries.set(key, { at: now, promise: p });
  return p;
}

async function cdnFetch(src, want, url, extra = {}, timeout = TIMEOUT) {
  cdnHosts.add(new URL(url).hostname);
  for (let attempt = 0; attempt < 3; attempt++) {
    let s;
    try {
      s = await sessionFor(src, want);
    } catch (e) {
      // A blocked episode is not worth waiting on: the player gets its answer and retries later.
      if (/session blocked/.test(e.message)) throw e;
      if (attempt === 2) throw e;
      // A cooldown is a wait, not a failure: the player must not be told the stream is gone.
      // The tunnel takes a couple of seconds to come back, so the gaps grow.
      const wait = e.until ? Math.min(e.until - Date.now(), 3000) : [300, 1200, 2500][attempt];
      await new Promise((r) => setTimeout(r, Math.max(wait, 0)));
      continue;
    }
    // Redirects are not followed: our signing headers would travel to whatever host it names.
    let r;
    try {
      r = await fetch(url, { headers: { ...headersFor(s), ...extra }, redirect: 'manual', signal: AbortSignal.timeout(timeout) });
    } catch (e) {
      // The tunnel is replaced in a couple of seconds; that is a retry, not the end of the stream.
      if (attempt === 2) throw e;
      await new Promise((res) => setTimeout(res, [300, 1200][attempt]));
      continue;
    }
    if (!RETRY_STATUS.test(String(r.status))) {
      if (!r.ok && r.status < 400) {
        const to = r.headers.get('location') || '?';
        await r.body?.cancel();
        throw new Error('cdn redirect ' + r.status + ' to ' + to);
      }
      return r;
    }
    await r.arrayBuffer();
    // `x-vd: token_decrypt` means the url token was rejected, `session_blocked` and
    // `client_blocked` mean the CDN has stopped serving this client, and retrying digs deeper.
    const vd = r.headers.get('x-vd') || '';
    if (vd === 'session_blocked' || vd === 'client_blocked') {
      console.log('cdn session blocked, backing off');
      dropSession(s);
      infos.delete(keyOf(src));
      sessionBlocks.set(keyOf(src), Date.now() + SESSION_BLOCK);
      throw new Error('cdn blocked the session');
    }
    if (!attempt) console.log('cdn', r.status, vd || '-', url.slice(8, 40));
    try {
      await recoverOnce(keyOf(src), s);
    } catch (e) {
      // A recovery that could not finish is still a failure of this attempt, never a bypass.
      if (attempt === 2) throw e;
      await new Promise((r) => setTimeout(r, [300, 1200][attempt]));
    }
  }
  throw new Error('cdn refused every attempt');
}

// Only hosts a real player session pointed us to are proxied, so /s is not an open proxy.
const cdnHosts = new Set();

function proxied(base, src, q, url, t) {
  const x = new URL(url);
  cdnHosts.add(x.hostname);
  return `${base}/s?url=${encodeURIComponent(src)}&q=${encodeURIComponent(q)}&u=${encodeURIComponent(x.href)}${t == null ? '' : '&t=' + t.toFixed(1)}`;
}

const rewritePlaylist = (text, playlistUrl, base, src, q) =>
  mapPlaylist(text, playlistUrl, (url, t) => proxied(base, src, q, url, t));

async function playlist(base, src, want) {
  const info = await iframeInfo(src);
  const q = pickQuality(info.qualities, want);
  const masterUrl = info.qualities[q];
  const masterRes = await cdnFetch(src, q, masterUrl);
  const master = await masterRes.text();
  if (!masterRes.ok) throw new Error('master: ' + masterRes.status);
  const line = master.split('\n').find((l) => l.trim() && !l.startsWith('#'));
  if (!line) throw new Error('master: no variant');
  const variantUrl = new URL(line.trim(), masterUrl).href;
  const r = await cdnFetch(src, q, variantUrl);
  const text = await r.text();
  if (!text.includes('#EXTM3U')) throw new Error('variant: ' + r.status);
  return rewritePlaylist(text, variantUrl, base, src, q);
}

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Private-Network': 'true' });
  res.end(body);
}

const isAllowedIframe = (u) => {
  try { const x = new URL(u); return x.protocol === 'https:' && /(^|\.)stravers\.live$/i.test(x.hostname); }
  catch { return false; }
};

http.createServer(async (req, res) => {
  // A malformed path (//, //[ ) throws here, and an unhandled rejection would kill the process.
  let url;
  try { url = new URL(req.url, 'http://x'); }
  catch { return send(res, 400, 'bad path'); }
  const q = url.searchParams;
  // Behind cloudflared the public scheme is https, and a Location with http:// would be blocked as
  // mixed content. Both halves come from the client, so neither is trusted as is.
  const proto = /^https$/i.test(req.headers['x-forwarded-proto'] || '') ? 'https' : 'http';
  const host = /^[a-z0-9.:[\]-]+$/i.test(req.headers.host || '') ? req.headers.host : '127.0.0.1:' + PORT;
  const base = `${proto}://${host}`;
  if (url.pathname !== '/s') console.log(new Date().toISOString().slice(11, 19), req.method, url.pathname, q.get('q') || '');
  if (req.method === 'OPTIONS') {
    // Chrome asks before a public page (lampa.mx) may call a LAN address.
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] || '*',
      'Access-Control-Allow-Private-Network': 'true',
    });
    return res.end();
  }
  try {
    const src = q.get('url');
    if (url.pathname === '/page' || url.pathname === '/tracks') {
      if (!isAllowedIframe(src)) return send(res, 400, 'bad url');
      const page = await playerPage(src);
      return send(res, page.status, JSON.stringify(page.fileList || {}), 'application/json; charset=utf-8');
    }
    if (url.pathname === '/play.m3u8' || url.pathname === '/stream.m3u8') {
      if (!isAllowedIframe(src)) return send(res, 400, 'bad url');
      const body = await playlist(base, src, q.get('q'));
      return send(res, 200, body, 'application/vnd.apple.mpegurl');
    }
    if (url.pathname === '/s') {
      if (!isAllowedIframe(src)) return send(res, 400, 'bad url');
      let target;
      try { target = new URL(q.get('u') || ''); } catch { return send(res, 400, 'bad segment url'); }
      if (target.protocol !== 'https:' || target.port || !cdnHosts.has(target.hostname)) return send(res, 403, 'unknown cdn host');
      // A segment runs to a few MB, and the WARP hop is slower than the CDN itself.
      const up = await cdnFetch(src, q.get('q'), target.href, req.headers.range ? { Range: req.headers.range } : {}, 45000);
      // The player abandons fragments on every seek; there is nobody left to send this to.
      if (res.destroyed) { await up.body?.cancel(); return; }
      // The newest segment the player still wanted is the position the heartbeat reports.
      const t = q.get('t');
      const live = sessions.get(keyOf(src));
      if (live && up.ok && t && Number.isFinite(Number(t))) live.s.pos = Number(t);
      const type = up.headers.get('content-type') || '';
      const isPlaylist = /mpegurl/i.test(type) || /\.m3u8(\?|$)/.test(target.pathname);
      if (up.ok && isPlaylist) {
        const text = await up.text();
        if (text.includes('#EXTM3U')) return send(res, 200, rewritePlaylist(text, target.href, base, src, q.get('q')), 'application/vnd.apple.mpegurl');
        return send(res, up.status, text, type);
      }
      const out = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Private-Network': 'true', 'Content-Type': type || 'video/mp4' };
      for (const h of ['content-length', 'content-range', 'accept-ranges']) if (up.headers.get(h)) out[h] = up.headers.get(h);
      res.writeHead(up.status, out);
      if (!up.body) return res.end();
      // A seek abandons this response. The upstream body has to die with it, and neither a
      // late error from the web stream nor an already-closed destination may reach the process.
      const body = Readable.fromWeb(up.body);
      body.on('error', () => res.destroy());
      pipeline(body, res, () => {});
      return;
    }
    if (url.pathname === '/qualities') {
      if (!isAllowedIframe(src)) return send(res, 400, 'bad url');
      // Answer right away: Lampa asks for this right before playback and has no patience.
      const out = {};
      for (const label of QUALITIES) out[label + 'p'] = `${base}/play.m3u8?q=${label}&url=${encodeURIComponent(src)}`;
      return send(res, 200, JSON.stringify(out), 'application/json; charset=utf-8');
    }
    send(res, 404, 'not found');
  } catch (e) {
    // The query string carries the iframe token, so only the path is logged.
    console.error(url.pathname, e.message);
    if (!res.headersSent) send(res, 502, e.message); else res.end();
  }
}).listen(PORT, '0.0.0.0', () => console.log(`alloha helper on :${PORT}`));

// Alloha helper for online_mod. The player signs every CDN request with three things:
// a Borth header built from the page fingerprint, a guard token from /sarn + /vorf, and a
// per-quality edge hash that arrives over its websocket. All three are reproduced here in
// plain Node, so no browser is needed. Alloha hands out usable tokens only to
// residential-looking IPs, so entrypoint.sh sends the traffic through Cloudflare WARP.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import http from 'node:http';
import { Readable, pipeline } from 'node:stream';
import { bareLabel, borthFor, episodeKey, mapPlaylist, pickQuality, QUALITIES, YB, sourceFor } from './alloha-sign.mjs';
import { handleTurbo } from './turbo.mjs';

const PORT = Number(process.env.PORT || 8790);
// Alloha drops a session a few minutes in when its requests do not come from a browser, and
// then refuses that IP + User-Agent pair. Node's fetch speaks HTTP/1.1 with a TLS handshake no
// browser has, so every HTTP request goes through curl-impersonate, which shakes hands like
// Chrome 152 on Windows and sends its User-Agent and client hints. The websocket stays in Node
// with the same User-Agent. Keep it distinct from the browser you watch in, so a mark on the
// helper cannot land on you.
const IMPERSONATE = 'chrome152';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36';
const CURL = process.env.CURL_IMPERSONATE || '/usr/local/bin/curl-impersonate';

// What Chrome adds to a request from the player iframe on top of curl-impersonate's defaults,
// which describe a top-level navigation. An empty value drops a default header.
const browser = (site, dest = 'empty', mode = 'cors') => ({
  'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
  'Sec-Fetch-Site': site,
  'Sec-Fetch-Mode': mode,
  'Sec-Fetch-Dest': dest,
  ...(mode === 'navigate' ? {} : { 'Upgrade-Insecure-Requests': '', 'Sec-Fetch-User': '', 'Cache-Control': '', Priority: 'u=1, i' }),
});

// fetch() over curl-impersonate: same options this file uses (method, headers, body, signal)
// and a real Response back, with the body streamed. Redirects are not followed, like
// redirect: 'manual'. curl picks up HTTPS_PROXY from the environment, so WARP still applies.
function cfetch(url, { method = 'GET', headers = {}, body, signal } = {}) {
  // -g: curl would otherwise expand [1-5000] or {a,b} in a url into many requests.
  const args = ['--impersonate', IMPERSONATE, '--compressed', '-g', '-sS', '-i', '--suppress-connect-headers', '-X', method];
  for (const [k, v] of Object.entries(headers)) if (v != null) args.push('-H', v === '' ? `${k}:` : `${k}: ${v}`);
  if (body != null) args.push('--data-binary', '@-');
  args.push(url);
  return new Promise((ok, bad) => {
    const child = spawn(CURL, args, { stdio: [body != null ? 'pipe' : 'ignore', 'pipe', 'pipe'] });
    let err = '', head = Buffer.alloc(0), done = false;
    const exit = new Promise((r) => child.on('close', r));
    const fail = (e) => { if (!done) { done = true; child.kill(); bad(e); } };
    signal?.addEventListener('abort', () => { child.kill(); fail(signal.reason || new Error('aborted')); }, { once: true });
    child.stderr.on('data', (c) => { err += c; });
    child.on('error', fail);
    exit.then((code) => fail(new Error(`curl ${code}: ${err.trim() || 'no response'}`)));
    if (body != null) { child.stdin.on('error', () => {}); child.stdin.end(body); }
    const onData = (chunk) => {
      head = Buffer.concat([head, chunk]);
      for (;;) {
        const end = head.indexOf('\r\n\r\n');
        if (end < 0) return;
        const lines = head.subarray(0, end).toString('latin1').split('\r\n');
        head = head.subarray(end + 4);
        const status = Number((lines[0].match(/^HTTP\/[\d.]+ (\d{3})/) || [])[1]);
        if (status >= 100 && status < 200) continue;
        child.stdout.pause();
        child.stdout.off('data', onData);
        // This runs inside a stream listener, where a throw would kill the whole process.
        try {
          const h = new Headers();
          for (const l of lines.slice(1)) { const i = l.indexOf(':'); if (i > 0) h.append(l.slice(0, i).trim(), l.slice(i + 1).trim()); }
          // curl has already decoded the body, so the encoded length no longer describes it.
          if (h.has('content-encoding')) { h.delete('content-encoding'); h.delete('content-length'); }
          // The rest of stdout is the body, the bytes read past the headers first. A curl that
          // dies mid-body must fail the stream, not end it short like a complete response.
          const rest = Readable.from((async function* () {
            if (head.length) yield head;
            for await (const c of child.stdout) yield c;
            const code = await exit;
            if (code !== 0) throw new Error(`curl ${code}: ${err.trim()}`);
          })());
          rest.on('error', () => child.kill());
          const res = new Response([204, 205, 304].includes(status) ? null : Readable.toWeb(rest), { status, headers: h });
          done = true;
          return ok(res);
        } catch (e) { return fail(e); }
      }
    };
    child.stdout.on('data', onData);
  });
}
const PARENT = 'https://onomovie.ru';
// Alloha answers in a second or two; anything slower is a stalled proxy and Lampa has given up.
const TIMEOUT = 20000;

async function playerPage(src) {
  const up = await cfetch(src, { headers: { ...browser('cross-site', 'iframe', 'navigate'), Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8', 'Upgrade-Insecure-Requests': '1', Referer: PARENT + '/' }, signal: AbortSignal.timeout(TIMEOUT) });
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
  const sarn = await (await cfetch(`${origin}/sarn`, {
    headers: { ...browser('same-origin'), Accept: '*/*', Referer: src, acceptis: `${YB}.${id}` },
    signal: AbortSignal.timeout(TIMEOUT),
  })).json();
  const proof = crypto.createHash('sha256').update([sarn.nonce, YB, sarn.uap, origin, origin].join('|')).digest('hex');
  const vorf = await (await cfetch(`${origin}/vorf`, {
    method: 'POST',
    headers: { ...browser('same-origin'), Accept: '*/*', Referer: src, Origin: origin, 'Content-Type': 'application/json', 'accepts-block': YB },
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
  const bnsiRes = await cfetch(`${origin}/bnsi/${kind}/${id}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest',
      ...browser('same-origin'), Accept: 'application/json, text/javascript, */*; q=0.01', Referer: src, Origin: origin, Borth: borthFor(page.viewport),
    },
    body: `token=${encodeURIComponent(token)}&av1=true&autoplay=0&audio=&subtitle=`,
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const bnsi = await bnsiRes.json();
  const sources = (bnsi.hlsSource || []).map((x) => {
    const qualities = {};
    for (const [label, links] of Object.entries(x.quality || {})) {
      const link = String(links).split(' or ').filter(Boolean)[0];
      if (link) qualities[label] = link;
    }
    return { label: x.label || null, audioId: x.audioId == null ? null : String(x.audioId), default: !!x['default'], qualities };
  }).filter((x) => Object.keys(x.qualities).length);
  if (!sources.length) throw new Error('bnsi: ' + bnsiRes.status + ' without hlsSource');
  // Without a websocket session Alloha hands out urls the CDN cannot decrypt, so this is fatal.
  if (!bnsi.pnr || !bnsi.pnk) throw new Error('bnsi: no websocket session (Alloha refuses this client right now)');

  const defaultSource = sources.find((x) => x.default) || sources[0];
  const subtitles = (bnsi.tracks || []).filter((x) => x && x.src && x.label).map((x) => ({ label: x.label, default: !!x['default'], src: x.src }));
  return { src, origin, id, guard: await signGuard(src, origin, id), pnr: bnsi.pnr, pnk: bnsi.pnk, sources, subtitles, audio: defaultSource.label || null, meta: {} };
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
    console.log('ws>', type, Math.floor(s.pos || 0), s.q);
    return true;
  } catch (e) { return false; }
}

// The player also posts analytics to /events every 30 s (app.js: DK queues, DX flushes):
// view_start and playback_ready once, then a heartbeat per 10 s of playback. It is the last
// channel the helper did not reproduce, so the same batches go out, built from what the proxy
// really saw (position, bytes, the stream's bitrate and size) plus a plausible screen.
function postEvents(s, played) {
  const { info } = s;
  const m = info.meta[s.q] || {};
  const now = Date.now();
  const token = new URL(info.src).searchParams.get('token') || '';
  const event = (type, at, extra) => ({
    url: null, manifestUrl: m.manifestUrl || null, currentTime: s.pos || 0, duration: m.duration || null,
    bufferLength: 30, paused: false, audioTrack: info.audio, quality: Number(s.q), subtitle: null, // shortcut: reports the default track's label even when another track plays, fix if Alloha starts refusing switched tracks.
    event_type: type, at, since: at - (s.lastFlush || s.playerInitAt), ...extra,
  });
  const events = [];
  if (!s.viewStarted) {
    s.viewStarted = true;
    events.push(event('view_start', now, { fileChangeType: null, autoplay: false, resumeFrom: s.pos || 0, startupQuality: Number(s.q), startupAudio: info.audio }));
    events.push(event('playback_ready', now, { timeToPlaybackReadyMs: 1500, bandwidthEstimate: 5e7 }));
  }
  const bytes = s.bytes || 0, dBytes = bytes - (s.bytesReported || 0);
  s.bytesReported = bytes;
  for (let i = 2; i >= 0; i--) {
    events.push(event('heartbeat', now - i * 10000, {
      currentTime: Math.max(0, (s.pos || 0) - (i * played) / 3), bandwidthEstimate: 5e7,
      droppedFrames: 0, droppedFramesDelta: 0, playedSecondsDelta: Math.round((played / 3) * 1000) / 1000,
      isBuffering: false, isSeeking: false, playbackRate: 1, currentBitrate: m.bitrate || null,
      currentFrameRate: m.fps || null, videoWidth: m.width || null, videoHeight: m.height || null,
      isUpscaling: false, rebufferCountSession: 0, rebufferTotalMsSession: 0,
      bytesLoadedTotal: bytes, bytesLoadedDelta: Math.round(dBytes / 3),
    }));
  }
  s.lastFlush = now;
  const payload = {
    token, domain: encodeURIComponent(PARENT + '/'), isTrailer: false, dropped: 0,
    playerInitAt: s.playerInitAt, clientSessionId: s.clientSessionId,
    clientRequestId: crypto.randomBytes(16).toString('hex'),
    env: { connectionType: '4g', downlink: 10, pixelRatio: 1, screenW: 1920, screenH: 1080 }, events,
  };
  cfetch(`${info.origin}/events`, {
    method: 'POST',
    headers: { ...browser('same-origin'), Accept: '*/*', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', Referer: info.src, Origin: info.origin },
    body: new URLSearchParams({ token, payload: JSON.stringify(payload) }).toString(),
    signal: AbortSignal.timeout(TIMEOUT),
  }).then((r) => { console.log('events', r.status, events.map((e) => e.event_type).join(',')); return r.arrayBuffer(); })
    .catch((e) => console.log('events failed', e.message));
}

function connect(s) {
  return new Promise((ok, bad) => {
    const { info } = s;
    const ws = new WebSocket(`${info.pnr}?sid=${encodeURIComponent(info.pnk)}&v=2.1&t=${Date.now()}`,
      { headers: { Origin: info.origin, 'User-Agent': UA, 'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7', 'Cache-Control': 'no-cache', Pragma: 'no-cache' } });
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
      try { m = JSON.parse(ev.data); } catch { console.log('ws< (not json)', String(ev.data).length, 'bytes'); return; }
      if (!m || typeof m !== 'object') return;
      // Logged so the log shows what the server tells a session before the CDN blocks it; the
      // hash itself is a credential (Accepts-Controls) and stays out of the log.
      console.log('ws<', m.type, Object.keys(m).filter((k) => k !== 'type').map((k) => k === 'edge_hash' ? k : `${k}=${String(m[k]).slice(0, 40)}`).join(' '));
      if (!m.edge_hash) return;
      if (s.edge && m.edge_hash !== s.edge) console.log('ws< edge hash changed');
      s.edge = m.edge_hash;
      if (!settled) { settled = true; clearTimeout(timer); ok(); if (!s.paused) report(s, 'resumed'); }
    };
    // A late close from a socket that was already replaced must not orphan the new one.
    ws.onerror = () => { if (s.ws === ws) s.ws = null; fail('edge socket failed'); };
    ws.onclose = (e) => { console.log('ws closed', e.code, e.reason || ''); if (s.ws === ws) s.ws = null; fail('edge socket closed'); };
  });
}

async function sessionFor(src, want) {
  const info = await iframeInfo(src);
  const source = sourceFor(info, src);
  const q = pickQuality(source.qualities, want);
  const key = keyOf(src);
  const hit = sessions.get(key);
  // The heartbeat reports the quality currently being played, which changes on every switch.
  if (hit && hit.s.edge) { hit.t = Date.now(); hit.s.q = q; return hit.s; }
  if (!pendingSessions.has(key)) {
    const s = { key, src, info, q, edge: null, ws: null, playerInitAt: Date.now(), clientSessionId: crypto.randomBytes(16).toString('hex') };
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
  for (const [key, hit] of refreshes) if (!hit.promise && now - hit.at > REFRESH_EVERY) refreshes.delete(key);
  // A segment path is dropped with its episode, never while it resolves or refreshes.
  for (const k of origins.keys()) {
    const ep = k.slice(0, k.indexOf('|'));
    if (!infos.has(ep) && !pending.has(ep) && !refreshes.has(ep)) { origins.delete(k); moves.delete(k); }
  }
  for (const [key, hit] of sessions) {
    // Like the player: playing only while the position moves, one paused when it stops, and
    // resumed before the next playing. State moves only on a report that actually went out,
    // so a tick without a live socket is retried on the next one.
    const s = hit.s;
    if (s.pos !== s.reportedPos) {
      if (!s.paused || report(s, 'resumed')) {
        s.paused = false;
        if (report(s, 'playing')) {
          // Seconds played since the last tick; a seek is not playback, so it is capped.
          const played = Math.max(0, Math.min(45, s.pos - (s.reportedPos ?? s.pos)));
          s.reportedPos = s.pos;
          postEvents(s, played);
        }
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
  ...browser('cross-site'), Accept: '*/*', Origin: s.info.origin, Referer: s.info.origin + '/',
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

// A session dies about two minutes after Alloha rotates its edge hash (seen twice: blocked 96 s
// and 108 s after "edge hash changed"), while the player keeps asking for segments from the
// playlist it already holds. So a blocked episode gets a fresh session, and every segment is
// moved onto the new session's path: the file name (seg-686-f1-v1-a1.m4s) stays, only the
// signed path in front of it changes. At most one refresh per two minutes per episode.
// origins: the segment path of the playlist the player holds; moves: where a refresh put it.
const origins = new Map();
const moves = new Map();
const refreshes = new Map();
const REFRESH_EVERY = 2 * 60 * 1000;
const dirOf = (u) => u.slice(0, u.lastIndexOf('/') + 1);

// Only urls under the player's original path move, and only after a refresh; init segments,
// keys or renditions elsewhere stay where the playlist put them.
function audioOf(src) {
  try { return new URL(src).searchParams.get('audio') ?? ''; } catch { return ''; }
}
function relocate(src, q, url) {
  const k = keyOf(src) + '|' + audioOf(src) + '|' + q;
  const from = origins.get(k), to = moves.get(k);
  return from && to && url.startsWith(from) ? to + url.slice(from.length) : url;
}

// shortcut: refreshes only the quality that hit the block; a switch to another quality right
// after a refresh waits out the two minutes. Refresh every known quality if that shows up.
function refreshEpisode(src, want) {
  const key = keyOf(src);
  const hit = refreshes.get(key);
  if (hit?.promise) return hit.promise;
  if (hit && Date.now() - hit.at < REFRESH_EVERY) return Promise.resolve(false);
  const p = (async () => {
    const old = sessions.get(key)?.s;
    if (old) dropSession(old);
    infos.delete(key);
    const info = await iframeInfo(src);
    const source = sourceFor(info, src);
    const q = pickQuality(source.qualities, want);
    const s = await sessionFor(src, q);
    if (old) { s.pos = old.pos; s.reportedPos = old.reportedPos; s.bytes = old.bytes; }
    const masterUrl = source.qualities[q];
    const r = await cfetch(masterUrl, { headers: headersFor(s), signal: AbortSignal.timeout(TIMEOUT) });
    const master = await r.text();
    const line = r.ok && master.split('\n').find((l) => l.trim() && !l.startsWith('#'));
    if (!line) throw new Error('master ' + r.status);
    const base = dirOf(new URL(line.trim(), masterUrl).href);
    cdnHosts.add(new URL(base).hostname);
    moves.set(key + '|' + audioOf(src) + '|' + q, base);
    console.log('session refreshed, segments moved to the new path');
    return true;
  })().catch((e) => { console.log('refresh failed:', e.message); return false; })
    .then((ok) => { refreshes.set(key, { at: Date.now() }); return ok; });
  refreshes.set(key, { at: Date.now(), promise: p });
  return p;
}

async function cdnFetch(src, want, url, extra = {}, timeout = TIMEOUT) {
  cdnHosts.add(new URL(url).hostname);
  for (let attempt = 0; attempt < 3; attempt++) {
    url = relocate(src, want, url);
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
      r = await cfetch(url, { headers: { ...headersFor(s), ...extra }, signal: AbortSignal.timeout(timeout) });
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
      // The retry relocates the url onto the fresh session's path at the top of the loop.
      if (await refreshEpisode(src, want)) continue;
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
  const source = sourceFor(info, src);
  const q = pickQuality(source.qualities, want);
  const masterUrl = source.qualities[q];
  const masterRes = await cdnFetch(src, q, masterUrl);
  const master = await masterRes.text();
  if (!masterRes.ok) throw new Error('master: ' + masterRes.status);
  const line = master.split('\n').find((l) => l.trim() && !l.startsWith('#'));
  if (!line) throw new Error('master: no variant');
  const variantUrl = new URL(line.trim(), masterUrl).href;
  const r = await cdnFetch(src, q, variantUrl);
  const text = await r.text();
  if (!text.includes('#EXTM3U')) throw new Error('variant: ' + r.status);
  // A fresh playlist carries fresh paths, so any earlier move no longer applies.
  origins.set(keyOf(src) + '|' + audioOf(src) + '|' + q, dirOf(variantUrl));
  moves.delete(keyOf(src) + '|' + audioOf(src) + '|' + q);
  // What /events reports about the stream, read from the playlists the player gets.
  const inf = master.split('\n').find((l) => l.startsWith('#EXT-X-STREAM-INF')) || '';
  const num = (re) => Number((inf.match(re) || [])[1]) || null;
  info.meta[q] = {
    manifestUrl: masterUrl, bitrate: num(/BANDWIDTH=(\d+)/), fps: num(/FRAME-RATE=([\d.]+)/),
    width: num(/RESOLUTION=(\d+)x/), height: num(/RESOLUTION=\d+x(\d+)/),
    duration: text.split('\n').reduce((sum, l) => sum + (l.startsWith('#EXTINF:') ? parseFloat(l.slice(8)) || 0 : 0), 0),
  };
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
      // Without q (the plugin's fallback when /qualities failed) the best quality plays, not 360p.
      const body = await playlist(base, src, q.get('q') || QUALITIES[QUALITIES.length - 1]);
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
      if (live && up.ok) live.s.bytes = (live.s.bytes || 0) + (Number(up.headers.get('content-length')) || 0);
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
    if (await handleTurbo(req, res, url, base)) return;
    if (url.pathname === '/qualities') {
      if (!isAllowedIframe(src)) return send(res, 400, 'bad url');
      // Answer right away: Lampa asks this for every episode of the season before playback
      // starts, so a resolve here would cost a /bnsi per episode. The plugin drops 4K itself
      // where Alloha has no uhd mark; a quality the episode lacks falls back in pickQuality.
      const out = {};
      for (const label of QUALITIES) out[label + 'p'] = `${base}/play.m3u8?q=${label}&url=${encodeURIComponent(src)}`;
      return send(res, 200, JSON.stringify(out), 'application/json; charset=utf-8');
    }
    if (url.pathname === '/audios') {
      if (!isAllowedIframe(src)) return send(res, 400, 'bad url');
      // This costs the /bnsi of the episode asked about; only playback of that same episode reuses it.
      const info = await iframeInfo(src);
      return send(res, 200, JSON.stringify(info.sources.map((x) => ({ label: x.label, audioId: x.audioId, default: x.default }))), 'application/json; charset=utf-8');
    }
    if (url.pathname === '/voiceovers') {
      if (!isAllowedIframe(src)) return send(res, 400, 'bad url');
      // For an external player (DDD), which cannot ask the plugin: every track of this episode as
      // a ready stream with its own quality list. It asks when the episode starts, so the resolve
      // is the one playback needs anyway. `id` survives Alloha renumbering a track between episodes.
      const info = await iframeInfo(src);
      const chosen = sourceFor(info, src);
      const bare = src.replace(/&audio=[^&]*/g, '');
      const voiceovers = info.sources.filter((x) => x.label).map((x) => {
        const s = encodeURIComponent(bare + '&audio=' + encodeURIComponent(x.label));
        return {
          id: bareLabel(x.label), name: x.label, selected: x === chosen, url: `${base}/stream.m3u8?url=${s}`,
          qualities: QUALITIES.filter((label) => x.qualities[label]).reverse().map((label) => ({ name: label + 'p', url: `${base}/play.m3u8?q=${label}&url=${s}` })),
        };
      });
      return send(res, 200, JSON.stringify({ voiceovers }), 'application/json; charset=utf-8');
    }
    if (url.pathname === '/subs') {
      if (!isAllowedIframe(src)) return send(res, 400, 'bad url');
      // Same cost as /audios: the plugin asks only for the episode it is about to play.
      const info = await iframeInfo(src);
      return send(res, 200, JSON.stringify(info.subtitles.map((x) => ({ label: x.label, default: x.default }))), 'application/json; charset=utf-8');
    }
    if (url.pathname === '/sub.vtt') {
      if (!isAllowedIframe(src)) return send(res, 400, 'bad url');
      // By label, so the plugin can hand the player links for episodes it has not resolved yet;
      // the resolve happens when the player loads the episode, which it needs anyway.
      const info = await iframeInfo(src);
      // An external player (ExoPlayer) fails the whole episode when one of its subtitle links
      // fails, and it gets links by label for episodes whose file may lack that label. So
      // subtitles that cannot be served are answered as an empty track, not as an error.
      const empty = (why) => { console.log('sub.vtt: empty,', why); return send(res, 200, 'WEBVTT\n\n', 'text/vtt; charset=utf-8'); };
      const sub = info.subtitles.find((x) => x.label === q.get('label'));
      if (!sub) return empty('no such label');
      let target;
      try { target = new URL(sub.src); } catch { return empty('bad url'); }
      // Only Alloha's CDN: the helper is reachable from the internet and must not fetch arbitrary hosts.
      if (target.protocol !== 'https:' || target.port || !/(^|\.)userplay\.live$/i.test(target.hostname)) return empty('foreign host');
      // The player loads them with a plain GET from its own page, full page url as Referer
      // (measured); no session headers are needed.
      const up = await cfetch(target.href, {
        headers: { ...browser('cross-site'), Accept: '*/*', Origin: info.origin, Referer: info.src },
        signal: AbortSignal.timeout(TIMEOUT),
      });
      const text = await up.text();
      return up.ok ? send(res, 200, text, 'text/vtt; charset=utf-8') : empty('cdn ' + up.status);
    }
    send(res, 404, 'not found');
  } catch (e) {
    // The query string carries the iframe token, so only the path is logged.
    console.error(url.pathname, e.message);
    if (!res.headersSent) send(res, 502, e.message); else res.end();
  }
}).listen(PORT, '0.0.0.0', () => console.log(`alloha helper on :${PORT}`));

// Alloha helper for online_mod: the player page signs its stream request in obfuscated JS
// and the CDN only answers with the player's Origin, so a headless Chrome gets the link
// and this server proxies the HLS with that Origin. Run: node server/alloha.mjs
import { spawn } from 'node:child_process';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';

const PORT = Number(process.env.PORT || 8790);
const CDP = 9334;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CHROME_ARGS = (process.env.CHROME_ARGS || '').split(' ').filter(Boolean);
// Must match the real platform: a macOS UA on Linux Chrome is an easy bot flag.
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let chrome = null;
function startChrome() {
  chrome = spawn(CHROME, [
    '--headless', `--remote-debugging-port=${CDP}`, `--user-data-dir=${path.join(os.tmpdir(), 'alloha-chrome')}`,
    '--no-first-run', '--no-default-browser-check', '--mute-audio', '--disable-blink-features=AutomationControlled', `--user-agent=${UA}`, ...CHROME_ARGS, 'about:blank',
  ], { stdio: 'ignore' });
  chrome.unref();
  chrome.on('exit', () => { chrome = null; });
}
startChrome();

async function browserWs() {
  if (!chrome) startChrome();
  for (let i = 0; i < 40; i++) {
    try {
      const v = await (await fetch(`http://127.0.0.1:${CDP}/json/version`)).json();
      return v.webSocketDebuggerUrl;
    } catch { await sleep(250); }
  }
  throw new Error('chrome did not start');
}

function isAllowedIframe(u) {
  try {
    const x = new URL(u);
    return x.protocol === 'https:' && /(^|\.)stravers\.live$/i.test(x.hostname);
  } catch { return false; }
}

// Alloha bans for hammering: never start two captures closer than 5s apart.
let lastCaptureAt = 0;
async function captureSlot() {
  const wait = lastCaptureAt + 5000 - Date.now();
  if (wait > 0) await sleep(wait);
  lastCaptureAt = Date.now();
}

// Opens the player page inside an iframe and waits for its master.m3u8 request.
async function capture(iframe, q) {
  await captureSlot();
  const ws = new WebSocket(await browserWs());
  await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = fail; });
  let id = 0;
  const waiters = new Map();
  const call = (method, params = {}, sessionId) => new Promise(res => {
    const n = ++id;
    waiters.set(n, res);
    ws.send(JSON.stringify({ id: n, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  let done, qualities = null;
  const masterIds = new Map();
  const found = new Promise(r => { done = r; });
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && waiters.has(m.id)) { waiters.get(m.id)(m.result || {}); waiters.delete(m.id); return; }
    if (m.method === 'Target.attachedToTarget') {
      const sid = m.params.sessionId;
      // The player asks for the quality saved in its own localStorage, so set it before the app boots.
      if (q) call('Page.addScriptToEvaluateOnNewDocument', { source: `try{var k='allplay',o=JSON.parse(localStorage.getItem(k)||'{}');o.quality=${Number(q)};localStorage.setItem(k,JSON.stringify(o))}catch(e){}` }, sid);
      call('Network.enable', {}, sid);
      call('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }, sid);
      call('Runtime.runIfWaitingForDebugger', {}, sid);
    } else if (m.method === 'Network.requestWillBeSent') {
      // The player probes several edges; some answer 403, so remember the url and wait for a 200.
      if (/\/master\.m3u8(\?|$)/.test(m.params.request.url)) masterIds.set(m.params.requestId, m.params.request.url);
    } else if (m.method === 'Network.responseReceived' && masterIds.has(m.params.requestId) && m.params.response.status === 200) {
      done(masterIds.get(m.params.requestId));
    } else if (m.method === 'Network.responseReceived' && /\/bnsi\//.test(m.params.response.url)) {
      call('Network.getResponseBody', { requestId: m.params.requestId }, m.sessionId).then(r => {
        if (r && r.body) qualities = r.body;
      });
    }
  };
  ws.onclose = () => { for (const r of waiters.values()) r({}); done(null); };
  let targetId;
  try {
    ({ targetId } = await call('Target.createTarget', { url: 'about:blank' }));
    const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
    await call('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }, sessionId);
    await call('Network.enable', {}, sessionId);
    await call('Page.navigate', { url: `http://127.0.0.1:${PORT}/frame?src=${encodeURIComponent(iframe)}` }, sessionId);
    const master = await Promise.race([found, sleep(25000).then(() => null)]);
    if (!master) return null;
    for (let i = 0; i < 20 && !qualities; i++) await sleep(100);
    const origin = new URL(iframe).origin;
    let map = null;
    try {
      const src = JSON.parse(qualities).hlsSource || [];
      console.log('qualities', Object.keys((src[0] || {}).quality || {}).join(','));
      const first = src.find(x => x['default']) || src[0] || {};
      map = {};
      for (const [label, links] of Object.entries(first.quality || {})) {
        const link = String(links).split(' or ').filter(Boolean)[0];
        if (link) map[label] = { url: link, origin };
      }
    } catch (e) { map = null; }
    return { master, origin, map };
  } finally {
    if (targetId) ws.send(JSON.stringify({ id: ++id, method: 'Target.closeTarget', params: { targetId } }));
    setTimeout(() => ws.close(), 500);
  }
}

// shortcut: in-memory cache, stale entries dropped only when hit again, fine for one household
const cache = new Map();
const TTL = 4 * 60 * 1000;
const inflight = new Map();
// /hls only fetches CDN hosts a real player session pointed us to, so it is not an open proxy.
const cdnHosts = new Set();
let lastClearAt = 0;
async function streamFor(iframe, q) {
  const key = iframe + '|' + (q || '');
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < TTL) return hit.v;
  if (hit) cache.delete(key);
  if (!inflight.has(key)) {
    inflight.set(key, capture(iframe, q).finally(() => inflight.delete(key)));
  }
  const v = await inflight.get(key);
  if (v) {
    cache.set(key, { t: Date.now(), v });
    cdnHosts.add(new URL(v.master).hostname);
    for (const q2 of Object.values(v.map || {})) cdnHosts.add(new URL(q2.url).hostname);
  }
  return v;
}

const hlsUrl = (base, origin, u) => `${base}/hls?o=${encodeURIComponent(origin)}&u=${encodeURIComponent(u)}`;

function rewritePlaylist(text, src, origin, base) {
  const abs = u => {
    const x = new URL(u, src);
    cdnHosts.add(x.hostname);
    return x.href;
  };
  return text.split('\n').map(line => {
    const l = line.trim();
    if (!l) return line;
    if (l.startsWith('#')) return line.replace(/URI="([^"]+)"/g, (_, u) => `URI="${hlsUrl(base, origin, abs(u))}"`);
    return hlsUrl(base, origin, abs(l));
  }).join('\n');
}

async function proxyHls(req, res, q, base) {
  const u = q.get('u');
  const origin = q.get('o');
  if (!u || !origin || !/^https:\/\/[a-z0-9.-]+\.stravers\.live$/i.test(origin)) return send(res, 400, 'bad hls params');
  let target;
  try { target = new URL(u); } catch { return send(res, 400, 'bad hls url'); }
  if (target.protocol !== 'https:' || !cdnHosts.has(target.hostname)) return send(res, 403, 'unknown cdn host');
  const headers = { Origin: origin, Referer: origin + '/', 'User-Agent': UA };
  if (req.headers.range) headers.Range = req.headers.range;
  const ac = new AbortController();
  res.on('close', () => ac.abort());
  const up = await fetch(u, { headers, signal: ac.signal });
  const type = up.headers.get('content-type') || '';
  if (up.ok && /mpegurl/i.test(type) || /\.m3u8(\?|$)/.test(new URL(u).pathname)) {
    const body = rewritePlaylist(await up.text(), u, origin, base);
    return send(res, up.status, body, 'application/vnd.apple.mpegurl');
  }
  // A 403 means the signed link died; drop the cache, but at most once a minute so a
  // broken episode cannot turn into a capture storm.
  if (up.status === 403 && Date.now() - lastClearAt > 60000) {
    cache.clear();
    lastClearAt = Date.now();
  }
  const out = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Private-Network': 'true', 'Content-Type': type || 'application/octet-stream' };
  for (const h of ['content-length', 'content-range', 'accept-ranges']) if (up.headers.get(h)) out[h] = up.headers.get(h);
  res.writeHead(up.status, out);
  if (!up.body) return res.end();
  Readable.fromWeb(up.body).on('error', () => res.destroy()).pipe(res);
}

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Private-Network': 'true' });
  res.end(body);
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const q = url.searchParams;
  // Behind cloudflared the public scheme is https, and a Location with http:// would be blocked as mixed content.
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const base = `${proto}://${req.headers.host}`;
  if (url.pathname !== '/hls') console.log(new Date().toISOString().slice(11, 19), req.method, url.pathname, req.headers.origin || '');
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
    if (url.pathname === '/frame') {
      const src = q.get('src');
      if (!isAllowedIframe(src)) return send(res, 400, 'bad src');
      const safe = new URL(src).href.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
      return send(res, 200, `<!doctype html><body style="margin:0"><iframe src="${safe}" width="1280" height="720" allow="autoplay; fullscreen"></iframe>`, 'text/html; charset=utf-8');
    }
    if (url.pathname === '/page' || url.pathname === '/tracks') {
      const src = q.get('url');
      if (!isAllowedIframe(src)) return send(res, 400, 'bad url');
      const up = await fetch(src, { headers: { Referer: 'https://onomovie.ru/', 'User-Agent': UA } });
      const body = (await up.text()).replace(/\n/g, '');
      const fileList = body.match(/ fileList = JSON\.parse\('(\{.*\})'\);/);
      return send(res, up.status, fileList ? fileList[1] : '{}', 'application/json; charset=utf-8');
    }
    if (url.pathname === '/stream' || url.pathname === '/stream.m3u8') {
      const src = q.get('url');
      if (!isAllowedIframe(src)) return send(res, 400, 'bad url');
      const s = await streamFor(src);
      if (!s) return send(res, 502, 'no stream');
      const labels = Object.keys(s.map || {}).sort((a, b) => (+b || 0) - (+a || 0));
      const want = q.get('q') || labels[0];
      const pick = want && s.map && s.map[want] ? s.map[want] : null;
      const target = pick ? pick.url : s.master;
      res.writeHead(302, { Location: hlsUrl(base, s.origin, target), 'Access-Control-Allow-Origin': '*' });
      return res.end();
    }
    if (url.pathname === '/qualities') {
      const src = q.get('url');
      if (!isAllowedIframe(src)) return send(res, 400, 'bad url');
      const s = await streamFor(src);
      if (!s) return send(res, 502, 'no stream');
      const out = {};
      for (const [label, q2] of Object.entries(s.map || {})) {
        out[label + 'p'] = `${base}/stream.m3u8?q=${encodeURIComponent(label)}&url=${encodeURIComponent(src)}`;
      }
      return send(res, 200, JSON.stringify(out), 'application/json; charset=utf-8');
    }
    if (url.pathname === '/hls') return await proxyHls(req, res, q, base);
    // Everything else is Lampa itself: same origin as the helper, so Chrome does not
    // apply its "insecure page cannot reach the local network" rule.
    const up = await fetch('http://lampa.mx' + req.url, { headers: { 'User-Agent': UA, Accept: req.headers.accept || '*/*' } });
    const out = { 'Content-Type': up.headers.get('content-type') || 'application/octet-stream', 'Cache-Control': up.headers.get('cache-control') || 'no-store' };
    res.writeHead(up.status, out);
    const body = Buffer.from(await up.arrayBuffer());
    res.end(body);
  } catch (e) {
    console.error(req.url.slice(0, 120), e.message);
    if (!res.headersSent) send(res, 502, e.message); else res.end();
  }
}).listen(PORT, '0.0.0.0', () => console.log(`alloha helper on :${PORT}`));

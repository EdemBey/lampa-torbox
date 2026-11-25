// TorBox relay for the TorBox plugin. api.torbox.app refuses CORS from lampa.mx, so a browser
// cannot call it; the helper does, and the user's key never passes a third-party proxy.
// Only api.torbox.app/v1/api/* is reachable: the helper is public.
const TIMEOUT = 20000;
const BASE = 'https://api.torbox.app/v1/api/';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Private-Network': 'true' };

// pathname is the raw request path (before URL normalisation resolves ../ or %2e%2e).
export function targetFor(pathname, search = '') {
  const m = /^\/torbox\/([A-Za-z0-9_\-/]+)$/.exec(String(pathname || ''));
  if (!m || m[1].startsWith('/') || m[1].includes('//')) return null;
  const s = String(search || '');
  if (s && !s.startsWith('?')) return null;
  let u;
  try { u = new URL(BASE + m[1] + s); } catch { return null; }
  if (u.origin !== 'https://api.torbox.app' || !u.pathname.startsWith('/v1/api/')) return null;
  return u.href;
}

const text = (res, status, body) => {
  res.writeHead(status, { ...cors, 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(body);
};

export async function handleTorbox(req, res, url) {
  const raw = String(req.url || '');
  if (!raw.startsWith('/torbox/')) return false;
  const q = raw.indexOf('?');
  const path = q === -1 ? raw : raw.slice(0, q);
  try {
    const target = targetFor(path, url.search);
    if (!target) { text(res, 400, 'bad path'); return true; }
    if (req.method !== 'GET' && req.method !== 'POST') { text(res, 405, 'method not allowed'); return true; }

    const headers = {};
    for (const h of ['x-api-key', 'authorization', 'content-type']) if (req.headers[h]) headers[h] = req.headers[h];

    let body;
    if (req.method === 'POST') {
      const chunks = [];
      let n = 0;
      for await (const c of req) {
        if ((n += c.length) > 65536) { text(res, 413, 'too large'); return true; }
        chunks.push(c);
      }
      body = Buffer.concat(chunks);
    }

    const up = await fetch(target, { method: req.method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT) });
    const location = up.headers.get('location');
    // requestdl&redirect=true answers with a redirect to the file; a browser fetch would follow it
    // and download the video, so the link comes back as the JSON the plugin already reads.
    if (up.status >= 300 && up.status < 400 && location && new URL(target).pathname.endsWith('/torrents/requestdl')) {
      await up.body?.cancel();
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, data: location }));
      return true;
    }
    const buf = Buffer.from(await up.arrayBuffer());
    res.writeHead(up.status, { ...cors, 'Content-Type': up.headers.get('content-type') || 'application/json; charset=utf-8' });
    res.end(buf);
    return true;
  } catch (e) {
    // The path only: the query carries the token.
    console.error('torbox', path, e.message);
    if (!res.headersSent) text(res, 502, 'bad gateway');
    else res.end();
    return true;
  }
}

// HDrezka proxy for online_mod. Rezka sends no CORS headers and its Anubis bot check
// passes only app user agents (okhttp/4.12.0 gets the real page), so a browser cannot
// reach it directly: the helper relays with that UA, mirroring the CORS-proxy URL protocol
// the plugin already speaks, so plugin changes stay tiny.
const TIMEOUT = 20000;

export function isRezkaPath(pathname) {
  return pathname.startsWith('/enc2/') || pathname.startsWith('/param/') ||
    pathname.startsWith('/cookie_plus/') || pathname.startsWith('/http:') ||
    pathname.startsWith('/https:');
}

export function parseProxyPath(raw) {
  let rest = String(raw || '');
  if (rest.startsWith('/')) rest = rest.slice(1);

  // enc2 wraps the whole spec in one base64 segment; everything after it is a file name.
  if (rest.startsWith('enc2/')) {
    const after = rest.slice(5);
    const slash = after.indexOf('/');
    const seg = slash === -1 ? after : after.slice(0, slash);
    let decoded;
    try {
      decoded = decodeURIComponent(seg);
    } catch {
      return null;
    }
    let buf;
    try {
      buf = Buffer.from(decoded, 'base64');
    } catch {
      return null;
    }
    rest = buf.toString('latin1');
  }

  const headers = {};
  let cookiePlus = false;
  // Prefixes are consumed in order; the first thing that is not a prefix is the target URL.
  while (true) {
    if (rest.startsWith('param/')) {
      const after = rest.slice(6);
      const slash = after.indexOf('/');
      const seg = slash === -1 ? after : after.slice(0, slash);
      const remainder = slash === -1 ? '' : after.slice(slash + 1);
      const eq = seg.indexOf('=');
      const name = eq === -1 ? seg : seg.slice(0, eq);
      const value = eq === -1 ? '' : seg.slice(eq + 1);
      let decodedValue;
      try {
        decodedValue = decodeURIComponent(value);
      } catch {
        return null;
      }
      headers[name] = decodedValue;
      rest = remainder;
    } else if (rest.startsWith('cookie_plus/')) {
      cookiePlus = true;
      rest = rest.slice('cookie_plus/'.length);
    } else {
      break;
    }
  }

  let u;
  try {
    u = new URL(rest);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.port || !/(^|\.)(hd)?rezka\.ag$/i.test(u.hostname)) return null;
  // Only rezka.ag / hdrezka.ag over https: the helper is public and must not reach other hosts or the LAN.
  return { url: rest, headers, cookiePlus };
}

export async function handleRezka(req, res) {
  if (!isRezkaPath(req.url)) return false;
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Private-Network': 'true' };
  let targetHost = '';
  let targetPath = '';
  try {
    const parsed = parseProxyPath(req.url);
    if (!parsed) {
      res.writeHead(400, { ...cors, 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('bad url');
      return true;
    }
    const { url, headers, cookiePlus } = parsed;
    try {
      const tu = new URL(url);
      targetHost = tu.hostname;
      targetPath = tu.pathname;
    } catch {}

    // Build upstream headers from the parsed ones.
    const upHeaders = { ...headers };
    // Drop an empty Cookie.
    for (const k of Object.keys(upHeaders)) {
      if (k.toLowerCase() === 'cookie' && upHeaders[k] === '') delete upHeaders[k];
    }
    const hasUA = Object.keys(upHeaders).some((k) => k.toLowerCase() === 'user-agent');
    if (!hasUA) upHeaders['User-Agent'] = 'okhttp/4.12.0';

    const method = req.method === 'POST' ? 'POST' : 'GET';
    let body;
    if (method === 'POST') {
      const chunks = [];
      let n = 0;
      for await (const c of req) {
        if ((n += c.length) > 65536) {
          res.writeHead(413, { ...cors, 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('too large');
          return true;
        }
        chunks.push(c);
      }
      body = Buffer.concat(chunks);
      upHeaders['Content-Type'] = req.headers['content-type'] || 'application/x-www-form-urlencoded';
      upHeaders['X-Requested-With'] = 'XMLHttpRequest';
    }

    const up = await fetch(url, {
      method,
      headers: upHeaders,
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT),
    });

    const setCookies = up.headers.getSetCookie ? up.headers.getSetCookie() : [];
    const text = await up.text();

    if (cookiePlus) {
      const hObj = Object.fromEntries(up.headers);
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        currentUrl: up.url,
        status: up.status,
        cookie: setCookies,
        headers: { ...hObj, 'set-cookie': setCookies },
        body: text,
      }));
    } else {
      const ct = up.headers.get('content-type') || 'text/plain; charset=utf-8';
      res.writeHead(up.status, { ...cors, 'Content-Type': ct });
      res.end(text);
    }
    return true;
  } catch (e) {
    console.error('rezka', targetHost + targetPath, e.message);
    if (!res.headersSent) {
      res.writeHead(502, { ...cors, 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('bad gateway');
    } else {
      res.end();
    }
    return true;
  }
}

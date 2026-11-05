// Local host for the Lampa plugin and its playlist endpoint.
//
//   GET  /plugin/torbox-lampa-plugin.js   static files from this repo
//   POST /m3u   { items: [{ title, url }] }  -> { url }
//   GET  /p/<id>.m3u                     the generated playlist
//
// Playlists live in memory for 30 minutes: TorBox links are short-lived and the
// TV fetches the file right after the plugin creates it.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const PORT = Number(process.env.PORT || 7300);
const ROOT = path.dirname(new URL(import.meta.url).pathname);
const TTL_MS = 30 * 60 * 1000;

const playlists = new Map(); // id -> { text, exp }

const TYPES = {
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.m3u8': 'application/vnd.apple.mpegurl; charset=utf-8',
  '.m3u': 'audio/x-mpegurl; charset=utf-8'
};

function cors(res) {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', '*');
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
}

function m3u(items) {
  const lines = items
    .filter((i) => i && i.url)
    .map((i) => {
      const title = String(i.title || 'Video').replace(/\n/g, ' ').slice(0, 200);
      return `#EXTINF:-1,${title}\n${i.url}`;
    });
  // No #EXT-X-* tags: DDD treats any HLS tag as an HLS manifest and hands the
  // file to ExoPlayer's HLS parser, which rejects M3U entries.
  return `#EXTM3U\n${lines.join('\n')}\n`;
}

function prune() {
  const now = Date.now();
  for (const [id, entry] of playlists) if (entry.exp < now) playlists.delete(id);
}

const server = http.createServer((req, res) => {
  cors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'POST' && url.pathname === '/m3u') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      let items;
      try {
        items = JSON.parse(Buffer.concat(chunks).toString('utf8')).items;
      } catch (e) {
        res.writeHead(400, { 'content-type': 'text/plain' });
        res.end('bad json');
        return;
      }
      if (!Array.isArray(items) || !items.length) {
        res.writeHead(400, { 'content-type': 'text/plain' });
        res.end('empty playlist');
        return;
      }
      prune();
      const id = crypto.randomBytes(6).toString('hex');
      playlists.set(id, { text: m3u(items), exp: Date.now() + TTL_MS });
      console.log(`[m3u] POST ${items.length} items -> ${id}`);
      const base = `http://${req.headers.host || `127.0.0.1:${PORT}`}`;
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ url: `${base}/p/${id}.m3u8` }));
    });
    return;
  }

  // .m3u8 so Android intents reach DDD Player (its filters only match *.m3u8
  // and mpegurl types); the body has no #EXT-X- tags, so DDD parses it as M3U.
  const match = url.pathname.match(/^\/p\/([a-f0-9]+)\.m3u8$/);
  if (match) {
    const entry = playlists.get(match[1]);
    if (!entry || entry.exp < Date.now()) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('playlist expired');
      return;
    }
    console.log(`[m3u] GET ${match[1]} (${entry.text.split('\n').length - 2} items)`);
    res.writeHead(200, { 'content-type': TYPES['.m3u8'], 'cache-control': 'no-store' });
    res.end(entry.text);
    return;
  }

  const file = path.join(ROOT, path.normalize(url.pathname));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`lampa host on http://0.0.0.0:${PORT} (root ${ROOT})`);
});

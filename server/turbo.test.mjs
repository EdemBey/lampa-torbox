import assert from 'node:assert';
import { decodePlaylist, browserCookie, isCdnHost, masterPlaylist, dddVoiceovers, cdnProxyUrl, proxyPlaylist, handleTurbo } from './turbo.mjs';

// Build a PlayerJS-style blob: junk prefix + base64 JSON with "//" + btoa("c/c/c") markers spliced in.
const cfg = { lang: 'en', file: [{ title: 'Season 1', folder: [{ title: 'Episode 1', folder: [{ title: '(RU) DUB', file: '[720p]https://cdn-x.obrut.show/stream/a,[Auto]https://cdn-x.obrut.show/stream/b' }] }] }] };
const b64 = Buffer.from(JSON.stringify(cfg)).toString('base64');
const marks = ['t', 'b', 'r'].map((c) => '//' + Buffer.from(c + '/' + c + '/' + c).toString('base64'));
const spliced = b64.slice(0, 20) + marks[0] + b64.slice(20, 50) + marks[1] + b64.slice(50, 90) + marks[2] + b64.slice(90);
const html = `<script>new Player("H2wqmz4r3rISXWjHIMxh9cH89lMKhZJJBemTlYNNruYYezRhPCl3UceA9oDXGZAjxfZXFJKd5${spliced}");</script>`;

assert.deepEqual(decodePlaylist(html), cfg);
assert.equal(decodePlaylist('<html>verify</html>'), null);
console.log('turbo decode OK');

// browserCookie
const c1 = browserCookie('__Host-x=1; Path=/; Secure; SameSite=Lax; Domain=.obrut.show', false);
assert.ok(/(^|;)\s*Secure\b/i.test(c1), 'keeps Secure');
assert.ok(/SameSite=Lax/i.test(c1), 'keeps SameSite=Lax');
assert.ok(!/Domain=/i.test(c1), 'no Domain');
const c2 = browserCookie('a=1; Path=/; SameSite=Lax', true);
assert.ok(/SameSite=None/i.test(c2), 'SameSite=None');
assert.ok(/(^|;)\s*Secure\b/i.test(c2), 'Secure');
assert.ok(!/Lax/i.test(c2), 'not Lax');
console.log('turbo browserCookie OK');

// CDN host check for the redirect hop
assert.ok(isCdnHost('lucky.z.superdupercdn.com') && !isCdnHost('superdupercdn.com.evil.com'));
console.log('turbo isCdnHost OK');

// masterPlaylist
const B = 'https://lucky.z.superdupercdn.com/tvseries/abc/sig:2026/';
const master = masterPlaylist({ base: B, tracks: [{ n: 1, name: 'TVShows' }, { n: 3, name: 'Original "x"' }], def: 3, qualities: [720, 1080], audioQ: 240 });
assert.equal(master, [
  '#EXTM3U',
  '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",NAME="TVShows",DEFAULT=NO,AUTOSELECT=YES,URI="' + B + '240.mp4:hls:manifest-v1-a1.m3u8"',
  '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",NAME="Original  x",DEFAULT=YES,AUTOSELECT=YES,URI="' + B + '240.mp4:hls:manifest-v1-a3.m3u8"',
  '#EXT-X-STREAM-INF:BANDWIDTH=2892000,RESOLUTION=1280x720,AUDIO="aud"',
  B + '720.mp4:hls:manifest-v1.m3u8',
  '#EXT-X-STREAM-INF:BANDWIDTH=5592000,RESOLUTION=1920x1080,AUDIO="aud"',
  B + '1080.mp4:hls:manifest-v1.m3u8',
].join('\n') + '\n');
assert.equal(masterPlaylist({ base: B, tracks: [{ n: 1, name: 'TVShows' }, { n: 3, name: 'Original "x"' }], def: 3, qualities: [720, 999, 1080], audioQ: 240 }), master, 'unknown quality skipped');
console.log('turbo master OK');

// dddVoiceovers
const V = [
  { title: 'Voice A', file: '[480p]https://cdn-x.obrut.show/stream/a1,[1080p]https://cdn-x.obrut.show/stream/a2,[Auto]https://cdn-x.obrut.show/stream/a3' },
  { title: 'Voice B', file: '[1080p]https://cdn-x.obrut.show/stream/b2,[720p]https://cdn-x.obrut.show/stream/b1,[Auto]https://cdn-x.obrut.show/stream/b3' },
];
const BASE = 'https://helper.example';
const TAIL = '&e=' + encodeURIComponent('https://obrut.show/embed/x') + '&s=0&ep=3';
const U = 'https://cdn-x.obrut.show/stream/b1';
const dv = dddVoiceovers({ voices: V, u: U, base: BASE, tail: TAIL }).voiceovers;
assert.equal(dv.length, 2);
assert.equal(dv[0].selected, false);
assert.equal(dv[1].selected, true);
assert.equal(dv[1].url, BASE + '/turbo/stream.m3u8?u=' + encodeURIComponent('https://cdn-x.obrut.show/stream/b3') + TAIL);
assert.deepEqual(dv[1].qualities.map((q) => q.name), ['1080p', '720p']);
assert.equal(dv[1].qualities[1].url, BASE + '/turbo/stream.m3u8?u=' + encodeURIComponent(U) + TAIL);
assert.ok(dv.every((v) => v.url.endsWith(TAIL) && v.qualities.every((q) => q.url.endsWith(TAIL))));
const dvNone = dddVoiceovers({ voices: V, u: 'https://nope', base: BASE, tail: TAIL }).voiceovers;
assert.deepEqual(dvNone.map((v) => v.selected), [true, false]);
console.log('turbo voiceovers OK');

// cdnProxyUrl
const PL = 'https://lucky.z.superdupercdn.com/t/h/s:1/hls-v1-a3.m3u8';
const PB = 'https://helper.example';
assert.equal(cdnProxyUrl('https://lucky.z.superdupercdn.com/t/h/s:1/hls-v1-a3.m3u8?x=1', PB), PB + '/turbo/cdn/lucky.z.superdupercdn.com/t/h/s:1/hls-v1-a3.m3u8?x=1');
console.log('turbo cdnProxyUrl OK');

// proxyPlaylist
const PP_IN = '#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:4,\n./seg1.ts\nhttps://other.example/x.m3u8\nhttps://lucky.z.superdupercdn.com/t/h/s:1/seg2.ts\n';
const PP_OUT = '#EXTM3U\n#EXT-X-MAP:URI="' + PB + '/turbo/cdn/lucky.z.superdupercdn.com/t/h/s:1/init.mp4"\n#EXTINF:4,\n' + PB + '/turbo/cdn/lucky.z.superdupercdn.com/t/h/s:1/seg1.ts\nhttps://other.example/x.m3u8\n' + PB + '/turbo/cdn/lucky.z.superdupercdn.com/t/h/s:1/seg2.ts\n';
assert.equal(proxyPlaylist(PP_IN, PL, PB), PP_OUT);
console.log('turbo proxyPlaylist OK');

// proxyPlaylist with a colon path + query
const PP2_IN = '1080.mp4:hls:manifest-v1-a3.m3u8?t=1\n';
const PP2_OUT = PB + '/turbo/cdn/lucky.z.superdupercdn.com/t/h/s:1/1080.mp4:hls:manifest-v1-a3.m3u8?t=1\n';
assert.equal(proxyPlaylist(PP2_IN, PL, PB), PP2_OUT);
console.log('turbo proxyPlaylist colon OK');

// handleTurbo signature helpers
function fakeRes() {
  const r = { statusCode: null, headers: null, body: '', headersSent: false, writableEnded: false };
  r.writeHead = (status, headers) => { r.statusCode = status; r.headers = headers || {}; r.headersSent = true; };
  r.end = (body = '') => { r.body += body == null ? '' : String(body); r.writableEnded = true; };
  r.destroy = () => {};
  return r;
}

// /turbo/master.m3u8 accepts the proxy form and rewrites every link through it
const masterUrl = new URL('http://h/turbo/master.m3u8');
masterUrl.searchParams.set('base', 'http://h/turbo/cdn/lucky.z.superdupercdn.com/t/h/s:1/');
masterUrl.searchParams.set('a', '1:x');
const mres = fakeRes();
assert.equal(await handleTurbo({ headers: {} }, mres, masterUrl, 'http://h'), true);
assert.equal(mres.statusCode, 200);
for (const line of String(mres.body).split('\n')) {
  const mm = line.match(/URI="([^"]*)"/);
  if (mm) assert.ok(mm[1].startsWith('http://h/turbo/cdn/lucky.z.superdupercdn.com/t/h/s:1/'), mm[1]);
  const t = line.trim();
  if (t && !t.startsWith('#')) assert.ok(t.startsWith('http://h/turbo/cdn/lucky.z.superdupercdn.com/t/h/s:1/'), t);
}
console.log('turbo handleTurbo master OK');

for (const badBase of ['http://h/turbo/cdn/evil.com/', 'http://other/turbo/cdn/lucky.z.superdupercdn.com/x/']) {
  const u = new URL('http://h/turbo/master.m3u8');
  u.searchParams.set('base', badBase);
  u.searchParams.set('a', '1:x');
  const r = fakeRes();
  assert.equal(await handleTurbo({ headers: {} }, r, u, 'http://h'), true);
  assert.equal(r.statusCode, 400, badBase);
}
console.log('turbo handleTurbo master bad base OK');

// /turbo/cdn/<host> rejects a non-CDN host without calling fetch
let fetchCalled = false;
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { fetchCalled = true; throw new Error('should not be called'); };
try {
  const u = new URL('http://h/turbo/cdn/evil.com/x');
  const r = fakeRes();
  assert.equal(await handleTurbo({ headers: {} }, r, u, 'http://h'), true);
  assert.equal(r.statusCode, 400);
  assert.equal(fetchCalled, false);
  console.log('turbo handleTurbo cdn bad host OK');
} finally {
  globalThis.fetch = originalFetch;
}

import assert from 'node:assert';
import { decodePlaylist, browserCookie, isCdnHost, masterPlaylist, dddVoiceovers, absolutePlaylist } from './turbo.mjs';

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

// absolutePlaylist
const PL = 'https://lucky.z.superdupercdn.com/t/h/s:1/hls-v1-a3.m3u8';
assert.equal(absolutePlaylist('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\n./1080.mp4:hls:manifest-v1-a3.m3u8\n', PL),
  '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\nhttps://lucky.z.superdupercdn.com/t/h/s:1/1080.mp4:hls:manifest-v1-a3.m3u8\n');
assert.equal(absolutePlaylist('#EXT-X-MAP:URI="init.mp4"\n#EXTINF:4,\nseg1.ts\n', PL),
  '#EXT-X-MAP:URI="https://lucky.z.superdupercdn.com/t/h/s:1/init.mp4"\n#EXTINF:4,\nhttps://lucky.z.superdupercdn.com/t/h/s:1/seg1.ts\n');
console.log('turbo absolutePlaylist OK');

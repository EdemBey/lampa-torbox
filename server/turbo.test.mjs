import assert from 'node:assert';
import { decodePlaylist, browserCookie, isCdnHost, masterPlaylist } from './turbo.mjs';

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

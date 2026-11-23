import assert from 'node:assert';
import { decodePlaylist, rewritePlaylist, browserCookie, injectCursor } from './turbo.mjs';

// Build a PlayerJS-style blob: junk prefix + base64 JSON with "//" + btoa("c/c/c") markers spliced in.
const cfg = { lang: 'en', file: [{ title: 'Season 1', folder: [{ title: 'Episode 1', folder: [{ title: '(RU) DUB', file: '[720p]https://cdn-x.obrut.show/stream/a,[Auto]https://cdn-x.obrut.show/stream/b' }] }] }] };
const b64 = Buffer.from(JSON.stringify(cfg)).toString('base64');
const marks = ['t', 'b', 'r'].map((c) => '//' + Buffer.from(c + '/' + c + '/' + c).toString('base64'));
const spliced = b64.slice(0, 20) + marks[0] + b64.slice(20, 50) + marks[1] + b64.slice(50, 90) + marks[2] + b64.slice(90);
const html = `<script>new Player("H2wqmz4r3rISXWjHIMxh9cH89lMKhZJJBemTlYNNruYYezRhPCl3UceA9oDXGZAjxfZXFJKd5${spliced}");</script>`;

assert.deepEqual(decodePlaylist(html), cfg);
assert.equal(decodePlaylist('<html>verify</html>'), null);
console.log('turbo decode OK');

const base = 'http://h';
const playlistUrl = 'https://nova.z.superdupercdn.com/a/b/720.mp4:hls:manifest.m3u8';
const segAbs = 'https://nova.z.superdupercdn.com/a/b/720.mp4:hls:seg-1-v1-a2.ts';

// media playlist
const media = '#EXTINF:6.000,\n./720.mp4:hls:seg-1-v1-a2.ts';
const mediaOut = rewritePlaylist(media, playlistUrl, base);
assert.equal(mediaOut, '#EXTINF:6.000,\n' + base + '/turbo/seg?u=' + encodeURIComponent(segAbs));

// master playlist
const master = './240.mp4:hls:manifest-v1-a2.m3u8';
const masterAbs = 'https://nova.z.superdupercdn.com/a/b/240.mp4:hls:manifest-v1-a2.m3u8';
assert.equal(rewritePlaylist(master, playlistUrl, base), base + '/turbo/hls?u=' + encodeURIComponent(masterAbs));

// EXT-X-KEY URI
const keyLine = '#EXT-X-KEY:METHOD=AES-128,URI="key.bin"';
const keyAbs = 'https://nova.z.superdupercdn.com/a/b/key.bin';
assert.equal(rewritePlaylist(keyLine, playlistUrl, base), '#EXT-X-KEY:METHOD=AES-128,URI="' + base + '/turbo/seg?u=' + encodeURIComponent(keyAbs) + '"');

console.log('turbo rewrite OK');

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

// rewritePlaylist: .ts with .m3u8 in query stays a segment
const qLine = 'seg.ts?x=a.m3u8';
const qAbs = 'https://nova.z.superdupercdn.com/a/b/seg.ts?x=a.m3u8';
assert.equal(rewritePlaylist(qLine, playlistUrl, base), base + '/turbo/seg?u=' + encodeURIComponent(qAbs));
console.log('turbo query-m3u8 OK');

// injectCursor
const inj = injectCursor('<html><head><title>x</title></head></html>');
assert.ok(inj.indexOf('<script') > inj.indexOf('<head>'), 'script after head');
assert.ok(inj.indexOf('<script') < inj.indexOf('<title>'), 'script before title');
const inj2 = injectCursor('<div>');
assert.ok(inj2.startsWith('<script'), 'prepend when no head');
const inj3 = injectCursor('<html><head><header>h</header></head></html>');
assert.ok(inj3.indexOf('<script') < inj3.indexOf('<header>'), 'header tag is not head');
console.log('turbo injectCursor OK');

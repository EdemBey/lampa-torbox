import assert from 'node:assert';
import { decodePlaylist, browserCookie, isCdnHost } from './turbo.mjs';

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

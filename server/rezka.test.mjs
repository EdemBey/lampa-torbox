import assert from 'node:assert';
import { parseProxyPath, isRezkaPath } from './rezka.mjs';

const enc2 = '/enc2/' + encodeURIComponent(Buffer.from('param/User-Agent=okhttp%2F4.12.0/cookie_plus/param/Cookie=a%3D1%3B%20b%3D2/https://rezka.ag/ajax/login/').toString('base64')) + '/login?jacred.test';
const r1 = parseProxyPath(enc2);
assert.equal(r1.url, 'https://rezka.ag/ajax/login/');
assert.deepEqual(r1.headers, { 'User-Agent': 'okhttp/4.12.0', Cookie: 'a=1; b=2' });
assert.equal(r1.cookiePlus, true);
console.log('rezka enc2 OK');

const raw = '/param/Origin=https%3A%2F%2Frezka.ag/https://rezka.ag/ajax/get_cdn_series/?t=1';
const r2 = parseProxyPath(raw);
assert.equal(r2.url, 'https://rezka.ag/ajax/get_cdn_series/?t=1');
assert.equal(r2.cookiePlus, false);
console.log('rezka raw OK');

const evil = '/enc2/' + encodeURIComponent(Buffer.from('https://evil.com/').toString('base64'));
assert.equal(parseProxyPath(evil), null);
assert.equal(parseProxyPath('/enc2/!!!/x'), null);
console.log('rezka null OK');

assert.equal(parseProxyPath('/https://rezka.evil.com/'), null);
assert.equal(parseProxyPath('/http://rezka.ag/'), null);
assert.equal(parseProxyPath('/https://rezka.ag:8080/'), null);
assert.ok(parseProxyPath('/https://hdrezka.ag/x'));
console.log('rezka host guards OK');

assert.equal(isRezkaPath('/enc2/x'), true);
assert.equal(isRezkaPath('/page'), false);
console.log('rezka isRezkaPath OK');

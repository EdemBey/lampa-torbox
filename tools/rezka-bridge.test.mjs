import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseProxyPath } from '../server/rezka.mjs';

const src = readFileSync(fileURLToPath(new URL('../plugin/rezka-bridge.user.js', import.meta.url)), 'utf8');
const from = src.indexOf('  function parse(rest)');
const to = src.indexOf('  var timer');
assert(from !== -1 && to > from, 'rezka-bridge parse not found');
const parse = new Function(src.slice(from, to) + '\nreturn parse;')();

const b64 = (s) => encodeURIComponent(Buffer.from(s).toString('base64'));

const enc2 = '/enc2/' + b64('param/User-Agent=okhttp%2F4.12.0/cookie_plus/param/Cookie=a%3D1%3B%20b%3D2/https://rezka.ag/ajax/login/') + '/login?jacred.test';
const r1 = parse(enc2);
assert.equal(r1.url, 'https://rezka.ag/ajax/login/');
assert.deepEqual(r1.headers, { 'User-Agent': 'okhttp/4.12.0', Cookie: 'a=1; b=2' });
assert.equal(r1.cookiePlus, true);
console.log('bridge enc2 OK');

const raw = '/param/Origin=https%3A%2F%2Frezka.ag/https://rezka.ag/ajax/get_cdn_series/?t=1';
const r2 = parse(raw);
assert.equal(r2.url, 'https://rezka.ag/ajax/get_cdn_series/?t=1');
assert.equal(r2.cookiePlus, false);
console.log('bridge raw OK');

const evil = '/enc2/' + b64('https://evil.com/');
assert.equal(parse(evil), null);
assert.equal(parse('/enc2/!!!/x'), null);
console.log('bridge null OK');

assert.equal(parse('/https://rezka.evil.com/'), null);
assert.equal(parse('/http://rezka.ag/'), null);
assert.equal(parse('/https://rezka.ag:8080/'), null);
assert.ok(parse('/https://hdrezka.ag/x'));
console.log('bridge host guards OK');

// The bridge is a hand copy of the server parser; the shared cases must agree.
for (const p of [enc2, raw, evil, '/enc2/!!!/x', '/https://rezka.evil.com/', '/http://rezka.ag/', '/https://rezka.ag:8080/', '/https://hdrezka.ag/x']) {
  assert.deepEqual(parse(p), parseProxyPath(p), p);
}
console.log('bridge matches server OK');

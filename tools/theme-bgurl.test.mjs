import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('../plugin/theme.js', import.meta.url)), 'utf8');
const from = src.indexOf('  function bgUrl(');
const to = src.indexOf('  // shortcut: Background.change()');
assert(from > 0 && to > from, 'bgUrl not found in plugin/theme.js');
const bgUrl = new Function(src.slice(from, to) + '\nreturn bgUrl;')();

const tmdb = 'https://image.tmdb.org/t/p/original/a.jpg';
assert.strictEqual(bgUrl(tmdb), tmdb + '?lampa_bg=1');
assert.strictEqual(bgUrl(tmdb + '?x=1'), tmdb + '?x=1&lampa_bg=1');
assert.strictEqual(bgUrl(tmdb + '?lampa_bg=1'), tmdb + '?lampa_bg=1');
assert.strictEqual(bgUrl('https://imagetmdb.com/t/p/w1280/a.jpg'), 'https://imagetmdb.com/t/p/w1280/a.jpg?lampa_bg=1');
assert.strictEqual(bgUrl('https://example.com/a.jpg'), 'https://example.com/a.jpg');
assert.strictEqual(bgUrl(undefined), undefined);
assert.strictEqual(bgUrl(''), '');
console.log('theme-bgurl: ok');

import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('../plugin/online_mod.js', import.meta.url)), 'utf8');
const from = src.indexOf('    function rezkaBest(items, offered) {');
const to = src.indexOf('    function rezka2(component, _object, config) {');
assert(from > 0 && to > from, 'rezkaBest not found in plugin/online_mod.js');
const { rezkaBest } = new Function(src.slice(from, to) + '\nreturn { rezkaBest };')();

// a premium account sees the 1080 Ultra tier
assert.strictEqual(rezkaBest([{ label: '1080p Ultra', quality: 1080 }, { label: '1080p', quality: 1080 }, { label: '720p', quality: 720 }], 3), 1080);
// 4K is the top tier
assert.strictEqual(rezkaBest([{ label: '4K', quality: 4000 }, { label: '1080p Ultra', quality: 1080 }], 2), 2160);
// a 2K tier counts as above 1080
assert.strictEqual(rezkaBest([{ label: '2K', quality: 2000 }], 1), 1080);
// no premium tiers and nothing dropped: says nothing about the account
assert.strictEqual(rezkaBest([{ label: '720p', quality: 720 }], 1), 0);
// premium tiers were dropped: a free account
assert.strictEqual(rezkaBest([{ label: '720p', quality: 720 }], 3), 720);

console.log('rezka-best OK');

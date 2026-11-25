import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('../plugin/online_mod.js', import.meta.url)), 'utf8');
const from = src.indexOf('    function rezkaBest(items, offered) {');
const to = src.indexOf('    function rezka2(component, _object, config) {');
assert(from > 0 && to > from, 'rezkaBest not found in plugin/online_mod.js');
const store = {};
const Lampa = {
  Storage: {
    get: (key, def) => (key in store ? JSON.parse(JSON.stringify(store[key])) : def),
    set: (key, value) => { store[key] = JSON.parse(JSON.stringify(value)); },
  },
};
const { rezkaBest, rezkaOffered, rezkaTitleSave, rezkaTitleMax } = new Function('Lampa', src.slice(from, to) + '\nreturn { rezkaBest, rezkaOffered, rezkaTitleSave, rezkaTitleMax };')(Lampa);

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

// the best resolution a title offers, premium stubs included
assert.strictEqual(rezkaOffered(['360p', '720p', '1080p Ultra', '2K', '4K']), 2160);
assert.strictEqual(rezkaOffered(['<span>1080p Ultra</span>']), 1080);
assert.strictEqual(rezkaOffered(['2K', '1080p']), 1440);
assert.strictEqual(rezkaOffered([]), 0);

// 301 titles: the oldest (1) leaves, the newest (301) stays
for (let id = 1; id <= 301; id++) rezkaTitleSave(id, 720);
assert.strictEqual(rezkaTitleMax(1), 0);
assert.strictEqual(rezkaTitleMax(301), 720);
// a title saved again moves to the end and takes the new quality
rezkaTitleSave(2, 1080);
const keys = Object.keys(store['online_mod_rezka2_titles']);
assert.strictEqual(keys[keys.length - 1], 't2');
assert.strictEqual(rezkaTitleMax(2), 1080);

console.log('rezka-best OK');

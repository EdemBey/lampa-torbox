import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('../plugin/online_mod.js', import.meta.url)), 'utf8');
const from = src.indexOf('    function allohaBest(map, uhd) {');
const to = src.indexOf('    // best offered resolution per film id');
assert(from > 0 && to > from, 'allohaBest not found in plugin/online_mod.js');
const { allohaBest } = new Function(src.slice(from, to) + '\nreturn { allohaBest };')();

// 4K and 2K only where Alloha marks the voice uhd
assert.strictEqual(allohaBest({ '1080p': 1, '2160p': 1 }, false), 1080);
assert.strictEqual(allohaBest({ '1080p': 1, '2160p': 1 }, true), 2160);
assert.strictEqual(allohaBest({ '1080p': 1, '1440p': 1 }, false), 1080);
assert.strictEqual(allohaBest({ '720p': 1, '480p': 1 }, false), 720);
// nothing usable
assert.strictEqual(allohaBest('garbage', false), 0);
assert.strictEqual(allohaBest(null, true), 0);
assert.strictEqual(allohaBest({}, true), 0);

console.log('alloha-best OK');

import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('../plugin/snow.js', import.meta.url)), 'utf8');
const from = src.indexOf('  function seedOf(str) {');
const to = src.indexOf('  function pileOf(el) {');
assert(from !== -1 && to > from, 'snow.js seed code not found');
const api = new Function(src.slice(from, to) + '\nreturn { seedOf: seedOf, nextRand: nextRand };')();

// Remembered snow is redrawn from a seed per card: it must be unsigned, give [0, 1) and repeat exactly.
for (const key of ['movie:1', 'tv:550', 'tv:1399', 'movie:812225', 'x']) {
  const seed = api.seedOf(key);
  assert(seed >= 0 && seed < 2 ** 32 && Number.isInteger(seed), key + ': seed out of range');
  const a = { seed: seed };
  const b = { seed: api.seedOf(key) };
  for (let i = 0; i < 1000; i++) {
    const v = api.nextRand(a);
    assert(v >= 0 && v < 1, key + ': rand out of [0, 1)');
    assert.strictEqual(api.nextRand(b), v, key + ': sequence not repeatable');
  }
}
assert.notStrictEqual(api.seedOf('tv:550'), api.seedOf('movie:550'));

console.log('snow-seed: ok');

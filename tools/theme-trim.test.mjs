import assert from 'node:assert';
import { read, slice } from './_slice.mjs';

const { trimDecide, TRIM_K: K, TRIM_M: M, TRIM_BACK: B } = new Function(slice(read('theme.js'), 'theme-trim') + '\nreturn { trimDecide, TRIM_K, TRIM_M, TRIM_BACK };')();
assert.deepStrictEqual([K, M, B], [4, 15, 5]); // K = 4: a restore reaches 3 rows ahead, enough for a key every 300 ms with passes every ~400 ms

// [row, card, focus row, focus card, loaded, expected], here with K = 3 (the function takes it as a parameter)
const table = [
  [5, 3, 5, 3, true, 'keep'], // the focused card
  [5, 3, 5, 3, false, 'restore'],
  [5, 18, 5, 3, true, 'keep'], // 15 away: still inside the unload threshold
  [5, 19, 5, 3, true, 'unload'], // 16 away
  [5, 19, 5, 3, false, 'keep'],
  [5, 13, 5, 3, false, 'restore'], // 10 away: back
  [5, 14, 5, 3, false, 'keep'], // 11..15: dead zone, stays as is
  [5, 14, 5, 3, true, 'keep'],
  [5, 0, 5, 12, true, 'keep'], // before the focus counts too
  [5, 0, 5, 16, true, 'unload'],
  [8, 0, 5, 0, true, 'keep'], // 3 rows away: not unloaded yet
  [8, 0, 5, 0, false, 'keep'], // ... and not brought back
  [9, 0, 5, 0, true, 'unload'], // 4 rows away: everything
  [9, 0, 5, 0, false, 'keep'],
  [7, 0, 5, 0, false, 'restore'], // 2 rows away: back
  [2, 0, 5, 0, false, 'keep'], // 3 rows above
  [1, 0, 5, 0, true, 'unload'],
  [0, 0, 0, 0, false, 'restore'],
  [9, 99, 5, 0, true, 'unload']
];
for (const [r, c, fr, fc, loaded, want] of table) assert.strictEqual(trimDecide(r, c, fr, fc, loaded, 3, M), want, [r, c, fr, fc, loaded].join());

// hysteresis: a card never gets unload and restore from the same distance, so a card on a border cannot flap
for (let dr = 0; dr <= 8; dr++) for (let dc = 0; dc <= 40; dc++) {
  const u = trimDecide(dr, dc, 0, 0, true, K, M), r = trimDecide(dr, dc, 0, 0, false, K, M);
  assert(!(u === 'unload' && r === 'restore'), dr + ',' + dc);
  assert(u !== 'restore' && r !== 'unload', dr + ',' + dc + ' wrong direction');
}
// walking the focus one card at a time over a row never unloads a card that is then restored within the next step
let loaded = true, flips = 0;
for (let f = 0; f <= 60; f++) for (const step of [f, f + 1, f]) {
  const d = trimDecide(0, 30, 0, step, loaded, K, M);
  if (d !== 'keep') { loaded = d === 'restore'; flips++; }
}
assert(flips <= 4, 'flips ' + flips);
// off-by-ones around the restore threshold
assert.strictEqual(trimDecide(4, 0, 0, 0, true, K, M), 'keep'); // the shipped K: 4 rows away stays, 5 goes, 3 comes back, 4 does not
assert.strictEqual(trimDecide(5, 0, 0, 0, true, K, M), 'unload');
assert.strictEqual(trimDecide(3, 0, 0, 0, false, K, M), 'restore');
assert.strictEqual(trimDecide(4, 0, 0, 0, false, K, M), 'keep');
assert.strictEqual(trimDecide(0, M - B, 0, 0, false, K, M), 'restore');
assert.strictEqual(trimDecide(0, M - B + 1, 0, 0, false, K, M), 'keep');
console.log('theme-trim ok');

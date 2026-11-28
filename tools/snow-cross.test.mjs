import assert from 'node:assert';
import { read, slice } from './_slice.mjs';

// Settling is decided by crossing the card edge between two frames, not by being inside a 3 px band in one frame:
// the share of flakes that settle must not depend on the frame step.
const src = read('snow.js');
const { crossedTop, crossX } = new Function(slice(src, 'snow-cross') + '\nreturn { crossedTop, crossX };')();
assert(/crossedTop\(py, f\.y, s\.y\)/.test(src), 'drawFrame uses the crossing test');
assert(!/f\.y >= s\.y && f\.y <= s\.y \+ 3/.test(src), 'old 3 px window left in place');

const top = 100;
const oldHit = (y) => y >= top && y <= top + 3;
// fall from far above with a fixed step plus jitter (a slow frame now and then); count flakes that settle at the first edge crossing
function run(step, jitter, n) {
  let nOld = 0, nNew = 0, twice = 0;
  for (let i = 0; i < n; i++) {
    let y = 0 - (i % 97) * 0.37, hitsNew = 0, hitsOld = 0;
    for (let k = 0; k < 400 && y < top + 40; k++) {
      const py = y;
      y += step * (1 + jitter * (((i * 31 + k * 17) % 11) / 5 - 1));
      if (oldHit(y)) hitsOld++;
      if (crossedTop(py, y, top)) hitsNew++;
      if (hitsNew) break;
    }
    nOld += hitsOld ? 1 : 0; nNew += hitsNew ? 1 : 0; if (hitsNew > 1) twice++;
  }
  return { old: nOld / n, nw: nNew / n, twice };
}
for (const [step, jit] of [[1, 0], [3, 0], [5, 0], [12, 0], [1.5, 0.5], [3, 0.5], [5, 0.7], [12, 0.5]]) {
  const r = run(step, jit, 2000);
  assert.strictEqual(r.nw, 1, 'step ' + step + ' jitter ' + jit + ': every flake settles once, got ' + r.nw);
  assert.strictEqual(r.twice, 0);
  if (step <= 3 && jit === 0) assert(r.old > 0.99, 'step <= 3: the old band caught all (' + r.old + ')');
  if (step >= 5) assert(r.old < 0.7, 'step ' + step + ': the old band missed flakes (' + r.old + ')');
}
// edge cases of the predicate
assert(!crossedTop(90, 99.9, top) && crossedTop(99, 100, top) && crossedTop(90, 130, top));
assert(crossedTop(102.9, 103.5, top), 'inside the band last frame: still counts (as the old test did)');
assert(!crossedTop(103, 104, top), 'already below the band');
// x at the crossing, between the x before and after the frame
assert(Math.abs(crossX(10, 30, 90, 130, top) - 15) < 1e-9);
assert.strictEqual(crossX(10, 30, 120, 130, top), 30);
console.log('snow-cross: ok');

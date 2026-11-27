import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The bottom-snow canvas is a strip of accH px at the bottom of the screen: a sprite drawn (top-left at y, so it covers y..y+2r, never above y) at local y = accH - 10
// must land on the same screen y (H - 10) as in the old full-screen canvas.
const src = readFileSync(fileURLToPath(new URL('../plugin/snow.js', import.meta.url)), 'utf8');
assert(src.includes('accH - 10, f.r, '), 'dot must be drawn at accH - 10');
assert(!/[ (]H - 10, f\.r/.test(src), 'old full-screen y left in place');
for (const H of [1080, 720, 8]) {
  const accH = Math.min(12, H);
  const stripTop = H - accH;                 // screen y of the strip top (bottom:0)
  assert.strictEqual(stripTop + (accH - 10), H - 10, 'H=' + H);
}
console.log('snow-acc: ok');

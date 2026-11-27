import assert from 'node:assert';
import { read, slice } from './_slice.mjs';

// A grain of the pile has the same radius whether the snow just fell or the pile is redrawn from the remembered count
// (before: new grains took the radius of the falling flake, 2.7-6.6, so a fresh pile was thick clumps next to fine remembered ones).
const src = read('snow.js');
const { grainR } = new Function(slice(src, 'snow-grain') + '\nreturn { grainR };')();
assert.strictEqual(grainR(0, 1), 0.8);
assert(Math.abs(grainR(1, 1) - 2.2) < 1e-12);
assert(Math.abs(grainR(0.5, 1.3) - 1.5 * 1.3) < 1e-12, 'size multiplier');
const live = /function depositOnCard\([^)]*\) \{[\s\S]*?\n  \}/.exec(src)[0];
assert(live.includes('grainR(Math.random()'), 'new snow takes the pile grain radius');
assert(!/f\.r/.test(live));
assert(/var r = grainR\(nextRand\(pnew\)/.test(src), 'remembered pile takes the same radius');
console.log('snow-grain: ok');

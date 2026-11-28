import assert from 'node:assert';
import { read, slice } from './_slice.mjs';

// A grain of the pile has the same radius whether the snow just fell or the pile is redrawn from the remembered count
// (before: new grains took the radius of the falling flake, 2.7-6.6, so a fresh pile was thick clumps next to fine remembered ones).
const src = read('snow.js');
const { grainR, setPile } = new Function(slice(src, 'snow-grain') + '\nreturn { grainR: grainR, setPile: function (m) { cfg_pile_mult = m; } };')();
setPile(1);
assert.strictEqual(grainR(0, 1), 1.1);
assert(Math.abs(grainR(1, 1) - 3.1) < 1e-12);
assert(Math.abs(grainR(0.5, 1.3) - 2.1 * 1.3) < 1e-12, 'size multiplier');
// "Settle grain size" 1..4 -> x1 / 1.5 / 2 / 2.6, applied inside grainR (live and restored grains alike); mean radius 2.1 * mult
[1, 1.5, 2, 2.6].forEach(function (m) { setPile(m); assert(Math.abs(grainR(0.5, 1) - 2.1 * m) < 1e-12); });
assert(/\[1, 1, 1\.5, 2, 2\.6\]\[cfg\.pile_size\] \|\| 2/.test(src), 'sizes 1..4, default 3 = x2');
// the pile canvas holds the biggest grain (diameter 2 * 3.1 * 2.6 = 16.1) plus depth, and the limit is 400 grains
const ph = +/PILE_H = (\d+)/.exec(src)[1];
assert(ph >= 40 && /PILE_MAX = 400/.test(src), 'PILE_H / PILE_MAX');
// settle speed 1 vs 3: grains per landing differ at least 3x (7.1 * si)
const si = /speed === 1\) return ([\d.]+);[\s\S]*?speed === 3\) return ([\d.]+);/.exec(src.slice(src.indexOf('function getSettleIntensity')));
assert(+si[2] / +si[1] >= 3, 'settle speed scale');
const live = /function depositOnCard\([^)]*\) \{[\s\S]*?\n  \}/.exec(src)[0];
assert(live.includes('grainR(Math.random()'), 'new snow takes the pile grain radius');
assert(!/f\.r/.test(live));
assert(/var r = grainR\(nextRand\(pnew\)/.test(src), 'remembered pile takes the same radius');
console.log('snow-grain: ok');

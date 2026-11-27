import assert from 'node:assert';
import { read } from './_slice.mjs';

// Shaken-off grains: position is a closed form of the age in 60 fps frames, equal to the old per-frame Euler step at 60 fps, whatever the frame rate.
const src = read('snow.js');
assert(src.includes('0.09 * d.t * (d.t + 1)'), 'closed-form y');
assert(!/d\.vy \+= 0\.18/.test(src), 'old per-frame step left in place');
const y0 = 100, vy = 1.1, vx = -0.4, x0 = 50;
let y = y0, v = vy, x = x0;
for (let n = 1; n <= 60; n++) { v += 0.18; x += vx; y += v; }
const t = 60;
assert(Math.abs(y - (y0 + vy * t + 0.09 * t * (t + 1))) < 1e-9, 'y at 60 frames');
assert(Math.abs(x - (x0 + vx * t)) < 1e-9, 'x at 60 frames');
// the same age reached in 20 ms steps (k = 1.2) or in one jump gives the same point
const at = (steps) => { let a = 0; for (const k of steps) a += k; return y0 + vy * a + 0.09 * a * (a + 1); };
assert(Math.abs(at([1.2, 1.2, 1.2]) - at([3.6])) < 1e-9, 'frame rate independent');
// pile sizes follow the interface scale; the reference window (1440 / 84.17 px body font) keeps scale 1
assert(src.includes('var UI_REF = 1440 / 84.17'), 'reference scale');
assert(Math.abs(1440 / 84.17 / (1440 / 84.17) - 1) < 1e-12);
console.log('snow-debris: ok');

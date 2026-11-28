import assert from 'node:assert';
import { read, slice } from './_slice.mjs';

// A shaken-off cap falls as CSS-animated layers. Their timing must follow the path the grains had on the canvas:
// y = vy*t + 0.09*t*(t+1), t in 60 fps frames (the closed form of the old per-frame step vy += 0.18, y += vy).
const src = read('snow.js');
const { fallFrames, fallEasing } = new Function(slice(src, 'snow-fall') + '\nreturn { fallFrames, fallEasing };')();
assert(!/debris/.test(src), 'canvas debris left in place');
const path = (vy, t) => vy * t + 0.09 * t * (t + 1);
for (const [dist, vy] of [[250, 0.3], [250, 1.6], [520, 1], [40, 0.5]]) {
  const t = fallFrames(dist, vy);
  assert(Math.abs(path(vy, t) - dist) < 1e-6, 'lands at dist after fallFrames');
  // the timing function, evaluated as a Bezier with x = s (x1 = 1/3, x2 = 2/3), is the same path at every moment
  const [, y1, , y2] = fallEasing(dist, vy, t).match(/\(([^)]+)\)/)[1].split(',').map(Number);
  for (const s of [0.1, 0.25, 0.5, 0.75, 0.9]) {
    const bez = 3 * (1 - s) * (1 - s) * s * y1 + 3 * (1 - s) * s * s * y2 + s * s * s;
    assert(Math.abs(bez * dist - path(vy, s * t)) < dist * 2e-4, 'easing follows the path at ' + s);
  }
}
// pile sizes follow the interface scale; the reference window (1440 / 84.17 px body font) keeps scale 1
assert(src.includes('var UI_REF = 1440 / 84.17'), 'reference scale');


// Inertia: the snow keeps the velocity the card had at the shake-off. The drift animation starts at exactly that velocity.
{
  const { driftOf, INERTIA_MS, INERTIA_EASE, INERTIA_MAX } = new Function(slice(src, 'snow-inertia') + '\nreturn { driftOf, INERTIA_MS, INERTIA_EASE, INERTIA_MAX };')();
  const [x1, y1] = INERTIA_EASE.match(/\(([^)]+)\)/)[1].split(',').map(Number);
  assert.strictEqual(driftOf(0, 16), 0, 'a card at rest: the snow falls straight down');
  const v = -8 / 16; // card moving left, px per ms
  assert(Math.abs(driftOf(-8, 16) / INERTIA_MS * (y1 / x1) - v) < 1e-9, 'start velocity of the drift = velocity of the card');
  assert.strictEqual(driftOf(-500, 16), -INERTIA_MAX, 'capped');
  assert.strictEqual(driftOf(5, 0), driftOf(5, 8), 'no division by a zero frame time');
  console.log('snow-inertia: ok');
}

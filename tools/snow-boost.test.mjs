import assert from 'node:assert';
import { read, slice } from './_slice.mjs';

// While shaken-off debris flies, snow draws every rAF; otherwise the fps limiter (dt >= interval) is unchanged.
const src = read('snow.js');
const { shouldDraw } = new Function(slice(src, 'snow-boost') + '\nreturn { shouldDraw };')();
assert(/shouldDraw\(dt, interval, debris\.length > 0\)/.test(src), 'loop uses shouldDraw with debris state');

assert.strictEqual(shouldDraw(16.7, 20, false), false);
assert.strictEqual(shouldDraw(33.3, 20, false), true);
assert.strictEqual(shouldDraw(20, 20, false), true);
assert.strictEqual(shouldDraw(16.7, 20, true), true);
assert.strictEqual(shouldDraw(0, 20, true), true);
console.log('snow-boost ok');

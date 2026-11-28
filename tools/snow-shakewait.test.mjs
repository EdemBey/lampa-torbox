import assert from 'node:assert';
import { read, slice } from './_slice.mjs';

// The shake-off waits for calm frames (two in a row under the threshold), but never longer than the maximum.
const src = read('snow.js');
const { shakeNow } = new Function(slice(src, 'snow-shakewait') + '\nreturn { shakeNow };')();
const thr = 50, max = 600;
assert.strictEqual(shakeNow(100, 33, 34, thr, max), true, 'calm frames');
assert.strictEqual(shakeNow(100, 33, 70, thr, max), false, 'one long frame');
assert.strictEqual(shakeNow(100, 70, 33, thr, max), false, 'one long frame');
assert.strictEqual(shakeNow(601, 80, 90, thr, max), true, 'waited too long');
assert.strictEqual(shakeNow(600, 80, 90, thr, max), false, 'at the limit still waits');
assert.strictEqual(shakeNow(null, 33, 33, thr, max), false, 'nothing waits');
console.log('snow-shakewait ok');

import assert from 'node:assert';
import { read, slice } from './_slice.mjs';

// The shake-off waits for calm frames (two in a row under the threshold), but never longer than the maximum.
const src = read('snow.js');
const { shakeNow, shakeThr } = new Function(slice(src, 'snow-shakewait') + '\nreturn { shakeNow, shakeThr };')();
const thr = 50, max = 600;
// TV: nominal interval 20 ms, real drawn frame 33 ms
assert(shakeThr(20) >= 50 && shakeThr(33.3) >= 50 && shakeThr(100) === 150, 'threshold from the real interval');
assert.strictEqual(shakeNow(100, 33, 34, shakeThr(20), max), true, 'TV calm frames');
assert.strictEqual(shakeNow(100, 33, 70, shakeThr(20), max), false, 'TV one long frame');
assert.strictEqual(shakeNow(100, 33, 34, thr, max), true, 'calm frames');
assert.strictEqual(shakeNow(100, 33, 70, thr, max), false, 'one long frame');
assert.strictEqual(shakeNow(100, 70, 33, thr, max), false, 'one long frame');
assert.strictEqual(shakeNow(601, 80, 90, thr, max), true, 'waited too long');
assert.strictEqual(shakeNow(600, 80, 90, thr, max), false, 'at the limit still waits');
assert.strictEqual(shakeNow(null, 33, 33, thr, max), false, 'nothing waits');
console.log('snow-shakewait ok');

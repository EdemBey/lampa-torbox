import assert from 'node:assert';
import { read, slice } from './_slice.mjs';

const { bbSize } = new Function(slice(read('theme.js'), 'theme-bbsize') + '\nreturn { bbSize };')();

// window (css px) -> body font-size as Lampa sets it: max(W / 84.17, 10.6)
const fs = (w) => Math.max(w / 84.17, 10.6);
const rows = [
  // [W, H, rows top, card em]
  [1440, 900, 380, 0.68], // MacBook reference: 17.1 px, cards .68 em as before
  [960, 540, 225, 0.68], // 1080p TV at DPR 2: used to get .6 em
  [1920, 1080, 451, 0.68],
  [1280, 720, 301, 0.68],
  [2560, 1440, 601, 0.68],
  [1280, 560, 228, 0.51] // short window: the row would not fit, cards shrink
];
for (const [w, h, top, ck] of rows) {
  const z = bbSize(h, fs(w));
  assert.strictEqual(z.rows, top, w + 'x' + h + ' rows');
  assert.strictEqual(z.ck, ck, w + 'x' + h + ' card em');
  // the row (5.5 fs + 26.4 card em + 1.35 fs) ends inside the window
  assert(z.rows + fs(w) * (6.85 + 26.4 * z.ck) <= h * 0.97, w + 'x' + h + ' row fits');
}
// all offsets scale with fs
const a = bbSize(900, 17.1), b = bbSize(540, 11.4);
assert.strictEqual(a.gap, 34);
assert.strictEqual(b.fade[1], Math.round(3.3 * 11.4));
console.log('theme-bbsize ok');

import assert from 'node:assert';
import { read, slice } from './_slice.mjs';

const src = read('snow.js');
const { farOff } = new Function(slice(src, 'snow-farOff') + '\nreturn { farOff };')();
const box = (l, t, w, h) => ({ left: l, top: t, width: w, height: h, right: l + w, bottom: t + h });
const W = 960, H = 540;
assert(!farOff(box(100, 300, 100, 150), W, H), 'on screen');
assert(!farOff(box(100, -120, 100, 150), W, H), 'partly above the window');
assert(!farOff(box(100, 560, 100, 150), W, H), 'just below the window (< 100 px)');
assert(farOff(box(100, 700, 100, 150), W, H), 'a row far below');
assert(farOff(box(100, -400, 100, 150), W, H), 'a row far above');
assert(farOff(box(1100, 300, 100, 150), W, H), 'far right in the row');
assert(farOff(box(0, 0, 0, 0), W, H), 'hidden (display none)');

// a freed pile keeps its grains and gives the canvas back; restoring draws the same grains in the order they fell
const free = /function freePile\(p\) \{[\s\S]*?\n  \}/.exec(src)[0];
assert(!/p\.dots/.test(free), 'freePile must not touch p.dots');
assert(/p\.canvas\.width = 0/.test(free) && /removeChild\(p\.canvas\)/.test(free), 'backing store and layer are released');
const rest = /function restorePile\(p\) \{[\s\S]*?\n  \}/.exec(src)[0];
assert(/for \(var i = 0; i < p\.dots\.length; i\+\+\)/.test(rest) && /drawGrain\(p, d\.x, d\.y, d\.r, d\.a\)/.test(rest), 'redraw from dots with drawGrain, as when the grains fell');
assert(/if \(p\.freed\) restorePile\(p\)/.test(src), 'pileOf restores a freed pile');
assert(/PILE_FREE_BATCH = 30/.test(src) && /PILE_FREE_MS = 12000/.test(src));
console.log('snow-pilefree: ok');

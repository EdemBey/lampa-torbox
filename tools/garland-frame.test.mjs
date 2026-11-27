import assert from 'node:assert';
import { read, slice } from './_slice.mjs';

const sn = new Function(slice(read('snow.js'), 'snow-interval') + '\nreturn drawnInterval;')();
const api = new Function(slice(read('garland.js'), 'garland-frame') + '\nreturn { snowActive: snowActive, shouldDrawFrame: shouldDrawFrame };')();

// snowActive(ts, drawn)
for (const [ts, d, want] of [[1000, 0, false], [1000, undefined, false], [1000, 1000, true], [1249, 1000, true], [1250, 1000, false]]) {
  assert.strictEqual(api.snowActive(ts, d), want, 'active ' + [ts, d]);
}
// shouldDrawFrame(ts, drawn, interval), snow active: draw right after snow (d<4) or just before it (d>=interval-4)
for (const [ts, d, si, want] of [
  [1000, 1000, 33, true], [1003, 1000, 33, true], [1004, 1000, 33, false], [1016, 1000, 33, false],
  [1028, 1000, 33, false], [1029, 1000, 33, true], [1033, 1000, 33, true], [1029, 1000, undefined, true],
  [1046, 1000, 50, true], [1045, 1000, 50, false],
]) {
  assert.strictEqual(api.shouldDrawFrame(ts, d, si), want, 'draw ' + [ts, d, si]);
}

// drawnInterval(ts, prev, nominal): actual interval, clamped 16..100; nominal on first frame / after pause
for (const [ts, p, want] of [[100, 0, 20], [100, undefined, 20], [133.3, 100, 33.3], [110, 100, 16], [400, 100, 100]]) {
  assert.strictEqual(+sn(ts, p, 20).toFixed(1), want, 'interval ' + [ts, p]);
}
// Simulation: per vsync, snow (limiter like loop()) and garland in both rAF orders; garland must draw exactly in snow's frames.
function sim(vsync, fps, snowFirst) {
  let lastTs = 0, drawn = 0, interval = 1000 / fps, bad = 0, n = 0;
  for (let k = 1; k <= 600; k++) {
    const ts = k * vsync;
    const snow = () => {
      if (!lastTs) lastTs = ts;
      if (ts - lastTs >= 1000 / fps - 0.01) { lastTs = ts; interval = sn(ts, drawn, 1000 / fps); drawn = ts; return true; }
      return false;
    };
    const garland = () => api.snowActive(ts, drawn) ? api.shouldDrawFrame(ts, drawn, interval) : false;
    let s, g;
    if (snowFirst) { s = snow(); g = garland(); } else { g = garland(); s = snow(); }
    if (k > 30) { n++; if (g !== s) bad++; }
  }
  return bad;
}
for (const [v, f] of [[1000 / 60, 50], [20, 50], [1000 / 60, 30]]) {
  for (const first of [true, false]) assert.strictEqual(sim(v, f, first), 0, 'sim ' + [v, f, first]);
}
console.log('garland-frame ok');

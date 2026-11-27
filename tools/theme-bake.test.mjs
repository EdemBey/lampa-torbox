import assert from 'node:assert';
import { read, slice } from './_slice.mjs';

const src = read('theme.js');
const calls = [];
const env = { isOn: () => true, bakeSync() {}, document: {}, window: { innerWidth: 1920, innerHeight: 1080 }, setTimeout() {}, Lampa: {} };
const { gradLine, bakeGrad, bakeFilter, BG_GRAD, BG_FILTER, bake } = new Function(...Object.keys(env),
  slice(src, 'theme-bake') + '\nreturn { gradLine, bakeGrad, bakeFilter, BG_GRAD, BG_FILTER, bake };')(...Object.values(env));

const near = (a, b) => assert(Math.abs(a - b) < 1e-9, a + ' != ' + b);

// CSS gradient line: 90deg left->right, 0deg bottom->top, 180deg top->bottom
let p = gradLine(90, 1920, 1080); near(p.x0, 0); near(p.x1, 1920); near(p.y0, 540); near(p.y1, 540);
p = gradLine(0, 1920, 1080); near(p.y0, 1080); near(p.y1, 0); near(p.x0, 960);
p = gradLine(180, 1920, 1080); near(p.y0, 0); near(p.y1, 1080);
p = gradLine(45, 100, 100); near(p.x0, 0); near(p.y0, 100); near(p.x1, 100); near(p.y1, 0); // 45deg on a square: corner to corner

// the table equals the standard-syntax .background:after rule of the CSS text
const css = /\.background:after\{content:[^}]*\}/.exec(src)[0];
const std = css.slice(css.lastIndexOf('background:linear-gradient(') + 'background:'.length, -1);
const layers = std.match(/linear-gradient\((?:[^()]|\([^()]*\))*\)/g);
assert.strictEqual(layers.length, BG_GRAD.layers.length);
layers.forEach((l, i) => {
  assert.strictEqual(parseInt(l.slice(16), 10), BG_GRAD.layers[i].deg);
  const stops = [...l.matchAll(/rgba\(([\d,]+),([\d.]+)\) ([\d.]+)%?/g)].map((m) => { assert.strictEqual(m[1], BG_GRAD.rgb); return [Number(m[3]), Number(m[2])]; });
  assert.deepStrictEqual(stops, BG_GRAD.layers[i].stops);
});
// the CSS filter comes from BG_FILTER, no second copy of the numbers
assert(src.includes('-webkit-filter:" + BG_FILTER + ";filter:" + BG_FILTER + "}'));
assert.strictEqual((src.match(/brightness\(1\.5\)/g) || []).length, 1);

// bakeGrad: bottom layer of the CSS list is painted first; screen coordinates under a canvas->screen transform
const log = [];
const ctx = {
  save() { log.push('save'); }, restore() { log.push('restore'); },
  setTransform(...a) { log.push(['T', ...a]); },
  createLinearGradient(...a) { const g = { a, stops: [], addColorStop(o, c) { g.stops.push([o, c]); } }; return g; },
  fillRect(...a) { log.push(['fill', this.fillStyle.a.map((v) => Math.round(v) + 0), this.fillStyle.stops.length, ...a]); }
};
bakeGrad(ctx, 960, 540, 1920, 1080);
assert.deepStrictEqual(log[1], ['T', 0.5, 0, 0, 0.5, 0, 0]);
assert.deepStrictEqual(log[2], ['fill', [960, 0, 960, 1080], 2, 0, 0, 1920, 1080]); // 180deg (last in CSS) first
assert.deepStrictEqual(log[3], ['fill', [960, 1080, 960, 0], 4, 0, 0, 1920, 1080]);
assert.deepStrictEqual(log[4], ['fill', [0, 540, 1920, 540], 3, 0, 0, 1920, 1080]); // 90deg on top
assert.strictEqual(ctx.fillStyle.stops[1][1], 'rgba(5,6,10,0.5)');
assert.strictEqual(ctx.fillStyle.stops[1][0], 0.18);

// bakeFilter: copy through a temporary canvas, then the same filter string, no pixel reads
const order = [];
const mk = (n) => ({ drawImage() { order.push(n + ':draw'); }, save() {}, restore() {}, setTransform() {}, clearRect() { order.push(n + ':clear'); },
  set filter(v) { order.push('filter=' + v); } });
const tctx = mk('tmp');
env.document.createElement = () => ({ getContext: () => tctx });
const main = mk('main');
main.canvas = {};
bakeFilter(main, 10, 10);
assert.deepStrictEqual(order, ['tmp:draw', 'main:clear', 'filter=' + BG_FILTER, 'main:draw']);
console.log('theme-bake: ok');

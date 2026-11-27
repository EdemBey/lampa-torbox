import assert from 'node:assert';
import { read, slice } from './_slice.mjs';

const src = read('theme.js');
const log = [];
const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (...a) => log.push([k, ...a])), set: (t, k, v) => { t[k] = v; log.push([k, v]); return true; } });
const env = { document: { createElement: () => ({ getContext: () => ctx, toDataURL: () => 'data:X' }) }, fxOff: () => false, window: {} };
const { SHADOW, shadowCss } = new Function(...Object.keys(env), slice(src, 'theme-shadow') + '\nreturn { SHADOW, shadowCss };')(...Object.values(env));

// the numbers equal the box-shadow of the CSS text
const css = /\.card__view\{box-shadow:0 ([\d.]+)em ([\d.]+)em rgba\(0,0,0,([\d.]+)\)/.exec(src);
const foc = /\.card\.focus \.card__view\{box-shadow:0 ([\d.]+)em ([\d.]+)em rgba\(0,0,0,([\d.]+)\)/.exec(src);
assert.deepStrictEqual([SHADOW.rest.dy, SHADOW.rest.blur, SHADOW.rest.a], css.slice(1).map(Number));
assert.deepStrictEqual([SHADOW.focus.dy, SHADOW.focus.blur, SHADOW.focus.a], foc.slice(1).map(Number));
assert.strictEqual(SHADOW.r, Number(/\.card__view,\.card__img\{border-radius:([\d.]+)em/.exec(src)[1]));

// em 20: rest pad = ceil((.6 + 2.4) * 20) = 60, corner = 60 + 22 = 82; blur is the CSS blur radius (canvas sigma = blur / 2 as well)
const out = shadowCss(20);
assert(out.includes('url(data:X) 82 fill/4.1em/3em'), out);
assert(out.includes('url(data:X) 140 fill/7em/5.9em'), out); // focus: pad = (1.4 + 4.5) * 20 = 118 -> slice 118 + 22 = 140
// square corners (radius switch off): the sprite is built with radius 0, nothing is thrown by arcTo, the slice is the shadow pad only
log.length = 0;
assert(shadowCss(20, true).includes('url(data:X) 60 fill/3em/3em'), 'square rest sprite');
assert(log.every((e) => e[0] !== 'arcTo' || e[5] === 0), 'arcTo radius must stay 0');
console.log('theme-shadow: ok');

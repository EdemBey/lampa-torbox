import assert from 'node:assert';
import { read, slice } from './_slice.mjs';

const src = read('theme.js');

// (b) the temporary diagnostics are gone
assert(!/DIAG-TEMP|lampa_theme_diag|diagVal|diagApply/.test(src), 'diagnostics left in theme.js');

// the switches, the CSS they build
const store = {};
const env = { Lampa: { Storage: { get: (k, d) => (k in store ? store[k] : d) } }, document: {} };
const { FX, fxOff, fxCss } = new Function(...Object.keys(env), slice(src, 'theme-fx') + '\nreturn { FX, fxOff, fxCss };')(...Object.values(env));
assert.deepStrictEqual(FX.map((g) => g.id), ['shadow', 'blur', 'bg', 'radius', 'mask']);
assert.strictEqual(fxOff('shadow'), false); // default: on
store.lampa_theme_fx_shadow = 'false'; assert.strictEqual(fxOff('shadow'), true);
store.lampa_theme_fx_shadow = false; assert.strictEqual(fxOff('shadow'), true);
store.lampa_theme_fx_shadow = true; assert.strictEqual(fxOff('shadow'), false);
store.lampa_theme_diag = 'all'; assert.strictEqual(fxOff('bg'), false); // the old diagnostics key means nothing
const css = fxCss();
assert(css.includes('body.lampa-theme-off--shadow .card__view,'), 'prefix');
assert(css.includes('body.lampa-theme-off--mask.lampa-theme--billboard .activity--active .activity__body>div>.scroll{mask-image:none!important;-webkit-mask-image:none!important}'), 'billboard mask');
assert(!/lampa-theme-off--\w+ body/.test(css), 'no nested body');

// (a) every effect of the theme CSS belongs to a group or is a named exception
const EXCEPT = [
  ['.full-descr__text.focus', 'box-shadow', 'focus ring (inset white outline), not a shadow'],
  ['.online-mod-variant', 'box-shadow', '1px inset hairline border'],
  ['.full-person__photo', 'border-radius', 'circle (50%): the round shape is the point'],
  ['.items-line__title .full-person__photo', 'border-radius', 'circle (50%): the round shape is the point']
];
const sel = (s) => s.trim().replace(/^body /, '');
const prop = (p) => p.trim().replace(/^-webkit-/, '');
const covered = new Set();
for (const g of FX) for (const [selectors, decls] of g.rules) for (const s of selectors.split(',')) for (const d of decls.split(';')) covered.add(sel(s) + '|' + prop(d.split(':')[0]));
const exc = new Set(EXCEPT.map(([s, p, why]) => { assert(why, 'exception needs a reason'); return s + '|' + p; }));

const line = /^  var CSS = (".*");$/m.exec(src)[1];
const CSS = new Function(slice(src, 'theme-bake') + '\nreturn ' + line + ';')();
const FAMILY = /^(box-shadow|text-shadow|backdrop-filter|mask-image|border-radius|filter)$/;
let seen = 0;
const used = new Set();
for (const m of CSS.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  for (const decl of m[2].split(';')) {
    const i = decl.indexOf(':');
    if (i < 0 || !FAMILY.test(prop(decl.slice(0, i)))) continue;
    if (/^\s*(none|0)\s*(!important)?\s*$/.test(decl.slice(i + 1))) continue; // a reset, already off
    for (const s of m[1].split(',')) {
      const k = sel(s) + '|' + prop(decl.slice(0, i));
      seen++;
      assert(covered.has(k) || exc.has(k), 'effect without a switch: ' + k + ' (add it to FX in plugin/theme.js or to EXCEPT here with a reason)');
      if (exc.has(k)) used.add(k);
    }
  }
}
assert(seen > 40, 'the scan found too few effects: ' + seen);
for (const k of exc) assert(used.has(k), 'stale exception: ' + k);

// the billboard CSS is built in code: the same effects, counted and found in the groups
const bb = src.slice(src.indexOf('function bbBuild()'), src.indexOf('// The rows area is shrunk'));
const found = bb.match(/(?:text-shadow|border-radius|mask-image|box-shadow|backdrop-filter|filter):/g) || [];
assert.strictEqual(found.length, 3, 'billboard CSS has a new effect: ' + found);
assert(covered.has('.lampa-bb__title|text-shadow') && covered.has('.lampa-bb__chip|border-radius'));
assert(FX.find((g) => g.id === 'mask').rules.some((r) => r[0].includes('.activity__body>div>.scroll')), 'billboard scroller mask');

console.log('theme-fx: ok (' + seen + ' effects checked)');

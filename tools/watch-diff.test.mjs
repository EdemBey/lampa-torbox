// Refactor safety net: place() of the plugin's watch against a frozen copy of it (tools/fixtures/watch-frozen.txt)
// over a fixed grid of inputs. Any difference is a behaviour change: either a bug, or an intended change —
// then re-freeze (node tools/watch-diff.test.mjs --freeze) in the same commit and say so in its message.
// The mutations at the end prove the grid reaches the rules: each must be noticed.
import assert from 'node:assert';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { read, slice } from './_slice.mjs';
import { makeWatch } from './_watch.mjs';

const frozenFile = fileURLToPath(new URL('./fixtures/watch-frozen.txt', import.meta.url));
const live = slice(read('online_mod.js'), 'watch');
if (process.argv.includes('--freeze')) {
  writeFileSync(frozenFile, live);
  console.log('frozen: ' + live.length + ' chars');
  process.exit(0);
}
const frozen = readFileSync(frozenFile, 'utf8');

// arm answers both copies see (armed()): parts 5 and 6 are season 2 of show 7, part 8 another show, 9 failed
const arms = () => {
  const t = Date.now();
  return { online_mod_watch_arm: { m5: { t, d: 7, s: 2 }, m6: { t, d: 7, s: 2 }, m8: { t, d: 99, s: 1 }, m9: { t, e: 1, d: 0, s: 0 } } };
};

const COUNTS = [
  {},
  { 1: 12 },
  { 1: 12, 2: 12 },
  { 1: 12, 2: 24, 3: 39 },
  { 1: 12, 2: 13, 4: 10 },
  { 1: 61, 2: 16, 3: 14 }
];
// Absolute runs [n, season, firstEp, len]: seasons numbered from 1, and numbered on (One Piece)
const ALTS = [
  null,
  { y: [12, 12], ys: ['5', '6'], g: 0, a: 0 },
  { y: [12, 12], ys: ['5', '6'], g: [12, 12], a: 0 },
  { y: [12, 13], ys: ['5', '6'], g: [12, 12], a: 0 },
  { y: 0, ys: 0, g: 0, a: [[1, 1, 1, 12], [13, 2, 1, 12]] },
  { y: [91], ys: ['5'], g: 0, a: [[1, 1, 1, 61], [62, 2, 62, 16], [78, 3, 78, 14]] }
];
const MAPS = [
  {},
  { std: 1 },
  { 'b:1': 0, 'shiki:5': 0 },
  { 'b:2': [1, 1, 13], 'shiki:5:2': [1, 2, 1] },
  { parts: [12, 12] },
  { 'std:2': [13, 2, 1], 'shiki:5': [1, 2, 1] }
];
const NUMS = [1, 12, 13, 24, 25, 62, 77, 91];
const PAIRS = [];
// a list starts at 1 or right after a season end
[1, 13, 25, 62].forEach((a) => NUMS.forEach((b) => { if (a <= b) PAIRS.push([a, b]); }));
const allParts = [{ shiki: '5', n: 12, first: 1 }, { shiki: '6', n: 12, first: 1 }, { shiki: '8', n: 12, first: 1 }];
// what a balancer may report beside the numbers: [src, part, span, split]
const KINDS = [
  ['', undefined, undefined, false],
  ['', undefined, undefined, true],
  ['', undefined, [[1, 12], [13, 24]], false],
  ['', undefined, [[1, 61], [63, 77], [78, 91]], false],
  ['shiki:5', undefined, undefined, false],
  ['anilibria:x', undefined, undefined, false],
  ['shiki:5', { index: 0, bounds: [0, 12, 24], first: 1, all: allParts, at: 0 }, undefined, false],
  ['shiki:6', { index: 1, bounds: [0, 12, 24], first: 1, all: allParts, at: 1 }, undefined, false],
  ['shiki:6', { index: 1, bounds: [0, 12, 24], first: 13, all: allParts, at: 1 }, undefined, false],
  ['shiki:6', { index: -1, bounds: [0], first: 1, all: allParts.slice(0, 2), at: 1 }, undefined, false],
  ['shiki:8', { index: -1, bounds: [0], first: 1, all: allParts, at: 2 }, undefined, false],
  ['shiki:9', { index: -1, bounds: [0], first: 1, all: [{ shiki: '9', n: 12, first: 1 }], at: 0 }, undefined, false],
  ['shiki:5', { index: -2, bounds: [0], first: 0, all: allParts, at: 0 }, undefined, false]
];

// the first input the two copies place differently, null when none; n counts the inputs
function differ(codeA, codeB) {
  const a = makeWatch(codeA, arms()).watch;
  const b = makeWatch(codeB, arms()).watch;
  let n = 0;
  // the cards and answers turn innermost: a broken rule meets every one of them early
  for (const kind of KINDS) for (const pair of PAIRS) for (const season of [-1, 1, 2, 3, 4]) for (const seasons of [0, 1, 2, 3]) {
    for (const episode of [0, pair[0], pair[1]]) for (const anime of [false, true]) {
      for (const counts of COUNTS) for (const alt of ALTS) for (const map of MAPS) {
        const q = { src: kind[0], part: kind[1], balancer: 'b', season, episode, min: Math.min(pair[0], episode), max: pair[1], split: kind[3], seasons, span: kind[2], tmdb: 7 };
        n++;
        const ra = a.place(map, counts, anime, q, alt);
        const rb = b.place(map, counts, anime, q, alt);
        // null, false or {season, episode}
        if (ra !== rb && !(ra && rb && ra.season === rb.season && ra.episode === rb.episode)) return { n, q, counts, alt, map, anime, live: ra, frozen: rb };
      }
    }
  }
  differ.n = n;
  return null;
}

const diff = differ(live, frozen);
assert.strictEqual(diff, null, 'place() differs from the frozen copy:\n' + JSON.stringify(diff, null, 1));

// each rule broken on purpose must show up on the grid
const mutations = [
  ['if (saved === 0) return false;', 'if (saved === 0) return null;'],
  ['if (saved) return this.canon(saved, q.episode, counts) || false;', 'if (saved) return this.canon(saved, q.episode + 1, counts) || false;'],
  ['if (listed) return listed;', 'if (listed) return null;'],
  ['this.armed(q.part, q, counts) : this.stacked', 'this.stacked(q.part, q.episode, counts) : this.stacked'],
  ['q.max > counts[1] + (counts[2] || 0)', 'q.max > counts[1]'],
  ['(one || this.chain(q.span, q.seasons))', '(one)'],
  ['if (q.src) return null;', 'if (q.src) return false;'],
  ['if (!counts[q.season]) return anime ? null : same;', 'if (!counts[q.season]) return null;'],
  ['if (before && q.min > before)', 'if (before && q.min >= before)'],
  ['q.season == 1 && this.whole(q.max, counts) ?', 'q.season == 1 ?'],
  ['return !anime || q.season == 1 || map.std && alike', 'return !anime || map.std && alike'],
  ['r = q.src ? this.kodik(alt, counts, q) : this.agree(alt, counts, q);', 'r = q.src ? null : this.agree(alt, counts, q);'],
  ['r = q.src ? this.kodik(alt, counts, q) : this.agree(alt, counts, q);', 'r = q.src ? this.kodik(alt, counts, q) : null;'],
  ['return this.tmdb(alt, r, counts);', 'return r;'],
  ['if (!hi && !ends[from]) return null;', 'if (!hi) return null;'],
  ['return { season: mine.s, episode: before + q.episode };', 'return { season: mine.s, episode: q.episode };']
];
mutations.forEach((m) => {
  assert.ok(frozen.split(m[0]).length === 2, 'mutation target not found once in the frozen copy: ' + m[0]);
  assert.ok(differ(frozen.replace(m[0], m[1]), frozen), 'the grid does not notice: ' + m[0] + '  ->  ' + m[1]);
});
console.log('watch-diff OK: ' + differ.n + ' inputs, ' + mutations.length + ' mutations noticed');

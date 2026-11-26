// The watch is one object mixed from blocks (// @module watch-*). This keeps the blocks honest: what a block reaches
// through `this`/`self` must be its own or belong to a block it is allowed to use, and the pure ones run on their own.
import assert from 'node:assert';
import { read, slice } from './_slice.mjs';
import { makeWatch } from './_watch.mjs';

const src = read('online_mod.js');
const names = ['index', 'proofs', 'rules', 'stores', 'timeline', 'resume', 'menu'];
const text = {};
const members = {};
names.forEach((n) => {
  text[n] = slice(src, 'watch-' + n);
  members[n] = (text[n].match(/^ {6}[A-Za-z_$][\w$]*(?=: )/gm) || []).map((m) => m.trim());
  assert.ok(members[n].length, 'watch-' + n + ' has members');
});
// every member lives in exactly one block
const all = [].concat(...names.map((n) => members[n]));
assert.strictEqual(new Set(all).size, all.length, 'a member defined in two blocks');

// block -> the blocks it may reach; extra: state set at run time and the one lookup proofs take from the stores
const may = {
  index: [],
  proofs: ['index'],
  rules: ['index', 'proofs'],
  stores: ['index'],
  timeline: ['index', 'proofs', 'rules', 'stores'],
  resume: ['index', 'stores', 'timeline'],
  menu: ['index', 'proofs', 'rules', 'stores', 'timeline', 'resume']
};
const extra = {
  proofs: ['armOf'],
  timeline: ['cached', 'cachedCard', 'cachedSeason', 'cachedLength', 'cachedNums', 'cachedMap', 'cachedCounts', 'cachedSplitObj', 'cachedSeasons', 'cachedAlt', 'installed', 'refresh'],
  // save() and sync() drop the list cache of the timeline block
  stores: ['cached']
};
names.forEach((n) => {
  const allowed = new Set([].concat(members[n], ...may[n].map((d) => members[d]), extra[n] || []));
  const used = new Set((text[n].match(/\b(?:this|self)\.([A-Za-z_$][\w$]*)/g) || []).map((m) => m.split('.')[1]));
  // a Lampa.Reguest inside a callback is `this` too
  ['timeout', 'silent'].forEach((k) => used.delete(k));
  const foreign = [...used].filter((k) => !allowed.has(k));
  assert.deepStrictEqual(foreign, [], 'watch-' + n + ' reaches outside its blocks: ' + foreign.join(', '));
});

// a block built alone, with only the blocks it may use
const build = (list, stub) => {
  const code = list.map((n) => text[n]).join('\n') + '\n' + slice(src, 'watch').slice(slice(src, 'watch').indexOf('    function watchMix(parts) {')).replace(/var watch = watchMix\(\[[^\]]*\]\);/, 'var watch = watchMix([' + list.map((n) => 'watch' + n[0].toUpperCase() + n.slice(1)).join(', ') + ']);');
  const w = makeWatch(code).watch;
  return Object.assign(w, stub || {});
};
{
  const w = build(['index']);
  assert.deepStrictEqual(w.canon([1, 1, 1], 13, { 1: 12, 2: 12 }), { season: 2, episode: 1 });
  assert.strictEqual(w.whole(24, { 1: 12, 2: 12 }), true);
  assert.deepStrictEqual(w.absolute([[1, 1, 1, 61], [62, 2, 62, 16]], 66, { 1: 61, 2: 16 }), { season: 2, episode: 66 });
  assert.deepStrictEqual(w.tmdb({ a: [[1, 1, 1, 61], [62, 2, 62, 16]] }, { season: 2, episode: 5 }, { 1: 61, 2: 16 }), { season: 2, episode: 66 });
  assert.strictEqual(w.key({ original_title: 'T' }, 11, 5), '11:5T');
  assert.strictEqual(w.rule, undefined);
}
{
  const w = build(['index', 'proofs'], { armOf: (mal) => ({ 5: { t: 1, d: 7, s: 2 }, 6: { t: 1, d: 7, s: 2 } })[mal] || null });
  const counts = { 1: 12, 2: 24 };
  assert.deepStrictEqual(w.stacked({ index: 1, bounds: [0, 12, 36], first: 1 }, 3, counts), { season: 2, episode: 3 });
  assert.strictEqual(w.chain([[1, 12], [13, 24]], 2), true);
  const parts = [{ shiki: '5', n: 12, first: 1 }, { shiki: '6', n: 12, first: 1 }];
  assert.deepStrictEqual(w.armed({ index: -1, bounds: [0], first: 1, all: parts, at: 1 }, { tmdb: 7, episode: 3 }, counts), { season: 2, episode: 15 });
}
{
  const w = build(['index', 'proofs', 'rules'], { armOf: () => null });
  const q = { src: '', balancer: 'b', season: 2, episode: 3, min: 1, max: 12, seasons: 2 };
  assert.deepStrictEqual(w.place({}, { 1: 12, 2: 12 }, false, q, null), { season: 2, episode: 3 });
  assert.strictEqual(w.place({}, { 1: 12, 2: 12 }, true, q, null), null);
  assert.strictEqual(w.place({ 'b:2': 0 }, { 1: 12, 2: 12 }, true, q, null), false);
  // q.by: the decision that answered
  const by = (map, counts, anime, over, alt) => { const x = Object.assign({}, q, over); w.place(map, counts, anime, x, alt); return x.by; };
  const two = { 1: 12, 2: 12 };
  assert.strictEqual(by({ 'b:2': 0 }, two, true), 'answer');
  assert.strictEqual(by({ parts: [12, 12] }, two, true), 'listed');
  assert.strictEqual(by({}, two, true, { src: 'shiki:5', part: { index: -2, bounds: [0], first: 0 } }), 'part');
  assert.strictEqual(by({}, { 1: 61, 2: 16, 3: 14 }, true, { season: 1, seasons: 1, episode: 66, max: 91 }, { a: [[1, 1, 1, 61], [62, 2, 62, 16], [78, 3, 78, 14]] }), 'group');
  assert.strictEqual(by({}, two, true, { src: 'anilibria:x' }), 'release');
  assert.strictEqual(by({}, two, false), 'season');
  assert.strictEqual(by({}, two, true), 'season');
  assert.strictEqual(by({}, two, true, {}, { y: [12, 12], g: [12, 12] }), 'agree');
  assert.strictEqual(by({}, two, true, { src: 'shiki:6', season: 1 }, { y: [12, 12], ys: ['5', '6'], g: [12, 12] }), 'entry');
}

// places moved: the listener hears a card id (arm, alt) or nothing = every card (an answer saved)
{
  const m = makeWatch(slice(src, 'watch'));
  const heard = [];
  m.watch.onPlaces = (id) => heard.push(id === undefined ? 'all' : id);
  const card = { id: 5, original_title: 'A', original_name: 'A', seasons: [{ season_number: 1, episode_count: 12 }, { season_number: 2, episode_count: 12 }], number_of_seasons: 2 };
  m.watch.save(card, { std: 1 });
  assert.deepStrictEqual(heard, ['all']);
  m.watch.alt(card);
  assert.deepStrictEqual(heard, ['all', 'tmdb_5']);
  m.Lampa.Reguest = function () { this.timeout = () => {}; this.silent = (url, ok) => ok({ themoviedb: 5, 'themoviedb-season': 2 }); };
  m.watch.arm(card, [{ shiki: '9' }]);
  assert.deepStrictEqual(heard, ['all', 'tmdb_5', 'tmdb_5']);
  // without a listener nothing breaks
  m.watch.onPlaces = null;
  m.watch.save(card, null);
}
// asks: the list on screen stays while a probe places another list of the same card; a new list on screen replaces it
{
  const m = makeWatch(slice(src, 'watch'));
  const card = { id: 6, original_title: 'B', original_name: 'B', seasons: [{ season_number: 1, episode_count: 12 }, { season_number: 2, episode_count: 12 }], number_of_seasons: 2 };
  const list = [1, 2, 3].map((e) => ({ season: 1, episode: e }));
  const views = list.map((el, i) => m.watch.view(card, 'alloha', el, 'old' + i, list, 2));
  assert.strictEqual(m.watch.asks.length, 3);
  const probe = [1, 2].map((e) => ({ season: 2, episode: e }));
  probe.forEach((el) => m.watch.hashOf(card, 'kodik', el, probe, 2));
  assert.strictEqual(m.watch.asks.length, 3);
  assert.strictEqual(m.watch.ctx(views[1]).element, list[1]);
  // the screen goes on drawing its list after the probe
  const more = { season: 1, episode: 4 };
  list.push(more);
  m.watch.view(card, 'alloha', more, 'old3', list, 2);
  assert.strictEqual(m.watch.asks.length, 4);
  const next = [{ season: 2, episode: 1 }];
  m.watch.view(card, 'alloha', next[0], 'n0', next, 2);
  assert.deepStrictEqual(m.watch.asks.map((a) => a.element), next);
}
// waiting(): pending only because arm has not answered for a part
{
  const t = Date.now();
  const m = makeWatch(slice(src, 'watch'), { online_mod_watch_arm: { m5: { t, d: 7, s: 2 } } });
  const el = (all, pending) => ({ watch_pending: pending, watch_q: { part: { index: -1, all: all } } });
  assert.strictEqual(m.watch.waiting(el([{ shiki: '5' }, { shiki: '6' }], true)), true);
  assert.strictEqual(m.watch.waiting(el([{ shiki: '5' }], true)), false);
  assert.strictEqual(m.watch.waiting(el([{ shiki: '5' }, { shiki: '6' }], false)), false);
  assert.strictEqual(m.watch.waiting({ watch_pending: true, watch_q: { part: { index: -2, all: [{ shiki: '6' }] } } }), false);
  assert.strictEqual(m.watch.waiting({ watch_pending: true, watch_q: { src: 'anilibria:1' } }), false);
  assert.strictEqual(m.watch.waiting(null), false);
}
console.log('watch-blocks OK');

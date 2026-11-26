// Characterization of the episode placing: whole source lists go through watch.view() as a balancer hands them
// over, and every row's outcome is compared with tools/fixtures/placing.json. The expectations were RECORDED from
// the code (node tools/placing.test.mjs --record), they are what it does, not what it should do. A change here is
// a behaviour change: record again in the same commit, bump episodeVariants.rules, and name the rows that moved.
import assert from 'node:assert';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { read, slice } from './_slice.mjs';
import { makeWatch } from './_watch.mjs';

const file = fileURLToPath(new URL('./fixtures/placing.json', import.meta.url));
const fixture = JSON.parse(readFileSync(file, 'utf8'));
const src = read('online_mod.js');
const code = slice(src, 'watch');
const rules = +(/episodeVariants\.rules = (\d+);/.exec(src) || [])[1];
const record = process.argv.includes('--record');

const range = (from, to) => { const out = []; for (let n = from; n <= to; n++) out.push(n); return out; };

function cardOf(c) {
  const seasons = Object.keys(c.counts || {}).map((s) => ({ season_number: +s, episode_count: c.counts[s] }));
  const card = { id: c.id, original_title: c.title, original_name: c.title, anime: !!c.anime, seasons: seasons, number_of_seasons: seasons.length };
  if (c.movie) { delete card.original_name; delete card.seasons; delete card.number_of_seasons; }
  return card;
}

function storeOf(c) {
  const id = 'tmdb_' + c.card.id;
  const s = c.store || {};
  const t = Date.now();
  const out = {};
  if (s.map) out.online_mod_watch_map = { [id]: s.map };
  if (s.alt) out.online_mod_watch_alt = { [id]: Object.assign({ t, k: 0 }, s.alt) };
  if (s.split) out.online_mod_watch_split = { [id]: s.split };
  if (s.arm) {
    out.online_mod_watch_arm = {};
    // [show, season] | "fail" | "none" (no TMDB mapping)
    Object.keys(s.arm).forEach((mal) => {
      const a = s.arm[mal];
      out.online_mod_watch_arm['m' + mal] = a === 'fail' ? { t, e: 1, d: 0, s: 0 } : a === 'none' ? { t, e: 1, u: 1, d: 0, s: 0 } : { t, d: a[0], s: a[1] };
    });
  }
  return out;
}

// the lists a balancer draws: [{label, seasons, items: [element]}]; items null = a file without its list (TorBox)
function listsOf(c, watch, card) {
  const so = c.source;
  if (so.type === 'plain') {
    return so.lists.map((l) => ({
      label: l.label || 's' + l.season,
      seasons: so.seasons,
      items: (l.eps || range(l.from, l.to)).map((e) => {
        const el = { season: l.season, episode: e };
        if (so.span) el.watch_info = { span: so.span };
        if (so.src) el.watch_info = { src: so.src };
        return el;
      })
    }));
  }
  if (so.type === 'kodik') {
    // a merged franchise as mergeParts leaves it: one season per shikimori entry, numbered from 1 unless told
    const seasons = so.parts.map((p, i) => ({ id: i + 1 }));
    const items = so.parts.map((p, i) => {
      const eps = {};
      range(p[2] || 1, (p[2] || 1) + p[1] - 1).forEach((e) => { eps[e] = 1; });
      return { shikimori_id: p[0], seasons: { [i + 1]: { episodes: eps } } };
    });
    const tv = (watch.altOf(card) || {}).ys || 0;
    return so.parts.map((p, i) => {
      const part = watch.kodikPart(seasons, items, tv, i + 1);
      return {
        label: 'shiki ' + p[0],
        seasons: so.parts.length,
        items: range(p[2] || 1, (p[2] || 1) + p[1] - 1).map((e) => ({ season: '' + (i + 1), episode: e, watch_info: { src: 'shiki:' + p[0], part: part } }))
      };
    });
  }
  if (so.type === 'entry') {
    // a Kodik entry of its own (not merged): its shikimori id, no part
    return so.lists.map((l) => ({ label: 'shiki ' + so.shiki + ' s' + l.season, seasons: so.seasons, items: range(l.from, l.to).map((e) => ({ season: l.season, episode: e, watch_info: { src: 'shiki:' + so.shiki } })) }));
  }
  if (so.type === 'nb') {
    // Naruto Based as its filtred() does: seasons of [malId, episodeNumber]
    const ordered = [];
    so.seasons.forEach((s) => s.forEach((e) => ordered.push({ malId: e[0], episodeNumber: e[1] })));
    const parts = watch.nbParts(ordered);
    return so.seasons.map((s, i) => ({
      label: 'site season ' + (i + 1),
      seasons: so.seasons.length,
      items: s.map((e) => ({ season: i + 1, episode: e[1], watch_info: e[0] ? { src: 'shiki:' + e[0], part: parts[e[0]] } : { src: 'naruto-based:slug' } }))
    }));
  }
  if (so.type === 'file') return so.files.map((f) => ({ label: 'S' + f[0] + 'E' + f[1], seasons: undefined, items: null, single: { season: '' + f[0], episode: '' + f[1] } }));
  throw new Error('unknown source type ' + so.type);
}

// "S:E" placed, "?" not proven (pending), "-" never linked or kept on the source's key, "x" not a card episode at all
function outcome(card, el, view, legacy) {
  const p = el.watch_place;
  if (p) {
    // Lampa's own timeline key, written out here on purpose: its format must never change
    assert.strictEqual(view.hash, 'h:' + [p.season, p.season > 10 ? ':' : '', p.episode, card.original_title].join(''), 'key of a placed row');
    assert.strictEqual(el.watch_pending, false);
    return p.season + ':' + p.episode;
  }
  assert.strictEqual(view.hash, legacy, 'an unplaced row keeps the source key');
  return el.watch_pending ? '?' : el.watch_q ? '-' : 'x';
}

// rows with consecutive numbers and one kind of outcome fold into "1-61 => 1:1-61"
function fold(eps, outs) {
  const lines = [];
  let i = 0;
  while (i < eps.length) {
    let j = i;
    const placed = /:/.test(outs[i]);
    const [s0, e0] = placed ? outs[i].split(':').map(Number) : [];
    while (j + 1 < eps.length && eps[j + 1] === eps[j] + 1 && (placed ? outs[j + 1] === s0 + ':' + (e0 + (j + 1 - i)) : outs[j + 1] === outs[i])) j++;
    const from = eps[i] + (j > i ? '-' + eps[j] : '');
    lines.push(from + ' => ' + (placed ? s0 + ':' + e0 + (j > i ? '-' + (e0 + j - i) : '') : outs[i]));
    i = j + 1;
  }
  return lines;
}

function run(c) {
  const { watch } = makeWatch(code, storeOf(c));
  const card = cardOf(c.card);
  const out = {};
  listsOf(c, watch, card).forEach((l) => {
    const els = l.items || [l.single];
    const outs = els.map((el, i) => {
      const legacy = 'legacy:' + l.label + ':' + i;
      const view = watch.view(card, c.source.balancer, el, legacy, l.items, l.seasons);
      return outcome(card, el, view, legacy);
    });
    assert.ok(!(l.label in out), 'list label used twice: ' + l.label);
    out[l.label] = fold(els.map((el) => parseInt(el.episode)), outs);
  });
  return out;
}

const names = {};
const moved = [];
fixture.cases.forEach((c) => {
  assert.ok(!names[c.name], 'case name used twice: ' + c.name);
  names[c.name] = true;
  const got = run(c);
  if (!record) return assert.deepStrictEqual(got, c.expect, c.name);
  // a new case has no expectation yet: recording it moves nothing
  if (c.expect && JSON.stringify(c.expect) !== JSON.stringify(got)) moved.push(c.name);
  c.expect = got;
});

if (record) {
  // rows that moved while the rules version stayed would be read from the «По сериям» cache as they were
  if (moved.length && fixture.rules === rules) {
    console.error('the placing changed (' + moved.join('; ') + ') but episodeVariants.rules is still ' + rules + ': bump it, then record again');
    process.exit(1);
  }
  // one case per line keeps the diff of a re-record readable
  const text = '{\n"rules": ' + rules + ',\n"cases": [\n' + fixture.cases.map((c) => JSON.stringify(c)).join(',\n') + '\n]\n}\n';
  writeFileSync(file, text);
  console.log('recorded ' + fixture.cases.length + ' cases under rules ' + rules);
} else {
  assert.strictEqual(fixture.rules, rules, 'episodeVariants.rules changed: record tools/fixtures/placing.json again');
  console.log('placing OK: ' + fixture.cases.length + ' cases');
}

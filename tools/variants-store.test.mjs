import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('../plugin/online_mod.js', import.meta.url)), 'utf8');
const from = src.indexOf("    episodeVariants.store = 'online_mod_variants_v2';");
const to = src.indexOf('    episodeVariants.clear = function () {');
assert(from > 0 && to > from, 'the «По сериям» store not found in plugin/online_mod.js');

const disk = {};
const Lampa = { Storage: { get: (k, d) => (k in disk ? JSON.parse(disk[k]) : d === '{}' ? {} : d), set: (k, v) => { disk[k] = JSON.stringify(v); } } };
const episodeVariants = { cache: {} };
new Function('episodeVariants', 'Lampa', src.slice(from, to))(episodeVariants, Lampa);

// a row as the probe leaves it, a proven one and one of a source numbering by its own releases
const entry = {
  res: { status: 'ok', rows: [
    { season: 1, voice: 'AniLibria', element: { season: '2', episode: 11, quality: '1080p', watch_place: { season: 2, episode: 11 }, media: { big: 'x' } } },
    { season: 0, voice: 'OVA dub', element: { season: '2', episode: 1, quality: '', watch_info: { src: 'shiki:5', part: {} } } },
    { season: 1, voice: 'Alloha 4K', element: { season: '2', episode: 3, quality: '360p ~ 2160p', quality_base: 'https://x/?a=1', quality_tid: 77, quality_uhd: true } }
  ] },
  labels: ['Сезон 1', 'Сезон 2'], done: { 1: true }, all: false
};
episodeVariants.save('kodik:tmdb_1', entry);
// a new session reads it back from the storage
const fresh = { cache: {} };
new Function('episodeVariants', 'Lampa', src.slice(from, to))(fresh, Lampa);
const back = fresh.load('kodik:tmdb_1');
assert.deepStrictEqual(back.res.rows.map((r) => [r.season, r.voice, r.element.season, r.element.episode, r.element.quality, r.element.watch_place, !!(r.element.watch_info && r.element.watch_info.src)]), [
  [1, 'AniLibria', '2', 11, '1080p', { season: 2, episode: 11 }, false],
  [0, 'OVA dub', '2', 1, '', null, true],
  [1, 'Alloha 4K', '2', 3, '360p ~ 2160p', null, false]
]);
assert.deepStrictEqual(back.res.rows.map((r) => [r.element.quality_base, r.element.quality_tid, r.element.quality_uhd]), [
  [undefined, undefined, undefined],
  [undefined, undefined, undefined],
  ['https://x/?a=1', 77, true]
]);
assert.deepStrictEqual([back.res.status, back.labels, back.done['1'], back.all], ['ok', ['Сезон 1', 'Сезон 2'], true, false]);
// an old answer is not used
const stored = JSON.parse(disk.online_mod_variants_v2);
stored['kodik:tmdb_1'].t = Date.now() - 7 * 3600 * 1000;
disk.online_mod_variants_v2 = JSON.stringify(stored);
const later = { cache: {} };
new Function('episodeVariants', 'Lampa', src.slice(from, to))(later, Lampa);
assert.strictEqual(later.load('kodik:tmdb_1'), null);
// forget drops it from the memory copy and the storage
episodeVariants.forget('kodik:tmdb_1');
assert.strictEqual(JSON.parse(disk.online_mod_variants_v2)['kodik:tmdb_1'], undefined);
// an answer too big for a TV's storage is not written
const big = { res: { status: 'ok', rows: [] }, labels: [], done: {}, all: true };
for (let i = 0; i < 9000; i++) big.res.rows.push({ season: 0, voice: 'v' + (i % 20), element: { season: 1, episode: i, quality: 'q' } });
episodeVariants.save('alloha:tmdb_2', big);
assert.strictEqual(JSON.parse(disk.online_mod_variants_v2)['alloha:tmdb_2'], undefined);
// the old store (before the v2 key) is emptied once on the first read
disk.online_mod_variants = JSON.stringify({ 'kodik:tmdb_1': { r: [] } });
const old = { cache: {} };
new Function('episodeVariants', 'Lampa', src.slice(from, to))(old, Lampa);
old.all();
assert.strictEqual(disk.online_mod_variants, '{}');
// a v2 read ignores whatever sits under the old key
disk.online_mod_variants = JSON.stringify({ 'kodik:tmdb_1': { t: Date.now(), r: [], s: 'ok', q: [], v: [], l: [], d: {} } });
const v2 = { cache: {} };
new Function('episodeVariants', 'Lampa', src.slice(from, to))(v2, Lampa);
assert.strictEqual(v2.load('kodik:tmdb_1'), null);
// answers saved under other placement rules are not reused
episodeVariants.save('kodik:tmdb_3', entry);
const rules = { cache: {} };
new Function('episodeVariants', 'Lampa', src.slice(from, to))(rules, Lampa);
assert(rules.load('kodik:tmdb_3'));
const kept = JSON.parse(disk.online_mod_variants_v2);
assert.strictEqual(kept['kodik:tmdb_3'].w, rules.rules);
delete kept['kodik:tmdb_3'].w;
disk.online_mod_variants_v2 = JSON.stringify(kept);
const nowRules = { cache: {} };
new Function('episodeVariants', 'Lampa', src.slice(from, to))(nowRules, Lampa);
assert.strictEqual(nowRules.load('kodik:tmdb_3'), null);
console.log('variants-store OK');

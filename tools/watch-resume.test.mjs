// «Продолжить» has one decision (watch.resumeOf): the card's button and the season the episodes screen opens on
// (watch.startSeason) must name the same episode.
import assert from 'node:assert';
import { read, slice } from './_slice.mjs';
import { makeWatch } from './_watch.mjs';

const code = slice(read('online_mod.js'), 'watch');
const card = { id: 9, original_title: 'T', original_name: 'T', seasons: [1, 2, 3].map((s) => ({ season_number: s, episode_count: 12 })), number_of_seasons: 3 };
const key = (s, e) => 'h:' + s + e + 'T';
const link = (s, e) => ({ card: 'tv_9', season: s, episode: e });
const rec = (s, e, t) => ({ tmdb_9: { b: 'alloha', v: 'V', s: s - 1, t: t, p: { season: s, episode: e } } });
const of = (fv, resume) => makeWatch(code, Object.assign({ fv: fv }, resume ? { online_mod_resume: resume } : {})).watch;

// never played
{
  const w = of({});
  assert.strictEqual(w.resumeOf(card), null);
  assert.strictEqual(w.startSeason(card), 1);
  assert.strictEqual(w.resumeRec(card), null);
}
// our record, not finished: the same episode in its source, voice and season
{
  const w = of({ [key(2, 5)]: Object.assign({ percent: 40, updated: 100 }, link(2, 5)) }, rec(2, 5, 200));
  const r = w.resumeOf(card);
  assert.deepStrictEqual(r.target, { pin: { season: 2, episode: 5 }, s: 1 });
  assert.deepStrictEqual(r.pick, { season: 1, voice_name: 'V' });
  assert.strictEqual(r.rec.b, 'alloha');
  assert.strictEqual(w.startSeason(card), 2);
}
// finished: the next episode, the next season after a season's last
{
  const w = of({ [key(1, 12)]: Object.assign({ percent: 95, updated: 100 }, link(1, 12)) }, rec(1, 12, 200));
  assert.deepStrictEqual(w.resumeOf(card).target, { pin: { season: 2, episode: 1 }, s: 1 });
  assert.strictEqual(w.startSeason(card), 2);
}
// the finished mark lies under the source's own key (linked to the card), nothing under Lampa's key: the button
// always went on to season 2; the episodes screen used to open on season 1 and now agrees
{
  const w = of({ 'h:legacy': Object.assign({ percent: 95, updated: 100 }, link(1, 12)) }, rec(1, 12, 200));
  assert.deepStrictEqual(w.resumeOf(card).target.pin, { season: 2, episode: 1 });
  assert.strictEqual(w.startSeason(card), 2);
}
// an episode Lampa saw played after our record, and another one: it wins, played by the title's source
{
  const w = of({ [key(3, 2)]: Object.assign({ percent: 30, updated: 300 }, link(3, 2)) }, rec(1, 5, 200));
  const r = w.resumeOf(card);
  assert.strictEqual(r.rec, null);
  assert.strictEqual(r.src.b, 'alloha');
  assert.deepStrictEqual(r.target, { pin: { season: 3, episode: 2 }, s: 2 });
  assert.strictEqual(w.startSeason(card), 3);
}
// a record without a proven place: only the title's source is known
{
  const w = of({}, { tmdb_9: { b: 'kodik', v: '', s: 0, t: 5 } });
  assert.deepStrictEqual(w.resumeOf(card), { rec: null, src: { b: 'kodik', v: '', s: 0, t: 5 } });
  assert.strictEqual(w.startSeason(card), 1);
}

// every mix of a record and up to two marks: one episode for both
{
  const eps = [[1, 5], [1, 12], [2, 3], [2, 12], [3, 12]];
  const marks = [null];
  eps.forEach((e) => [50, 95].forEach((pc) => [200, 400].forEach((u) => marks.push({ e, pc, u }))));
  const recs = [null];
  [[1, 5], [1, 12], [2, 12], [3, 12]].forEach((p) => [100, 300, 500].forEach((t) => recs.push(rec(p[0], p[1], t))));
  let n = 0;
  ['key', 'title', 'own'].forEach((how) => marks.forEach((m1) => marks.forEach((m2) => recs.forEach((r) => {
    if (m1 && m2 && m1.e === m2.e) return;
    const fv = {};
    [m1, m2].forEach((m, i) => {
      if (m) fv[how === 'own' ? 'h:own' + i : key(m.e[0], m.e[1])] = Object.assign({ percent: m.pc, updated: m.u }, how === 'title' ? {} : link(m.e[0], m.e[1]));
    });
    const w = of(fv, r);
    const got = w.resumeOf(card);
    const season = got && got.target ? got.target.pin.season : 1;
    assert.strictEqual(w.startSeason(card), season, JSON.stringify({ how, m1, m2, r }));
    n++;
  }))));
  assert.ok(n > 10000);
}
console.log('watch-resume OK');

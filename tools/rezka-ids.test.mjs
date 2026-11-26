import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('../plugin/online_mod.js', import.meta.url)), 'utf8');
const from = src.indexOf('    function rezkaPageIds(str) {');
const to = src.indexOf('    var rezkaIds = {};');
assert(from > 0 && to > from, 'rezkaPageIds not found in plugin/online_mod.js');
// the browser's strict atob (Buffer would forgive a stray "/" and hide a broken capture)
const { rezkaPageIds, rezkaParts } = new Function('atob', src.slice(from, to) + '\nreturn { rezkaPageIds, rezkaParts };')(globalThis.atob);

// the rating links of HDrezka's "Black Clover" page, as served
const page = '<span class="b-post__info_rates imdb"><a href="/help/aHR0cHMlM0ElMkYlMkZ3d3cuaW1kYi5jb20lMkZ0aXRsZSUyRnR0NzQ0MTY1OCUyRg==/" target="_blank" rel="nofollow">IMDb</a></span>'
  + '<span class="b-post__info_rates kp"><a href="/help/aHR0cHMlM0ElMkYlMkZ3d3cua2lub3BvaXNrLnJ1JTJGZmlsbSUyRjEwNDk3MzElMkY=/" target="_blank" rel="nofollow">Кинопоиск</a></span>';
assert.deepStrictEqual(rezkaPageIds(page), { imdb: 'tt7441658', kp: '1049731' });
// no rating links, a broken one: nothing is made up
assert.deepStrictEqual(rezkaPageIds('<div>no ratings</div>'), { imdb: '', kp: '' });
assert.deepStrictEqual(rezkaPageIds('<a href="/help/!!notbase64/">x</a>'), { imdb: '', kp: '' });
assert.deepStrictEqual(rezkaPageIds(null), { imdb: '', kp: '' });
// the parts list of HDrezka's "Tokyo Revengers [ТВ-2]" page, as served (newest first, the open page has no link)
const list = '<div class="b-post__partcontent"> <div class="b-post__partcontent_item" data-url="https://rezka.ag/a/92895-tv-4.html"> <div class="td num">4</div> <div class="td title"><a href="https://rezka.ag/a/92895-tv-4.html">Токийские мстители: Битва трёх небожителей [ТВ-4]</a></div> <div class="td year">2026 год</div></div><div class="b-post__partcontent_item current"> <div class="td num">2</div> <div class="td title">Токийские мстители: Рождественская битва [ТВ-2]</div> <div class="td year">2023 год</div></div><div class="b-post__partcontent_item" data-url="https://rezka.ag/a/38786-tv-1.html"> <div class="td num">1</div> <div class="td title"><a href="https://rezka.ag/a/38786-tv-1.html">Токийские мстители [ТВ-1]</a></div> <div class="td year">2021 год</div></div> </div>';
assert.deepStrictEqual(rezkaParts(list), [
  { num: 1, title: 'Токийские мстители [ТВ-1]', link: 'https://rezka.ag/a/38786-tv-1.html', current: false, rating: '' },
  { num: 2, title: 'Токийские мстители: Рождественская битва [ТВ-2]', link: '', current: true, rating: '' },
  { num: 4, title: 'Токийские мстители: Битва трёх небожителей [ТВ-4]', link: 'https://rezka.ag/a/92895-tv-4.html', current: false, rating: '' }
]);
assert.deepStrictEqual(rezkaParts('<div>no parts</div>'), []);

// the rating sits in its own cell; HTML entities in titles are decoded
const rated = '<div class="b-post__partcontent_item current"> <div class="td num">1</div> <div class="td title">A &amp; B</div> <div class="td year">2017 год</div> <div class="td rating"><i class="hd-tooltip" title="x">8.19</i></div></div><div class="b-post__partcontent_item" data-url="https://rezka.ag/f.html"> <div class="td num">2</div> <div class="td title"><a href="https://rezka.ag/f.html">Film</a></div> <div class="td year">2023 год</div> <div class="td rating"><i class="hd-tooltip" title="y">6.97</i></div></div>';
assert.deepStrictEqual(rezkaParts(rated).map((p) => [p.num, p.title, p.rating]), [[1, 'A & B', '8.19'], [2, 'Film', '6.97']]);

// the card's ids: a cub card has no imdb_id of its own, TMDB's external_ids carry it
const { rezkaCardIds, rezkaNear, rezkaIdMatches } = new Function('atob', src.slice(from, to) + '\nreturn { rezkaCardIds, rezkaNear, rezkaIdMatches };')(globalThis.atob);
assert.deepStrictEqual(rezkaCardIds({ external_ids: { imdb_id: 'tt0388629' } }, undefined), { imdb: 'tt0388629', kp: '' });
assert.deepStrictEqual(rezkaCardIds({ imdb_id: 'tt1', external_ids: { imdb_id: 'tt2' }, kinopoisk_id: 252 }, undefined), { imdb: 'tt1', kp: '252' });
assert.deepStrictEqual(rezkaCardIds({}, 'tt7'), { imdb: 'tt7', kp: '' });
assert.deepStrictEqual(rezkaCardIds({ kinopoisk_id: 5 }, 9), { imdb: '', kp: '9' });
assert.deepStrictEqual(rezkaCardIds(null, undefined), { imdb: '', kp: '' });

// One Piece (TMDB 37854, 1999): HDrezka's live search shows five titles without it, the full search's first page has it
const mk = (title, year, link) => ({ title, year, link });
const live = [mk('One Piece. Большой куш', 2023, '/a/59895.html'), mk('Ван-Пис: Красный', 2022, '/a/57250.html'), mk('Ван-Пис: Фильм четвёртый', 2003, '/a/18468.html'),
  mk('Ван-Пис: Фильм седьмой', 2006, '/a/18469.html'), mk('Ван-Пис: Фильм девятый', 2008, '/a/18904.html')];
const full = live.concat([mk('Ван-Пис: Эпизод Небесного острова [Special]', 2018, '/a/s1.html'), mk('Ван-Пис: Приключение в глуби океана [Special]', 2000, '/a/s2.html'),
  mk('Ван-Пис / Большой куш', 1999, '/a/one-piece-1999.html'), mk('Ван-Пис: Победить пирата Гандзака! [OVA]', 1998, '/a/ova.html'), mk('Ван-Пис: Письмо от поклонника', 2024, '/a/new.html'), mk('no year', undefined, '/a/x.html')]);
// the year's neighbours only, the card's own year first; no year, no candidates
assert.deepStrictEqual(rezkaNear(full, 1999).map((c) => c.link), ['/a/one-piece-1999.html', '/a/s2.html', '/a/ova.html']);
assert.deepStrictEqual(rezkaNear(full, 0), []);

// ids by link, as the pages' rating links would give them
const pages = { '/a/one-piece-1999.html': { imdb: 'tt0388629', kp: '252' }, '/a/s2.html': { imdb: 'tt0999', kp: '1' }, '/a/ova.html': { imdb: 'tt0998', kp: '2' } };
const run = (list, imdb, kp, table, alive = () => true) => {
  const asked = [];
  let out = null;
  rezkaIdMatches(list, imdb, kp, (card, got) => { asked.push(card.link); got(table[card.link] || null); }, alive, (m) => { out = m; });
  return { asked, out };
};
// the live five carry no match; the near-year titles of the full page give exactly one: it is the single result
assert.deepStrictEqual(run(live, 'tt0388629', '', {}).out, []);
const b = run(rezkaNear(full, 1999), 'tt0388629', '', pages);
assert.deepStrictEqual(b.out.map((c) => c.title), ['Ван-Пис / Большой куш']);
// the pages are asked one by one, in order
assert.deepStrictEqual(b.asked, ['/a/one-piece-1999.html', '/a/s2.html', '/a/ova.html']);
// no title with the card's id: no match, the list is shown
assert.deepStrictEqual(run(rezkaNear(full, 1999), 'tt0388629', '', { '/a/s2.html': pages['/a/s2.html'] }).out, []);
// two titles with the card's id (an anime's parts): both come back, the caller narrows the list to them
assert.strictEqual(run(rezkaNear(full, 1999), 'tt0388629', '', { '/a/one-piece-1999.html': pages['/a/one-piece-1999.html'], '/a/ova.html': { imdb: 'tt0388629', kp: '' } }).out.length, 2);
// a page that cannot be read (a bot check, an error) is not a match; matching by Kinopoisk id works too
assert.deepStrictEqual(run(rezkaNear(full, 1999), '', '252', pages).out.map((c) => c.link), ['/a/one-piece-1999.html']);
// the second round after the page was seen once: known pages cost no request, the match is still found
const seenIds = Object.assign({}, pages);
const again = [];
rezkaIdMatches(rezkaNear(full, 1999), 'tt0388629', '', (card, got) => { if (seenIds[card.link]) return got(seenIds[card.link]); again.push(card.link); got(null); }, () => true, (m) => again.push(m.map((c) => c.link).join()));
assert.deepStrictEqual(again, ['/a/one-piece-1999.html']);
// a closed screen drops the answer
assert.strictEqual(run(live, 'tt1', '', {}, () => false).out, null);

console.log('rezka-ids OK');

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

console.log('rezka-ids OK');

import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('../plugin/online_mod.js', import.meta.url)), 'utf8');
const from = src.indexOf('    function rezkaPageIds(str) {');
const to = src.indexOf('    var rezkaIds = {};');
assert(from > 0 && to > from, 'rezkaPageIds not found in plugin/online_mod.js');
// the browser's strict atob (Buffer would forgive a stray "/" and hide a broken capture)
const rezkaPageIds = new Function('atob', src.slice(from, to) + '\nreturn rezkaPageIds;')(globalThis.atob);

// the rating links of HDrezka's "Black Clover" page, as served
const page = '<span class="b-post__info_rates imdb"><a href="/help/aHR0cHMlM0ElMkYlMkZ3d3cuaW1kYi5jb20lMkZ0aXRsZSUyRnR0NzQ0MTY1OCUyRg==/" target="_blank" rel="nofollow">IMDb</a></span>'
  + '<span class="b-post__info_rates kp"><a href="/help/aHR0cHMlM0ElMkYlMkZ3d3cua2lub3BvaXNrLnJ1JTJGZmlsbSUyRjEwNDk3MzElMkY=/" target="_blank" rel="nofollow">Кинопоиск</a></span>';
assert.deepStrictEqual(rezkaPageIds(page), { imdb: 'tt7441658', kp: '1049731' });
// no rating links, a broken one: nothing is made up
assert.deepStrictEqual(rezkaPageIds('<div>no ratings</div>'), { imdb: '', kp: '' });
assert.deepStrictEqual(rezkaPageIds('<a href="/help/!!notbase64/">x</a>'), { imdb: '', kp: '' });
assert.deepStrictEqual(rezkaPageIds(null), { imdb: '', kp: '' });
console.log('rezka-ids OK');

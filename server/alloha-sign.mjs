// The signing bits of the Alloha player, kept apart from the server so they can be checked
// against captured output without starting anything.

// The player's browser fingerprint hash, which it puts in front of the Borth signature.
export const YB = 'e25a003f3c581b3202043118d9aa32bbfbfe66857bdae8a4d6d0334092cd99ad';
export const QUALITIES = ['360', '480', '720', '1080', '1440', '2160'];

// app.js YX: reorder chars along the primes-length walk 0,2,4,... then odd ones, then 0.
function isPrime(n) {
  if (n < 2) return false;
  if (n % 2 === 0) return n === 2;
  for (let d = 3; d * d <= n; d += 2) if (n % d === 0) return false;
  return true;
}
function shuffle(s) {
  const n = s.length;
  if (n <= 1) return s;
  let p = Math.max(2, n + 1);
  while (!isPrime(p)) p++;
  const used = new Array(n).fill(false), order = [];
  for (let cur = 0; order.length < n;) {
    cur = (cur + 2) % p;
    if (cur < n && !used[cur]) { order.push(cur); used[cur] = true; }
  }
  const out = new Array(n);
  order.forEach((pos, i) => { out[pos] = s[i]; });
  return out.join('');
}

// app.js YS and Yg: chars are grouped by a bit property of their index and the groups are
// re-stacked, from the bottom group up for YS and from the top group down for Yg.
function weave(s, groupOf, up) {
  const n = s.length;
  if (n <= 1) return s;
  let k = 0;
  while ((1 << k) < n) k++;
  const cnt = new Array(k + 1).fill(0);
  for (let i = 0; i < n; i++) cnt[groupOf(i, k)]++;
  const parts = new Array(k + 1);
  let pos = 0;
  for (let step = 0; step <= k; step++) {
    const g = up ? step : k - step;
    parts[g] = s.slice(pos, pos + cnt[g]);
    pos += cnt[g];
  }
  const idx = new Array(k + 1).fill(0), out = new Array(n);
  for (let i = 0; i < n; i++) { const g = groupOf(i, k); out[i] = parts[g][idx[g]++]; }
  return out.join('');
}
const bitLength = (c) => { let m = 0; while (c > 0) { m++; c >>>= 1; } return m; };
const trailingZeros = (c, k) => { if (c === 0) return k; let m = 0; while (!(c & 1)) { m++; c >>>= 1; } return m; };

export const borthFor = (viewport) => YB + '|' + shuffle(weave(weave(viewport, bitLength, false), trailingZeros, true));

// Each quality is its own CDN url, so the requested one is picked from the list; the edge hash
// that signs it is the same for all of them. An unknown request falls back to the closest
// lower quality, or the lowest one available.
export function pickQuality(qualities, want) {
  const have = QUALITIES.filter((x) => qualities[x]);
  if (!have.length) throw new Error('no qualities');
  const below = have.filter((x) => Number(x) <= Number(want || 0));
  return below.length ? below[below.length - 1] : have[0];
}

// Rewrites every uri in an HLS playlist through `proxy(url, t)`. Segments get `t`, the second
// they start at, so the heartbeat can report a real position; uris without a preceding
// #EXTINF (init map, keys, variants of a master) get none. VOD only: a sliding live window
// would restart at 0 on every refresh.
export function mapPlaylist(text, playlistUrl, proxy) {
  let start = 0, dur = null;
  return text.split('\n').map((line) => {
    const l = line.trim();
    if (!l) return line;
    if (l.startsWith('#EXTINF:')) dur = parseFloat(l.slice(8)) || 0;
    if (l.startsWith('#')) return line.replace(/URI="([^"]+)"/g, (m, u) => `URI="${proxy(new URL(u, playlistUrl).href)}"`);
    const out = proxy(new URL(l, playlistUrl).href, dur == null ? undefined : start);
    if (dur != null) { start += dur; dur = null; }
    return out;
  }).join('\n');
}

// One key per episode: every cache in the server is keyed by it, so two different films must
// never collide. Unknown query params are ignored, the path and id are not.
export function episodeKey(src) {
  try {
    const x = new URL(src);
    const params = ['token_movie', 'token', 'id', 'translation', 'season', 'episode']
      .map((k) => k + '=' + (x.searchParams.get(k) || '')).join('&');
    return x.host + x.pathname + '?' + params;
  } catch { return String(src); }
}

// Pick one of the inner audio tracks of an already-resolved episode by its label. Neither the
// position nor Alloha's audioId is stable: the plugin learns the tracks from one episode, and the
// next one can have a track fewer, which renumbers them ("(English) 10" there is "(English) 9"
// with audioId 9 here, measured). So a trailing number is ignored when the exact label is gone.
// An unknown or missing label falls back to the default track.
// shortcut: two unnamed tracks of one language ("(English) 10" and "(English) 11") can swap after a
// renumber; pick by order among same-bare labels if a voice like that shows up.
// bnsi.skipTime: an intro and a credits slot in seconds ("0-0,1345-1441"), 0-0 when one is missing.
// Returned in TheIntroDB v4 shape, which DDD and the plugin already read from a url.
export function skipsOf(skipTime) {
  const out = { intro: [], credits: [] };
  String(skipTime || '').split(',').slice(0, 2).forEach((part, i) => {
    const [a, b] = part.split('-').map(Number);
    if (a >= 0 && b > a) out[i ? 'credits' : 'intro'].push({ start_ms: a * 1000, end_ms: b * 1000 });
  });
  return out;
}

export const bareLabel = (s) => String(s || '').replace(/\s+\d+$/, '');
export function sourceFor(info, src) {
  const sources = (info && Array.isArray(info.sources)) ? info.sources : [];
  let raw = null;
  try { raw = new URL(src).searchParams.get('audio'); } catch {}
  const hit = raw && (sources.find((x) => x.label === raw) || sources.find((x) => bareLabel(x.label) === bareLabel(raw)));
  return hit || sources.find((x) => x.default) || sources[0];
}
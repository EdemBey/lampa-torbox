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

// The CDN only unlocks the resolution named when the socket session starts, so an unknown
// request falls back to the closest lower quality, or the lowest one available.
export function pickQuality(qualities, want) {
  const have = QUALITIES.filter((x) => qualities[x]);
  if (!have.length) throw new Error('no qualities');
  const below = have.filter((x) => Number(x) <= Number(want || 0));
  return below.length ? below[below.length - 1] : have[0];
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
import assert from 'node:assert/strict';
import test from 'node:test';
import { borthFor, episodeKey, mapPlaylist, YB, pickQuality, sourceFor } from './alloha-sign.mjs';

test('Borth matches the player byte for byte', () => {
  // Captured from a live player page together with the Borth it sent.
  const viewport = 'GrQENotW5DxG1cVJ52p1B1LlmVkUT2W2GGXc1tMw1tUhZtl68w3HRyWqaaZdWGWk2TTTX30HceQVVWVcNMOaMMNW';
  const signed = 'cGlWWW16NkQ1M2t8MTc5NTMwMTE5OXw3a3pDc01HeHNLQmtRVVVxVkUyWUo2VThWc21GaWZqa2tBZGtGdGJ1WXlr';
  assert.equal(borthFor(viewport), YB + '|' + signed);
});

test('the signature is a permutation of the viewport, at any length', () => {
  for (const viewport of ['a', 'abc', 'GrQENotW5DxG1cVJ52p1B1LlmVkUT2W2GGXc1tMw1tUhZtl68w3HRyWqaaZdWGWk2TTTX30HceQVVWVcNMOaMMNW', 'x'.repeat(64)]) {
    const signed = borthFor(viewport).slice(YB.length + 1);
    assert.equal(signed.length, viewport.length);
    assert.deepEqual([...signed].sort(), [...viewport].sort());
  }
});

test('pickQuality never asks for a resolution the stream lacks', () => {
  const have = { 360: 'a', 720: 'b' };
  assert.equal(pickQuality(have, '1080'), '720');
  assert.equal(pickQuality(have, '500'), '360');
  assert.equal(pickQuality(have, '360'), '360');
  assert.equal(pickQuality(have, '240'), '360');
  assert.equal(pickQuality(have, undefined), '360');
  // A stream that only starts at 720 still plays when the default asks for less.
  assert.equal(pickQuality({ 720: 'b' }, '360'), '720');
  assert.throws(() => pickQuality({}, '1080'), /no qualities/);
});

test('episodeKey separates films but ignores cache-busting params', () => {
  const a = 'https://lutheran-as.stravers.live/?token_movie=aaa&token=t&translation=197&season=1&episode=4';
  const b = 'https://lutheran-as.stravers.live/?token_movie=aaa&token=t&translation=197&season=1&episode=5';
  const c = 'https://lutheran-as.stravers.live/?token_movie=bbb&token=t&translation=197&season=1&episode=4';
  const junk = a + '&x=1';
  assert.notEqual(episodeKey(a), episodeKey(b));
  assert.notEqual(episodeKey(a), episodeKey(c));
  assert.equal(episodeKey(a), episodeKey(junk));
  assert.notEqual(episodeKey('https://x.live/embed?id=1'), episodeKey('https://x.live/embed?id=2'));
});
test('mapPlaylist stamps each segment with its start time and nothing else', () => {
  const seen = [];
  const pl = [
    '#EXTM3U',
    '#EXT-X-MAP:URI="init.mp4"',
    '#EXTINF:6.0,', 'seg-1.m4s',
    '#EXTINF:4.0,', 'seg-2.m4s',
    '#EXT-X-DISCONTINUITY',
    '#EXTINF:6.0,', 'seg-3.m4s',
    'stray.m4s',
    '#EXT-X-ENDLIST',
  ].join('\n');
  mapPlaylist(pl, 'https://cdn.example/0/x/index.m3u8', (url, t) => { seen.push([url.split('/').pop(), t]); return url; });
  assert.deepEqual(seen, [['init.mp4', undefined], ['seg-1.m4s', 0], ['seg-2.m4s', 6], ['seg-3.m4s', 10], ['stray.m4s', undefined]]);
});

test('mapPlaylist gives the variants of a master playlist no position', () => {
  const seen = [];
  mapPlaylist('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\nindex-1.m3u8', 'https://cdn.example/0/x/master.m3u8', (url, t) => { seen.push(t); return url; });
  assert.deepEqual(seen, [undefined]);
});

test('sourceFor picks the audio track by audioId and falls back to the default', () => {
  const info = { sources: [
    { label: 'first', audioId: '3', default: false, qualities: { 360: 'a' } },
    { label: 'default', audioId: '1', default: true, qualities: { 360: 'b' } },
  ] };
  assert.equal(sourceFor(info, 'https://x.live/embed?audio=3'), info.sources[0]);
  assert.equal(sourceFor(info, 'https://x.live/embed?audio=1'), info.sources[1]);
  assert.equal(sourceFor(info, 'https://x.live/embed'), info.sources[1]);
  assert.equal(sourceFor(info, 'https://x.live/embed?audio='), info.sources[1]);
  assert.equal(sourceFor(info, 'https://x.live/embed?audio=5'), info.sources[1]);
  assert.equal(sourceFor(info, 'not a url?audio=3'), info.sources[1]);
  assert.equal(sourceFor({ sources: [{ audioId: null, qualities: {} }] }, 'https://x.live/embed').audioId, null);
});

import assert from 'node:assert';
import { read, slice } from './_slice.mjs';

const parse = new Function(slice(read('torbox-lampa-plugin.js'), 'release-tags') + '\nreturn parseReleaseTags;')();

// Rutracker-style title
let r = parse('Дюна: Часть вторая / Dune: Part Two (2024) WEB-DL 2160p HDR10+ | Dub + Original (Eng) + Sub (Rus, Eng) | DD+ 5.1');
assert.deepStrictEqual(r.audio, ['EN', 'RU']);
assert.deepStrictEqual(r.subs, ['RU', 'EN']);
assert.deepStrictEqual(r.voice, ['Дубляж', 'Original']);
assert.strictEqual(r.res, '4K');
assert.deepStrictEqual(r.hdr, ['HDR10+']);
assert.strictEqual(r.source, 'WEB-DL');
assert.deepStrictEqual(r.sound, ['DD+', '5.1']);

// Torrentio: flags, multi line
r = parse('Dune.Part.Two.2024.2160p.UHD.BluRay.REMUX.DV.HDR.HEVC.TrueHD.Atmos.7.1-FGT\n👤 120 💾 70.2 GB ⚙️ TorrentGalaxy\nMulti Audio / 🇬🇧 / 🇷🇺 / 🇺🇦');
assert.deepStrictEqual(r.audio, ['EN', 'RU', 'UK', 'MULTI']);
assert.deepStrictEqual(r.hdr, ['DV', 'HDR']);
assert.strictEqual(r.codec, 'HEVC');
assert.strictEqual(r.source, 'Remux');
assert.deepStrictEqual(r.sound, ['Atmos', 'TrueHD', '7.1']);
assert.deepStrictEqual(r.subs, []);

// MVO without a language means Russian; 10bit, x265
r = parse('Сёгун / Shogun [S01] (2024) WEBRip 1080p x265 10bit | MVO (LostFilm)');
assert.deepStrictEqual(r.audio, ['RU']);
assert.deepStrictEqual(r.voice, ['MVO']);
assert.strictEqual(r.res, '1080p');
assert.strictEqual(r.codec, 'HEVC');
assert(r.bit10);
assert.strictEqual(r.source, 'WEBRip');

// ffprobe wins and fills what the title lacks
r = parse('Some Movie 2020', {
  info: { voices: ['HDRezka', 'LostFilm'] },
  ffprobe: [
    { codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080 },
    { codec_type: 'audio', codec_name: 'ac3', channels: 6, tags: { language: 'rus' } },
    { codec_type: 'audio', codec_name: 'eac3', channels: 6, tags: { language: 'eng' } },
    { codec_type: 'subtitle', tags: { language: 'rus' } },
    { codec_type: 'subtitle', tags: { language: 'und' } },
  ],
});
assert.deepStrictEqual(r.audio, ['RU', 'EN']);
assert.deepStrictEqual(r.subs, ['RU']);
assert.deepStrictEqual(r.sound, ['DD', 'DD+', '5.1']);
assert.strictEqual(r.res, '1080p');
assert.strictEqual(r.codec, 'AVC');
assert.deepStrictEqual(r.studios, ['HDRezka', 'LostFilm']);

// Plain words are not languages or sources
r = parse('Trust.No.One.2019.720p');
assert.deepStrictEqual(r.audio, []);
assert.strictEqual(r.source, '');
assert.deepStrictEqual(r.sound, []);

console.log('torbox-tags ok');
assert.deepStrictEqual(parse('Film 1080p 👤 5 💾 5.1 GB').sound, []);

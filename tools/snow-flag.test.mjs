import assert from 'node:assert';
import { read, slice } from './_slice.mjs';

// Yes/no items of snow and garland are Lampa triggers ('true'/'false', read back as boolean); the old select items stored 0/1.
// Table: stored value (as Lampa.Storage.get returns it) -> flag, for a default of 1 and of 0.
for (const [file, mod] of [['snow.js', 'snow-flag'], ['garland.js', 'garland-flag']]) {
  const src = read(file);
  const code = slice(src, mod) + '\nreturn { num, flagOf };';
  const { flagOf } = new Function(src.match(/function num\(v, def\) \{[^}]*\}/)[0] + '\n' + code)();
  const rows = [
    // [stored, def 1, def 0]
    [1, 1, 1], [0, 0, 0], ['1', 1, 1], ['0', 0, 0],          // old select values
    [true, 1, 1], [false, 0, 0], ['true', 1, 1], ['false', 0, 0], // trigger values
    ['', 0, 0],                                              // missing key with default 0 (Storage.get returns '')
  ];
  for (const [v, d1, d0] of rows) {
    if (v !== '') assert.strictEqual(flagOf(v, 1), d1, file + ' ' + JSON.stringify(v) + ' def 1');
    assert.strictEqual(flagOf(v, 0), v === '' ? 0 : d0, file + ' ' + JSON.stringify(v) + ' def 0');
  }
  assert.strictEqual(flagOf(1, 0), 1); assert.strictEqual(flagOf(undefined, 1), 1); // default passes through
  // no code reads a yes/no key without flag()
  assert(!/num\(storageGet\(KEY_(ENABLED|SETTLE|SHAKE|IN_CARD),/.test(src), file + ': raw read of a trigger key');
}
console.log('snow-flag: ok');

// Test helper (not a test: CI runs tools/*.test.mjs only). A plugin's code between its
// `// @module <name>` and `// @end <name>` comment lines, wherever they are indented.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function read(file) {
  return readFileSync(fileURLToPath(new URL('../plugin/' + file, import.meta.url)), 'utf8');
}

export function slice(src, name) {
  const find = (word) => {
    const re = new RegExp('^[ \\t]*// @' + word + ' ' + name + '[ \\t]*$', 'gm');
    const hits = [];
    for (let m; (m = re.exec(src));) hits.push(m.index);
    assert.strictEqual(hits.length, 1, '// @' + word + ' ' + name + ': found ' + hits.length + ' times, need exactly 1');
    return hits[0];
  };
  const from = find('module');
  const to = find('end');
  assert(to > from, '// @end ' + name + ' stands before // @module ' + name);
  return src.slice(from, to);
}

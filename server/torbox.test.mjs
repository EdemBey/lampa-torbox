import assert from 'node:assert';
import { targetFor } from './torbox.mjs';

assert.equal(targetFor('/torbox/torrents/mylist'), 'https://api.torbox.app/v1/api/torrents/mylist');
assert.equal(
  targetFor('/torbox/torrents/requestdl', '?torrent_id=1&file_id=2&token=abc'),
  'https://api.torbox.app/v1/api/torrents/requestdl?torrent_id=1&file_id=2&token=abc'
);
console.log('torbox ok OK');

assert.equal(targetFor('/torbox/../x'), null);
assert.equal(targetFor('/torbox//evil.com'), null);
assert.equal(targetFor('/torbox/@evil.com'), null);
assert.equal(targetFor('/torbox/%2e%2e/x'), null);
assert.equal(targetFor('/torbox/torrents\\..\\x'), null);
assert.equal(targetFor('/torbox/https://evil.com/'), null);
assert.equal(targetFor('/torbox/'), null);
assert.equal(targetFor('/other/torrents/mylist'), null);
assert.equal(targetFor('/torbox/torrents/mylist', '#x'), null);
console.log('torbox null OK');

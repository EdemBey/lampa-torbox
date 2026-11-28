import assert from 'node:assert';
// No curl at this path, so signing fails at once, the way a refused renewal does.
process.env.CURL_IMPERSONATE = '/nonexistent/curl-impersonate';
const { recoverOnce } = await import('./alloha.mjs');

const s = { info: { src: 'https://x.stravers.live/e/1', origin: 'https://x.stravers.live', id: '1' } };
// A failed recovery must reject, or the caller's backoff between tries never runs.
await assert.rejects(recoverOnce('k', s));
// ...and it must not start the quiet window: the next try signs again instead of passing as recovered.
await assert.rejects(recoverOnce('k', s));
console.log('alloha ok');
// The file's housekeeping timer would keep the test process alive.
process.exit(0);

// A recovery that fails must reject, so cdnFetch backs off instead of re-signing at once.
import assert from 'node:assert';
process.env.CURL_IMPERSONATE = '/nonexistent/curl';
const { recoverOnce } = await import('./alloha.mjs');
const s = { info: { src: 'https://x.stravers.live/', origin: 'https://x.stravers.live', id: '1' } };
await assert.rejects(recoverOnce('k', s));
console.log('alloha-recover: ok');

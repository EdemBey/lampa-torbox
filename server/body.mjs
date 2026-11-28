// Request body as a Buffer, or null once it passes the limit. for await throws when the client
// drops the connection mid-upload, so a handler never waits for an 'end' that will not come.
export async function readBody(req, limit = 65536) {
  const chunks = [];
  let n = 0;
  for await (const c of req) {
    if ((n += c.length) > limit) return null;
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

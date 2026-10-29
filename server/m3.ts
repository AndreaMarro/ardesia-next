import type {IncomingMessage, ServerResponse} from 'node:http';
import {Readable} from 'node:stream';
import {fileURLToPath} from 'node:url';
import {createApiHandler, createFirstPartyPolicy, createPostgresStore} from '@ardesia/server';

const origin = process.env.ARDESIA_APP_ORIGIN
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://127.0.0.1:4173');
const connection = process.env.ARDESIA_DATABASE_URL;
const store = connection ? createPostgresStore({
  connectionString: connection,
  pluginPolicy: createFirstPartyPolicy({artifactRoot: fileURLToPath(new URL('./public/', import.meta.url))}),
}) : null;
const handle = createApiHandler({store, allowedOrigins: [origin], secureCookies: true});

/** Vercel's Node launcher receives native HTTP objects; all application policy stays in the Web handler. */
export default async function handler(incoming: IncomingMessage, outgoing: ServerResponse): Promise<void> {
  try {
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers)) {
      if (Array.isArray(value)) for (const entry of value) headers.append(name, entry);
      else if (value !== undefined) headers.set(name, value);
    }
    const method = incoming.method ?? 'GET';
    const init: RequestInit & {duplex?: 'half'} = {method, headers};
    if (method !== 'GET' && method !== 'HEAD') {
      init.body = Readable.toWeb(incoming) as ReadableStream<Uint8Array>;
      init.duplex = 'half';
    }
    const response = await handle(new Request(new URL(incoming.url ?? '/api/m3', origin), init));
    outgoing.statusCode = response.status;
    for (const [name, value] of response.headers) if (name !== 'set-cookie') outgoing.setHeader(name, value);
    const cookies = response.headers.getSetCookie();
    if (cookies.length) outgoing.setHeader('Set-Cookie', cookies);
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    // Adapter failures must not disclose request bodies, credentials or driver errors.
    outgoing.statusCode = 503;
    outgoing.setHeader('Content-Type', 'application/json; charset=utf-8');
    outgoing.setHeader('Cache-Control', 'no-store, private');
    outgoing.end(JSON.stringify({ok: false, error: {code: 'SERVICE_UNAVAILABLE', message: 'The remote service is temporarily unavailable.'}}));
  }
}

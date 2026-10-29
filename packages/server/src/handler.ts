import {CoreError} from '@ardesia/contracts';
import {ServerError} from './errors';
import {RequestSchema} from './requests';
import type {PostgresStore} from './store';

export interface ApiHandlerOptions {
  /** Null means explicitly unavailable. There is no local substitute for confirmed server data. */
  store: PostgresStore | null;
  allowedOrigins: readonly string[];
  /** False is accepted only for loopback development origins. */
  secureCookies?: boolean;
}
const LIMIT_BYTES = 4 * 1024 * 1024;

function failure(error: unknown): {status: number; code: string; message: string} {
  if (error instanceof ServerError) return {status: error.status, code: error.code, message: error.message};
  if (error instanceof CoreError) return {
    status: error.code === 'NOT_FOUND' ? 404 : error.code === 'FORBIDDEN' ? 403
      : ['REVISION_CONFLICT', 'IDEMPOTENCY_CONFLICT', 'ALREADY_EXISTS'].includes(error.code) ? 409
      : error.code === 'STORAGE_FAILURE' ? 503 : 422,
    code: error.code, message: error.message,
  };
  // Do not serialize SQL text, DSNs, stack traces, password hashes, or driver errors.
  return {status: 503, code: 'SERVICE_UNAVAILABLE', message: 'The remote service is temporarily unavailable. Confirmed data has not been replaced by a local copy.'};
}

function tokenFrom(request: Request, name: string): string | undefined {
  const cookies = (request.headers.get('cookie') ?? '').split(';').map(value => value.trim());
  const matches = cookies.filter(value => value.startsWith(name + '='));
  if (matches.length !== 1) return undefined;
  const token = matches[0]!.slice(name.length + 1);
  return /^[0-9a-f]{64}$/.test(token) ? token : undefined;
}

async function readBody(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
    throw new ServerError('UNSUPPORTED_MEDIA_TYPE', 'Send application/json.', 415);
  }
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > LIMIT_BYTES)) throw new ServerError('REQUEST_TOO_LARGE', 'The request is too large. Your source data remains on this device.', 413);
  if (!request.body) throw new ServerError('INVALID_REQUEST', 'A JSON command is required.');
  const reader = request.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const {done, value} = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > LIMIT_BYTES) { await reader.cancel(); throw new ServerError('REQUEST_TOO_LARGE', 'The request is too large. Your source data remains on this device.', 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.length;}
  try { return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes)) as unknown; }
  catch { throw new ServerError('INVALID_REQUEST', 'The request is not valid JSON.'); }
}

/** Web-standard handler usable by Vercel and a Node development adapter. */
export function createApiHandler(options: ApiHandlerOptions): (request: Request) => Promise<Response> {
  const origins = new Set(options.allowedOrigins.map(value => {
    const url = new URL(value);
    if (url.origin !== value || !['https:', 'http:'].includes(url.protocol)) throw new Error('Configure exact HTTP(S) origins without paths.');
    return value;
  }));
  if (!origins.size) throw new Error('At least one explicit origin is required.');
  const secure = options.secureCookies !== false;
  if (!secure && [...origins].some(value => !['localhost', '127.0.0.1', '[::1]'].includes(new URL(value).hostname))) {
    throw new Error('Non-secure session cookies are limited to loopback development.');
  }
  const cookieName = secure ? '__Host-ardesia_session' : 'ardesia_dev_session';
  function cookie(token: string, seconds: number) {
    return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${seconds}${secure ? '; Secure' : ''}`;
  }
  function response(status: number, body: unknown, setCookie?: string) {
    const headers = new Headers({'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, private',
      'Pragma': 'no-cache', 'Vary': 'Cookie, Origin', 'X-Content-Type-Options': 'nosniff'});
    if (setCookie) headers.set('Set-Cookie', setCookie);
    return new Response(JSON.stringify(body), {status, headers});
  }
  return async request => {
    try {
      if (request.method === 'GET') {
        if (!options.store) return response(503, {ok: true, result: {configured: false, authority: 'unavailable'}});
        return response(200, {ok: true, result: await options.store.health()});
      }
      if (request.method !== 'POST') throw new ServerError('METHOD_NOT_ALLOWED', 'Use GET for health or POST for application commands.', 405);
      const origin = request.headers.get('origin');
      if (!origin || !origins.has(origin)) throw new ServerError('ORIGIN_REJECTED', 'This request did not originate from the application.', 403);
      if (request.headers.get('sec-fetch-site') === 'cross-site') throw new ServerError('ORIGIN_REJECTED', 'Cross-site requests are not allowed.', 403);
      const parsed = RequestSchema.safeParse(await readBody(request));
      if (!parsed.success) throw new ServerError('INVALID_REQUEST', 'The request fields do not satisfy the API contract.');
      if (!options.store) throw new ServerError('SERVICE_UNAVAILABLE', 'A dedicated remote database is not configured. Local snapshots remain available for export.', 503);
      const token = tokenFrom(request, cookieName);
      if (parsed.data.action === 'login') {
        const session = await options.store.login(parsed.data, token);
        return response(200, {ok: true, result: {account: session.account, expiresAt: session.expiresAt}}, cookie(session.token, options.store.sessionLifetimeSeconds));
      }
      const expectedAccountId = request.headers.get('x-ardesia-account') ?? undefined;
      const result = await options.store.execute(token, expectedAccountId, parsed.data);
      return response(200, {ok: true, result}, parsed.data.action === 'logout' ? cookie('', 0) : undefined);
    } catch (error) {
      const problem = failure(error);
      return response(problem.status, {ok: false, error: {code: problem.code, message: problem.message}},
        problem.code === 'UNAUTHENTICATED' ? cookie('', 0) : undefined);
    }
  };
}

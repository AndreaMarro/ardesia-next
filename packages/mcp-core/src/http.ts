import {request as httpRequest} from 'node:http';
import {request as httpsRequest} from 'node:https';
import {AdapterError, fail, OriginSchema} from './config';

export const MAX_REQUEST_BYTES = 4 * 1024 * 1024;
export const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
export const DEADLINE_MS = 15_000;
const safeCodes = new Set(['UNAUTHENTICATED', 'SESSION_CHANGED', 'FORBIDDEN', 'NOT_FOUND', 'REVISION_CONFLICT',
  'IDEMPOTENCY_CONFLICT', 'ALREADY_EXISTS', 'INVALID_COMMAND', 'INVALID_REFERENCE', 'INVALID_STATE',
  'INVALID_REQUEST', 'REQUEST_TOO_LARGE', 'STORAGE_FAILURE', 'SERVICE_UNAVAILABLE', 'PLUGIN_UNAVAILABLE']);
export const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** Direct Node transport: no environment proxy, redirect, URL tool parameter or network fallback. */
export async function post(originInput: string, body: unknown, auth?: {accountId: string; sessionToken: string},
  signal?: AbortSignal): Promise<{result: unknown; cookie?: string}> {
  const parsed = OriginSchema.safeParse(originInput); if (!parsed.success) return fail('CONFIGURATION_INVALID');
  const origin = parsed.data, url = new URL(origin + '/api/m3'), bytes = Buffer.from(JSON.stringify(body));
  if (bytes.length > MAX_REQUEST_BYTES) return fail('REQUEST_TOO_LARGE');
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, {once: true});
  if (signal?.aborted) abort();
  let timedOut = false;
  const timer = setTimeout(() => {timedOut = true; controller.abort();}, DEADLINE_MS);
  try {
    return await new Promise((resolve, reject) => {
      const refuse = (code: string) => reject(new AdapterError(code));
      const cookieName = url.protocol === 'https:' ? '__Host-ardesia_session' : 'ardesia_dev_session';
      const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)({
        protocol: url.protocol, hostname: url.hostname === 'localhost' ? '127.0.0.1' : url.hostname.replace(/^\[|\]$/g, ''),
        port: url.port || undefined, path: '/api/m3', method: 'POST', agent: false, signal: controller.signal,
        ...(url.protocol === 'https:' ? {rejectUnauthorized: true, servername: url.hostname} : {}),
        headers: {Host: url.host, Origin: origin, 'Content-Type': 'application/json', Accept: 'application/json',
          'Content-Length': bytes.length, ...(auth ? {'X-Ardesia-Account': auth.accountId, Cookie: `${cookieName}=${auth.sessionToken}`} : {})},
      }, response => {
        const rejectResponse = (code: string) => {refuse(code); response.destroy();};
        if ((response.statusCode ?? 0) >= 300 && (response.statusCode ?? 0) < 400) return rejectResponse('REDIRECT_REJECTED');
        if (response.headers['content-type']?.split(';')[0]?.trim().toLowerCase() !== 'application/json'
          || response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity') return rejectResponse('INVALID_RESPONSE');
        const length = response.headers['content-length'];
        if (length && (!/^\d+$/.test(length) || Number(length) > MAX_RESPONSE_BYTES)) return rejectResponse('RESPONSE_TOO_LARGE');
        const chunks: Buffer[] = []; let size = 0;
        response.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_RESPONSE_BYTES) rejectResponse('RESPONSE_TOO_LARGE'); else chunks.push(chunk);
        });
        response.on('error', () => refuse('NETWORK_UNCERTAIN'));
        response.on('end', () => {
          try {
            const value: unknown = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(Buffer.concat(chunks)));
            if (!record(value)) return refuse('INVALID_RESPONSE');
            if (response.statusCode !== 200 || value.ok !== true) {
              const code = record(value.error) && typeof value.error.code === 'string' ? value.error.code : '';
              return refuse(safeCodes.has(code) ? code : 'UPSTREAM_REJECTED');
            }
            if (!('result' in value)) return refuse('INVALID_RESPONSE');
            resolve({result: value.result, cookie: response.headers['set-cookie']?.find(cookie => cookie.startsWith(cookieName + '='))});
          } catch {refuse('INVALID_RESPONSE');}
        });
      });
      request.on('error', () => refuse(controller.signal.aborted ? timedOut ? 'DEADLINE_EXCEEDED' : 'CANCELLED' : 'NETWORK_UNCERTAIN'));
      request.end(bytes);
    });
  } finally {clearTimeout(timer); signal?.removeEventListener('abort', abort);}
}

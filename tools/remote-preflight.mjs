import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {resolveE2ETarget} from '../e2e/target.ts';
import {identity} from './evidence.mjs';

export const preflightPath = 'artifacts/remote-continuity/preflight.json';
const header = 'x-vercel-trusted-oidc-idp-token';
const maxBytes = 64 * 1024;
const redirectStatuses = new Set([301, 302, 303, 307, 308]);
const plainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

class PreflightFailure extends Error {
  constructor(code) {super(code); this.name = 'PreflightFailure'; this.code = code;}
}
const reject = code => {throw new PreflightFailure(code);};

/** Validate before any network access; values are never included in an error. */
export function preflightConfiguration(env, expected) {
  const target = resolveE2ETarget(env);
  if (target.mode !== 'remote') reject('REMOTE_MODE_REQUIRED');
  if (!plainObject(expected) || !/^[a-f0-9]{40}$/.test(expected.commit ?? '')
    || !/^[a-f0-9]{64}$/.test(expected.sourceDigest ?? '')) reject('VERIFIED_SOURCE_IDENTITY_REQUIRED');
  const token = env.VERCEL_OIDC_TOKEN;
  if (typeof token !== 'string' || token.length < 20 || token.length > 16384 || /[^\x21-\x7e]/.test(token)) {
    reject('AUTHORIZED_VERCEL_OIDC_REQUIRED');
  }
  if (env.NODE_DEBUG) reject('NODE_DEBUG_FORBIDDEN_FOR_REMOTE_ACCESS');
  return {origin: target.origin, expected: {commit: expected.commit, sourceDigest: expected.sourceDigest}, token};
}

async function jsonBody(response) {
  const [mediaType, ...parameters] = (response.headers.get('content-type') ?? '').toLowerCase().split(';').map(part => part.trim());
  if (mediaType !== 'application/json' || parameters.length > 1
    || parameters.some(parameter => !/^charset=(?:utf-8|"utf-8")$/.test(parameter))) {
    await response.body?.cancel(); reject('JSON_RESPONSE_REQUIRED');
  }
  const length = response.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) {
    await response.body?.cancel(); reject('RESPONSE_TOO_LARGE');
  }
  if (!response.body) reject('JSON_RESPONSE_REQUIRED');
  const reader = response.body.getReader(), chunks = [];
  let size = 0;
  for (;;) {
    const {done, value} = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {await reader.cancel(); reject('RESPONSE_TOO_LARGE');}
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.byteLength;}
  try {return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes));}
  catch {reject('INVALID_JSON_RESPONSE');}
}

function protectedAnonymous(response, origin) {
  if (response.status === 401 || response.status === 403) return {status: response.status};
  if (!redirectStatuses.has(response.status)) reject('ANONYMOUS_ACCESS_NOT_PROTECTED');
  let location, destination;
  try {
    location = new URL(response.headers.get('location'));
    destination = new URL(location.searchParams.get('url'));
  } catch {reject('UNEXPECTED_PROTECTION_REDIRECT');}
  if (location.origin !== 'https://vercel.com' || location.pathname !== '/sso-api'
    || location.username || location.password || location.hash
    || location.searchParams.getAll('url').length !== 1
    || destination.origin !== origin || destination.username || destination.password
    || destination.pathname !== '/' || destination.search || destination.hash) reject('UNEXPECTED_PROTECTION_REDIRECT');
  // Nonces and complete redirect URLs are intentionally never persisted.
  return {status: response.status, redirectOrigin: location.origin, redirectPath: location.pathname,
    redirectTargetOrigin: destination.origin};
}

/** Read-only deployment checks. This report is not an M3 acceptance producer. */
export async function runRemotePreflight({env = process.env, expected, fetchImpl = globalThis.fetch, timeoutMs = 15000}) {
  const config = preflightConfiguration(env, expected);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) reject('INVALID_REQUEST_TIMEOUT');
  const report = {kind: 'ardesia-remote-preflight', origin: config.origin, expected: config.expected,
    startedAt: new Date().toISOString(), completedAt: null, passed: false,
    buildIdentityMatched: false, deploymentIdentityVerified: false,
    observedBuild: null, checks: [], failureCode: null, m3Acceptance: 'NOT_EVALUATED'};
  let currentCheck = 'anonymousProtection';
  // Credentials are attached only to exact-origin requests; fetch never follows a redirect.
  async function request(path, authorized, method = 'GET', requestOrigin) {
    if (!['/', '/build-info.json', '/api/m3'].includes(path)) reject('UNEXPECTED_REQUEST_PATH');
    const url = new URL(path, config.origin);
    if (url.origin !== config.origin) reject('UNEXPECTED_REQUEST_ORIGIN');
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url.href, {method, redirect: 'manual', credentials: 'omit', cache: 'no-store',
        signal: controller.signal, headers: {Accept: 'application/json',
          ...(authorized ? {[header]: config.token} : {}),
          ...(method === 'POST' ? {'Content-Type': 'application/json', Origin: requestOrigin} : {})},
        ...(method === 'POST' ? {body: JSON.stringify({action: 'session'})} : {})});
      if (response.redirected || (response.url && response.url !== url.href)) {
        await response.body?.cancel(); reject('UNEXPECTED_RESPONSE_ORIGIN');
      }
      if (!authorized) {
        try {return {status: response.status, observation: protectedAnonymous(response, config.origin)};}
        finally {await response.body?.cancel();}
      }
      if (redirectStatuses.has(response.status)) {await response.body?.cancel(); reject('AUTHENTICATED_REDIRECT_REJECTED');}
      return {status: response.status, body: await jsonBody(response)};
    } catch (error) {
      if (error instanceof PreflightFailure) throw error;
      reject(controller.signal.aborted ? 'REQUEST_TIMEOUT' : 'REQUEST_FAILED');
    } finally {clearTimeout(timer);}
  }
  const recorded = (name, result) => report.checks.push({name, passed: true, ...result});
  try {
    const anonymous = await request('/', false);
    recorded(currentCheck, anonymous.observation);

    currentCheck = 'buildIdentity';
    const built = await request('/build-info.json', true), b = built.body;
    if (built.status !== 200 || !plainObject(b) || b.application !== 'ardesia-next' || b.milestone !== 'M3'
      || b.persistence !== 'remote-postgres-required' || b.thirdPartyExecution !== false
      || !/^[a-f0-9]{40}$/.test(b.commit ?? '') || !/^[a-f0-9]{64}$/.test(b.sourceDigest ?? '')) reject('INVALID_BUILD_IDENTITY');
    report.observedBuild = {commit: b.commit, sourceDigest: b.sourceDigest, application: b.application, milestone: b.milestone};
    if (b.commit !== config.expected.commit || b.sourceDigest !== config.expected.sourceDigest) reject('BUILD_IDENTITY_MISMATCH');
    report.buildIdentityMatched = true;
    recorded(currentCheck, {status: built.status});

    currentCheck = 'postgresHealth';
    const health = await request('/api/m3', true);
    if (health.status !== 200 || health.body?.ok !== true || health.body.result?.configured !== true
      || health.body.result?.authority !== 'postgres') reject('POSTGRES_HEALTH_FAILED');
    recorded(currentCheck, {status: health.status, configured: true, authority: 'postgres'});

    currentCheck = 'applicationSessionRequired';
    const session = await request('/api/m3', true, 'POST', config.origin);
    if (session.status !== 401 || session.body?.ok !== false || session.body.error?.code !== 'UNAUTHENTICATED') reject('APPLICATION_SESSION_CHECK_FAILED');
    recorded(currentCheck, {status: session.status, code: 'UNAUTHENTICATED'});

    currentCheck = 'foreignOriginRejected';
    const foreign = await request('/api/m3', true, 'POST', 'https://invalid-origin.example');
    if (foreign.status !== 403 || foreign.body?.ok !== false || foreign.body.error?.code !== 'ORIGIN_REJECTED') reject('ORIGIN_CHECK_FAILED');
    recorded(currentCheck, {status: foreign.status, code: 'ORIGIN_REJECTED'});
    currentCheck = 'buildIdentityRecheck';
    const recheck = await request('/build-info.json', true);
    if (recheck.status !== 200 || recheck.body?.commit !== config.expected.commit
      || recheck.body?.sourceDigest !== config.expected.sourceDigest || recheck.body?.application !== 'ardesia-next') reject('BUILD_IDENTITY_CHANGED');
    recorded(currentCheck, {status: recheck.status});
    report.passed = true;
  } catch (error) {
    report.failureCode = error instanceof PreflightFailure ? error.code : 'PREFLIGHT_FAILED';
    report.checks.push({name: currentCheck, passed: false, code: report.failureCode});
  }
  report.completedAt = new Date().toISOString();
  return report;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    const report = await runRemotePreflight({expected: identity()});
    mkdirSync(dirname(preflightPath), {recursive: true});
    writeFileSync(preflightPath, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
    console.log(report.passed ? 'Remote preflight passed; M3 acceptance is not evaluated.' : `Remote preflight failed: ${report.failureCode}.`);
    process.exitCode = report.passed ? 0 : 1;
  } catch (error) {
    console.error(error instanceof PreflightFailure ? error.code : 'Remote preflight configuration is invalid.');
    process.exitCode = 1;
  }
}

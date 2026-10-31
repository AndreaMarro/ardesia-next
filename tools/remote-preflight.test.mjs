import test from 'node:test';
import assert from 'node:assert/strict';
import {preflightConfiguration, runRemotePreflight} from './remote-preflight.mjs';

const origin = 'https://ardesia-next-staging.vercel.app';
const expected = {commit: 'a'.repeat(40), sourceDigest: 'b'.repeat(64)};
const token = 'private-platform-token-fixture-never-log';
const env = {ARDESIA_E2E_MODE: 'remote', ARDESIA_E2E_BASE_URL: origin, VERCEL_OIDC_TOKEN: token};
const build = {...expected, application: 'ardesia-next', milestone: 'M3', persistence: 'remote-postgres-required', thirdPartyExecution: false};
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json; charset=utf-8', ...headers}});
const responses = () => [
  new Response(null, {status: 302, headers: {Location: `https://vercel.com/sso-api?url=${encodeURIComponent(origin + '/')}&nonce=private-nonce-fixture`}}),
  json(build), json({ok: true, result: {configured: true, authority: 'postgres'}}),
  json({ok: false, error: {code: 'UNAUTHENTICATED'}}, 401),
  json({ok: false, error: {code: 'ORIGIN_REJECTED'}}, 403),
  json(build),
];
async function run(sequence = responses()) {
  const requests = [];
  const report = await runRemotePreflight({env, expected, fetchImpl: async (url, options) => {
    requests.push({url, options});
    const response = sequence[requests.length - 1];
    if (response instanceof Error) throw response;
    assert.ok(response, 'the preflight must stop before any additional operation');
    return response;
  }});
  return {report, requests};
}

test('remote preflight validates exact target, identity and short-lived access before any request', async () => {
  for (const change of [{VERCEL_OIDC_TOKEN: undefined}, {VERCEL_OIDC_TOKEN: 'secret\nheader'},
    {ARDESIA_E2E_MODE: 'local'}, {ARDESIA_E2E_BASE_URL: 'https://ardesia-next.vercel.app'}, {NODE_DEBUG: 'http'}]) {
    let calls = 0;
    await assert.rejects(runRemotePreflight({env: {...env, ...change}, expected, fetchImpl: async () => {calls++; throw Error('must not run');}}));
    assert.equal(calls, 0);
  }
  assert.throws(() => preflightConfiguration(env, {...expected, commit: 'local-uncommitted'}));
  assert.throws(() => preflightConfiguration(env, {...expected, sourceDigest: 'not-a-digest'}));
});

test('remote preflight performs only protected read checks with no redirects, cookies or application passwords', async () => {
  const {report, requests} = await run();
  assert.equal(report.passed, true);
  assert.equal(report.buildIdentityMatched, true);
  assert.equal(report.deploymentIdentityVerified, false);
  assert.equal(report.m3Acceptance, 'NOT_EVALUATED');
  assert.equal(report.checks.length, 6);
  assert.deepEqual(report.observedBuild, {...expected, application: 'ardesia-next', milestone: 'M3'});
  assert.deepEqual(requests.map(item => new URL(item.url).pathname), ['/', '/build-info.json', '/api/m3', '/api/m3', '/api/m3', '/build-info.json']);
  for (const [index, {url, options}] of requests.entries()) {
    assert.equal(new URL(url).origin, origin);
    assert.equal(options.redirect, 'manual');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.headers.Cookie, undefined);
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.headers['x-vercel-trusted-oidc-idp-token'], index === 0 ? undefined : token);
    if (options.method === 'POST') assert.deepEqual(JSON.parse(options.body), {action: 'session'});
    else assert.equal(options.body, undefined);
  }
  assert.equal(requests[3].options.headers.Origin, origin);
  assert.equal(requests[4].options.headers.Origin, 'https://invalid-origin.example');
  assert.doesNotMatch(JSON.stringify(report), /private-platform-token|private-nonce|password|cookie/i);
});

test('anonymous public access, untrusted redirects and duplicate redirect destinations stop before authorized access', async () => {
  const locations = ['https://elsewhere.example/sso-api?url=' + encodeURIComponent(origin),
    'https://vercel.com/sso-api?url=' + encodeURIComponent('https://other.example/'),
    'https://vercel.com/sso-api?url=' + encodeURIComponent(origin + '/?secret=hidden'),
    'https://user:secret@vercel.com/sso-api?url=' + encodeURIComponent(origin),
    'https://vercel.com/sso-api?url=' + encodeURIComponent(origin) + '&url=' + encodeURIComponent(origin)];
  for (const response of [new Response('public', {status: 200}), ...locations.map(Location => new Response(null, {status: 302, headers: {Location}}))]) {
    const {report, requests} = await run([response]);
    assert.equal(report.passed, false);
    assert.equal(requests.length, 1);
    assert.equal(report.buildIdentityMatched, false);
    assert.doesNotMatch(JSON.stringify(report), /secret=hidden|user:secret/);
  }
});

test('authenticated redirects are not followed or returned as build success', async () => {
  const sequence = responses();
  sequence[1] = new Response(null, {status: 307, headers: {Location: `https://other.example/?token=${token}`}});
  const {report, requests} = await run(sequence);
  assert.equal(report.failureCode, 'AUTHENTICATED_REDIRECT_REJECTED');
  assert.equal(requests.length, 2);
  assert.doesNotMatch(JSON.stringify(report), /private-platform-token/);
});

test('SHA or digest mismatch stops before session probes or browser fixture writes', async () => {
  for (const change of [{commit: 'c'.repeat(40)}, {sourceDigest: 'c'.repeat(64)}]) {
    const sequence = responses(); sequence[1] = json({...build, ...change});
    const {report, requests} = await run(sequence);
    assert.equal(report.failureCode, 'BUILD_IDENTITY_MISMATCH');
    assert.equal(report.buildIdentityMatched, false);
    assert.equal(requests.length, 2);
    assert.deepEqual(report.expected, expected);
  }
});

test('HTML protection, malformed JSON, invalid UTF-8 and oversized bodies fail without retaining content', async () => {
  const invalid = [new Response('<html>private-platform-token</html>', {headers: {'Content-Type': 'text/html'}}),
    new Response('{"secret":"private-platform-token"', {headers: {'Content-Type': 'application/json'}}),
    new Response(new Uint8Array([0xff]), {headers: {'Content-Type': 'application/json'}}),
    json(build, 200, {'Content-Type': 'application/json; charset=iso-8859-1'}),
    json(build, 200, {'Content-Type': 'application/json; charset=utf-8; charset=utf-8'}),
    json(build, 200, {'Content-Length': String(65537)}),
    new Response(' '.repeat(65537), {headers: {'Content-Type': 'application/json'}})];
  for (const response of invalid) {
    const sequence = responses(); sequence[1] = response;
    const {report, requests} = await run(sequence);
    assert.equal(report.passed, false);
    assert.equal(requests.length, 2);
    assert.doesNotMatch(JSON.stringify(report), /private-platform-token/);
  }
});

test('an unavailable PostgreSQL authority fails before login or further probes', async () => {
  const sequence = responses(); sequence[2] = json({ok: true, result: {configured: false, authority: 'unavailable'}}, 503);
  const {report, requests} = await run(sequence);
  assert.equal(report.failureCode, 'POSTGRES_HEALTH_FAILED');
  assert.equal(report.passed, false);
  assert.equal(requests.length, 3);
});

test('incorrect application session or Origin rejection fails closed', async () => {
  for (const index of [3, 4]) {
    const sequence = responses(); sequence[index] = json({ok: true, result: {}});
    const {report, requests} = await run(sequence);
    assert.equal(report.passed, false);
    assert.equal(requests.length, index + 1);
    assert.equal(report.failureCode, index === 3 ? 'APPLICATION_SESSION_CHECK_FAILED' : 'ORIGIN_CHECK_FAILED');
  }
});

test('request exceptions cannot copy secrets, URLs or driver errors into the report', async () => {
  const sequence = responses(); sequence[1] = new Error(`request failed with ${token} Cookie=private-cookie postgres://user:private-password@host`);
  const {report} = await run(sequence);
  assert.equal(report.failureCode, 'REQUEST_FAILED');
  assert.doesNotMatch(JSON.stringify(report), /private-platform-token|private-cookie|private-password|postgres:\/\//);
});

test('a changed identity during preflight blocks the browser phase', async () => {
  const sequence = responses(); sequence[5] = json({...build, commit: 'c'.repeat(40)});
  const {report} = await run(sequence);
  assert.equal(report.failureCode, 'BUILD_IDENTITY_CHANGED');
  assert.equal(report.passed, false);
});

test('the request timeout also bounds a response that never finishes its JSON body', async () => {
  let calls = 0;
  const report = await runRemotePreflight({env, expected, timeoutMs: 25, fetchImpl: async (_url, options) => {
    calls++;
    if (calls === 1) return responses()[0];
    return new Response(new ReadableStream({start(controller) {
      controller.enqueue(new TextEncoder().encode('{'));
      options.signal.addEventListener('abort', () => controller.error(new Error(token)), {once: true});
    }}), {headers: {'Content-Type': 'application/json'}});
  }});
  assert.equal(report.failureCode, 'REQUEST_TIMEOUT');
  assert.equal(calls, 2);
  assert.doesNotMatch(JSON.stringify(report), /private-platform-token/);
});

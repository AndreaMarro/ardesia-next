import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {request as playwrightRequest} from '@playwright/test';
import {assertContextAccess, closeContextWithAccess, createOriginTransport, fetchApiWithAccess, installContextAccess,
  readApiJson, RemoteAccessError} from '../e2e/remote-access.ts';

// These credentials belong only to the loopback test servers; no external URL is contacted.
const token = 'synthetic-oidc-transport-token';
const password = 'synthetic-application-password';
const header = 'x-vercel-trusted-oidc-idp-token';
const safeError = (code, secrets = [token, password]) => error => {
  assert.ok(error instanceof RemoteAccessError);
  assert.match(error.message, new RegExp(code));
  assert.equal(error.cause, undefined);
  for (const secret of secrets) assert.equal(String(error.stack).includes(secret), false);
  return true;
};

async function loopback(run) {
  const requests = [], foreignRequests = [];
  const foreign = createServer((req, res) => {foreignRequests.push({headers:req.headers, url:req.url}); res.end('foreign');});
  foreign.listen(0, '127.0.0.1'); await once(foreign, 'listening');
  const foreignOrigin = `http://127.0.0.1:${foreign.address().port}`;
  const server = createServer(async (req, res) => {
    let body = ''; for await (const part of req) body += part;
    requests.push({url:req.url, method:req.method, headers:req.headers, body});
    const url = new URL(req.url, 'http://loopback.invalid');
    if (url.pathname.startsWith('/redirect')) {
      res.writeHead(Number(url.pathname.slice('/redirect'.length)), {Location:foreignOrigin + '/must-not-receive-credentials'});
      res.end(); return;
    }
    if (url.pathname === '/disconnect') {req.socket.destroy(); return;}
    if (url.pathname === '/invalid-json') {res.end('invalid ' + token + ' ' + password); return;}
    if (url.pathname === '/cookie') res.setHeader('Set-Cookie', `synthetic_session=${url.searchParams.get('id')}; Path=/; HttpOnly`);
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ok:true}));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const api = await playwrightRequest.newContext();
  try {await run({origin, foreignOrigin, api, requests, foreignRequests, transport:createOriginTransport(origin, token)});}
  finally {
    await api.dispose();
    server.closeAllConnections(); foreign.closeAllConnections();
    await Promise.all([new Promise(resolve => server.close(resolve)), new Promise(resolve => foreign.close(resolve))]);
  }
}

async function remoteEnvironment(run) {
  const patch = {ARDESIA_E2E_MODE:'remote', ARDESIA_E2E_BASE_URL:'https://ardesia-next-staging.vercel.app',
    ARDESIA_E2E:undefined, VERCEL_OIDC_TOKEN:token};
  const previous = Object.fromEntries(Object.keys(patch).map(key => [key, process.env[key]]));
  for (const [key, value] of Object.entries(patch)) {if (value === undefined) delete process.env[key]; else process.env[key] = value;}
  try {return await run();} finally {
    for (const [key, value] of Object.entries(previous)) {if (value === undefined) delete process.env[key]; else process.env[key] = value;}
  }
}

test('remote API transport sends one OIDC header only to its exact origin and disables redirects/retries/TLS overrides', async () => {
  await loopback(async ({origin, foreignOrigin, api, requests, foreignRequests, transport}) => {
    let options;
    const observed = {fetch: (url, supplied) => {options = supplied; return api.fetch(url, supplied);}};
    const response = await transport.fetchApi(observed, origin + '/api/m3', {method:'POST', data:{action:'login', password},
      headers:{Origin:origin, 'X-Ardesia-Account':'synthetic-a', 'X-Vercel-Trusted-Oidc-Idp-Token':'caller-override'},
      maxRedirects:20, maxRetries:3, ignoreHTTPSErrors:true});
    assert.equal(response.status(), 200);
    assert.equal(options.maxRedirects, 0); assert.equal(options.maxRetries, 0); assert.equal(options.ignoreHTTPSErrors, false);
    assert.equal(requests[0].headers[header], token);
    assert.equal(requests[0].headers.origin, origin);
    assert.equal(requests[0].headers['x-ardesia-account'], 'synthetic-a');
    assert.equal(JSON.parse(requests[0].body).password, password);
    await assert.rejects(transport.fetchApi(api, foreignOrigin + '/api/m3', {method:'POST', data:{password}}), safeError('REMOTE_ORIGIN_REFUSED'));
    await assert.rejects(transport.fetchApi(api, origin.replace('http://', 'http://user:' + password + '@') + '/api/m3'), safeError('REMOTE_ORIGIN_REFUSED'));
    assert.equal(foreignRequests.length, 0);
  });
});

test('real 302 and 307 responses cannot forward an OIDC token or login body to another origin', async () => {
  await loopback(async ({origin, api, requests, foreignRequests, transport}) => {
    for (const status of [302, 307]) {
      await assert.rejects(transport.fetchApi(api, `${origin}/redirect${status}`, {method:'POST', data:{password}, maxRedirects:20}), safeError('REMOTE_REDIRECT_REFUSED'));
    }
    assert.equal(requests.length, 2);
    assert.equal(foreignRequests.length, 0);
  });
});

test('transport and malformed JSON failures discard driver call logs, response bodies and causes', async () => {
  await loopback(async ({origin, api, transport}) => {
    await assert.rejects(transport.fetchApi(api, origin + '/disconnect', {method:'POST', data:{password}}), safeError('REMOTE_TRANSPORT_FAILURE'));
    const response = await transport.fetchApi(api, origin + '/invalid-json');
    await remoteEnvironment(async () => {await assert.rejects(readApiJson(response), safeError('REMOTE_INVALID_JSON'));});
    const driver = {fetch: async () => {throw new Error('POST headers ' + token + ' body ' + password, {cause:token});}};
    await assert.rejects(transport.fetchApi(driver, origin + '/api/m3'), safeError('REMOTE_TRANSPORT_FAILURE'));
  });
});

test('a shared platform token does not share application cookies between request contexts', async () => {
  await loopback(async ({origin, api, requests, transport}) => {
    const second = await playwrightRequest.newContext();
    try {
      await transport.fetchApi(api, origin + '/cookie?id=teacher');
      await transport.fetchApi(second, origin + '/cookie?id=student-a');
      await transport.fetchApi(api, origin + '/session-teacher');
      await transport.fetchApi(second, origin + '/session-student');
      assert.equal(requests.at(-2).headers.cookie, 'synthetic_session=teacher');
      assert.equal(requests.at(-1).headers.cookie, 'synthetic_session=student-a');
      assert.equal(requests.at(-2).headers[header], token);
      assert.equal(requests.at(-1).headers[header], token);
    } finally {await second.dispose();}
  });
});

test('routed transport uses the same no-redirect policy and never installs global browser headers', async () => {
  await loopback(async ({origin, foreignOrigin, api, requests, foreignRequests, transport}) => {
    let handler;
    const context = {route: async (_pattern, selected) => {handler = selected;},
      setExtraHTTPHeaders: () => {throw new Error('Global credentials must not be installed.');}};
    await transport.install(context);
    const routeFor = (url, requestHeaders = {}) => {
      const state = {fulfilled:false, aborted:false, continued:false};
      return {state, request:() => ({url:() => url, headers:() => requestHeaders}),
        fetch: options => api.fetch(url, {...options, method:'POST', data:{password}}),
        fulfill: async ({response}) => {assert.equal(response.status(), 200); state.fulfilled = true;},
        abort: async () => {state.aborted = true;},
        continue: async options => {state.continued = true; await api.get(url, options);},
      };
    };
    const sameOrigin = routeFor(origin + '/route'); await handler(sameOrigin);
    assert.equal(sameOrigin.state.fulfilled, true);
    assert.equal(requests.at(-1).headers[header], token);
    const foreign = routeFor(foreignOrigin + '/resource', {[header]:token}); await handler(foreign);
    assert.equal(foreign.state.continued, true);
    assert.equal(foreignRequests.at(-1).headers[header], undefined);
    const before = foreignRequests.length;
    const redirected = routeFor(origin + '/redirect307'); await handler(redirected);
    assert.equal(redirected.state.aborted, true);
    assert.equal(redirected.state.fulfilled, false);
    assert.equal(foreignRequests.length, before);
    assert.throws(() => assertContextAccess(context), safeError('REMOTE_REDIRECT_REFUSED'));
  });
});

test('local API calls and contexts do not acquire platform credentials', async () => {
  const names = ['ARDESIA_E2E_MODE','ARDESIA_E2E_BASE_URL','ARDESIA_E2E','PORT'];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  for (const name of names) delete process.env[name];
  process.env.ARDESIA_E2E_MODE = 'local';
  try {
    await loopback(async ({origin, api, requests}) => {
      const response = await fetchApiWithAccess(api, origin + '/local', {method:'POST', data:{action:'session'}});
      assert.equal(response.status(), 200);
      assert.equal(requests[0].headers[header], undefined);
      await installContextAccess({route:() => {throw new Error('Local routing must remain unchanged.');}});
    });
  } finally {for (const [name, value] of Object.entries(previous)) {if (value === undefined) delete process.env[name]; else process.env[name] = value;}}
});

test('context cleanup preserves earlier failures without treating intentional close aborts as remote faults', async () => {
  const transport = createOriginTransport('http://127.0.0.1:4173', token);
  let handler;
  const route = {request:() => ({url:() => 'http://127.0.0.1:4173/resource', headers:() => ({})}),
    fetch:async () => {throw new Error('closed ' + token);}, abort:async () => {}};
  const closing = {route:async (_pattern, selected) => {handler = selected;}, close:async () => {await handler(route);}};
  await transport.install(closing);
  await closeContextWithAccess(closing);
  assertContextAccess(closing);
  let failedHandler, didClose = false;
  const failed = {route:async (_pattern, selected) => {failedHandler = selected;}, close:async () => {didClose = true;}};
  await transport.install(failed);
  await failedHandler(route);
  await assert.rejects(closeContextWithAccess(failed), safeError('REMOTE_TRANSPORT_FAILURE'));
  assert.equal(didClose, true);
});

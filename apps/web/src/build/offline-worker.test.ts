import {expect, test} from 'vitest';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createHash, webcrypto} from 'node:crypto';

function worker(failInstall = false, wrongBytes = false, evicted = false) {
  const events = new Map<string, (event: any) => void>(), deleted: string[] = [], cached: string[] = [];
  let complete = !evicted;
  const source = readFileSync('apps/web/offline-worker.js', 'utf8')
    .replace('__ARDESIA_CACHE_NAME__', JSON.stringify('ardesia-shell-new'))
    .replace('__ARDESIA_SHELL_DIGESTS__', JSON.stringify(Object.fromEntries(['/', '/assets/current.js', '/build-info.json'].map(path => [path, createHash('sha256').update(wrongBytes ? 'expected bytes' : 'cached').digest('base64')]))));
  runInNewContext(source, {
    self: {location: {origin: 'https://ardesia.test'}, clients: {claim: async () => undefined}, addEventListener: (name: string, fn: (event: any) => void) => events.set(name, fn)},
    caches: {keys: async () => ['ardesia-shell-previous', 'unrelated-cache'], delete: async (name: string) => {deleted.push(name);},
      open: async () => ({addAll: async (requests: Request[]) => {if (failInstall) throw Error('Interrupted installation'); complete = true; cached.push(...requests.map(request => request.url));}, match: async () => complete ? new Response('cached') : undefined})},
    crypto: webcrypto, btoa, Request: class extends Request {constructor(path: string, options: RequestInit) {super(new URL(path, 'https://ardesia.test'), options);}}, URL, fetch: async () => new Response('network'),
  });
  return {events, deleted, cached};
}

test('failed shell installation only removes the incomplete new cache and keeps the previous version', async () => {
  const w = worker(true); let installed!: Promise<void>;
  w.events.get('install')!({waitUntil: (p: Promise<void>) => {installed = p;}});
  await expect(installed).rejects.toThrow('Interrupted installation'); expect(w.deleted).toEqual(['ardesia-shell-new']);
});

test('a successful HTTP response with bytes from another build cannot activate a mixed offline shell', async () => {
  const w = worker(false, true); let installed!: Promise<void>;
  w.events.get('install')!({waitUntil: (p: Promise<void>) => {installed = p;}});
  await expect(installed).rejects.toThrow('Mixed or changed shell'); expect(w.deleted).toEqual(['ardesia-shell-new']);
});

test('the actual worker only intercepts its exact static allowlist, never API, POST, query or plugin data', () => {
  const w = worker();
  for (const [path, method] of [['/api/m3', 'GET'], ['/api/m3', 'POST'], ['/plugins/revocation.json', 'GET'], ['/?account=private', 'GET'], ['/assets/other-build.js', 'GET'], ['https://external.test/assets/current.js', 'GET']]) {
    let intercepted = false;
    w.events.get('fetch')!({request: new Request(new URL(path!, 'https://ardesia.test'), {method}), respondWith: () => {intercepted = true;}});
    expect(intercepted, path).toBe(false);
  }
  let intercepted = false;
  w.events.get('fetch')!({request: new Request('https://ardesia.test/assets/current.js'), respondWith: () => {intercepted = true;}});
  expect(intercepted).toBe(true);
});

test.each([false, true])('shell readiness checks eviction and reports repair failure=%s honestly', async failed => {
  const w = worker(failed, false, true); let checked!: Promise<void>, result: unknown;
  w.events.get('message')!({data: {kind: 'ardesia-shell-status', entry: '/assets/current.js'},
    ports: [{postMessage: (value: unknown) => {result = value;}}], waitUntil: (p: Promise<void>) => {checked = p;}});
  await checked; expect(result).toMatchObject({available: !failed});
  expect(w.cached.length).toBe(failed ? 0 : 3);
});

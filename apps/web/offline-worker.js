// Build replaces these constants with a closed set of same-build shell assets.
const CACHE_NAME = __ARDESIA_CACHE_NAME__;
const SHELL_DIGESTS = __ARDESIA_SHELL_DIGESTS__;
const SHELL_PATHS = Object.keys(SHELL_DIGESTS);
async function fillShell() {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(SHELL_PATHS.map(path => new Request(path, {cache: 'reload', redirect: 'error'})));
    for (const path of SHELL_PATHS) {
      const response = await cache.match(path);
      if (!response) throw Error('Incomplete shell');
      const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', await response.arrayBuffer()));
      const digest = btoa(String.fromCharCode(...bytes));
      if (digest !== SHELL_DIGESTS[path]) throw Error('Mixed or changed shell');
    }
  } catch (error) {await caches.delete(CACHE_NAME); throw error;}
}
self.addEventListener('install', event => {
  event.waitUntil(fillShell());
});
// No skipWaiting: existing clients finish using their own complete build.
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('ardesia-shell-') && key !== CACHE_NAME) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.search) return;
  const path = url.pathname === '/index.html' ? '/' : url.pathname;
  // API, identity, health, external URLs and plugin revocations never enter this cache.
  if (!SHELL_PATHS.includes(path)) return;
  event.respondWith(caches.open(CACHE_NAME).then(cache => cache.match(path)).then(response => response ?? fetch(request)));
});
self.addEventListener('message', event => {
  if (event.data?.kind === 'ardesia-shell-status' && event.ports[0]) {
    event.waitUntil((async () => {
      let available = SHELL_PATHS.includes(event.data.entry);
      if (available) {
        const cache = await caches.open(CACHE_NAME);
        const complete = (await Promise.all(SHELL_PATHS.map(path => cache.match(path)))).every(Boolean);
        // Repair an evicted cache only from the exact original build bytes.
        if (!complete) try {await fillShell();} catch {available = false;}
      }
      event.ports[0].postMessage({available, build: CACHE_NAME});
    })());
  }
});

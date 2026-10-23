// Network first for the app and JSON (so a deploy shows up), cache first for tiles and fonts.
// The build stamps BUILD (vite.config.js) with an id, the hashed files under assets/ and the ones the page
// loads (entry), so every deploy installs a new worker. Its install stores this build's page and files and
// the data boot requires, then its activate drops the bundles of earlier deploys. CACHE keeps its name, so
// tiles and fonts stay cached across deploys and are not downloaded again, and data stays for offline use.
// GitHub Pages sends max-age=600 with every file: for ten minutes after a visit, a fetch with the default
// cache mode is answered by the browser's HTTP cache, which can hold the previous deploy's page or data.
// The page and every network-first file without a hash in its name (data/*.json) are always fetched with
// cache 'no-cache' (revalidated; a 304 when it has not changed), so code and data come from one deploy.
const CACHE = 'materia-v2';
// this app's caches, by exact name: CACHE and its earlier names (git history). The origin vdm285.github.io
// is shared with the owner's other apps (Papelito, A cómo, Giramundo); no other cache is ours to delete.
const RETIRED = ['tabla-viva-v1'];
// null when unstamped (the dev server, a plain copy of public/): then nothing is stored ahead or pruned
const BUILD = /*__SW_BUILD__*/ null;
const STAMPED = !!BUILD && Array.isArray(BUILD.files) && BUILD.files.length > 0 && Array.isArray(BUILD.entry) && BUILD.entry.length > 0;
const here = (p) => new URL(p, self.location.href).pathname;
// the offline copy of the page is kept once, under the scope ('./', /interactive-science/ on Pages)
const PAGE = new URL('./', self.location.href).href;
// a hashed name without its hash (Vite's [name]-[hash]): assets/index-DxmzSvqx.js -> assets/index.js
const stem = (p) => p.replace(/-[\w-]{8}(\.\w+)$/, '$1');
// Vite's hashed files: one never changes under its name, so the HTTP cache may answer it
const ASSETS = here(STAMPED ? BUILD.dir : 'assets/');
// the one data file boot requires (src/data/load.js): the install stores it, so one visit can start offline
const BOOT = here('data/elements.json');
// whether a page names this build's entry files (the page whose files the install stored)
const ownPage = async (res) => {
  const html = await res.clone().text();
  return BUILD.entry.every((f) => html.includes(f));
};

self.addEventListener('install', (event) => event.waitUntil((async () => {
  if (STAMPED) {
    const page = await fetch(PAGE, { cache: 'no-cache' });
    if (!page.ok) throw new Error(`sw: the page answered ${page.status}`);
    // the page must be this worker's build, or activate would prune the files it loads; a failed install
    // leaves the old worker in place and the browser tries again on a later visit
    if (!(await ownPage(page))) throw new Error('sw: the page is from another build');
    const cache = await caches.open(CACHE);
    const dir = here(BUILD.dir);
    const have = new Set((await cache.keys()).map((r) => new URL(r.url).pathname));
    const had = new Set([...have].filter((p) => p.startsWith(dir)).map(stem));
    const entry = new Set(BUILD.entry.map(here));
    // the page's own files, and this build's version of each file an earlier build left in the cache (the
    // 3D scene, the fonts in use), so the simple mode still never downloads three; nothing already cached.
    // And this deploy's copy of the data boot requires (revalidated), so a single visit can start offline.
    await cache.addAll([
      ...BUILD.files.map(here).filter((p) => !have.has(p) && (entry.has(p) || had.has(stem(p)))),
      new Request(BOOT, { cache: 'no-cache' }),
    ]);
    await cache.put(PAGE, page);
  }
  await self.skipWaiting();
})()));
self.addEventListener('activate', (event) => event.waitUntil((async () => {
  await Promise.all((await caches.keys()).filter((k) => RETIRED.includes(k)).map((k) => caches.delete(k)));
  // the hashed files of earlier deploys, under this worker's own scope; every other entry stays
  if (STAMPED && (await caches.has(CACHE))) {
    const keep = new Set(BUILD.files.map(here));
    const dir = here(BUILD.dir);
    const cache = await caches.open(CACHE);
    for (const req of await cache.keys()) {
      const path = new URL(req.url).pathname;
      if (path.startsWith(dir) && !keep.has(path)) await cache.delete(req);
    }
  }
  await self.clients.claim();
})()));
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const nav = request.mode === 'navigate';
  const key = nav && (url.pathname === here('./') || url.pathname === here('index.html')) ? PAGE : request;
  const cacheFirst = !nav && /\/img\/|\/assets\/.*\.(woff2?|webp|png|svg)$/.test(url.pathname);
  // network first without a hash in the name (the page, data/*.json): revalidated, never read unchecked
  // from the HTTP cache, so a page and its data come from the same deploy
  const revalidate = nav || (!cacheFirst && !url.pathname.startsWith(ASSETS));
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(key);
    if (cacheFirst && cached) return cached;
    try {
      // the page under a query Pages ignores: when Chrome starts a stopped worker it may preload the
      // navigation from the HTTP cache and hand that answer to fetch(request), revalidation or not
      const fresh = await (key === PAGE ? fetch(`${PAGE}?sw`, { cache: 'no-cache' }) : revalidate ? fetch(request, { cache: 'no-cache' }) : fetch(request));
      if (fresh.ok) {
        const copy = fresh.clone();
        // a stamped worker keeps as the offline page only its own build's page, whose files its install
        // stored; a newer deploy's page is stored by that deploy's worker when it installs
        if (key === PAGE && STAMPED) event.waitUntil(ownPage(copy).then((own) => own && cache.put(PAGE, copy)));
        else cache.put(key, copy);
        return fresh;
      }
      // a 404 or a 5xx (a Pages outage, a file a newer deploy removed): the cached copy if there is one
      return (fresh.status >= 400 && cached) || fresh;
    } catch {
      return cached || Response.error();
    }
  })());
});

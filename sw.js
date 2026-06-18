/* Crazy Cactus service worker
   - Card images: cached permanently (cache-first) so the app gets faster the more you browse,
     and images keep showing even offline.
   - CDN libraries / fonts: stale-while-revalidate (instant from cache, refreshed in the background).
   Place this file next to your HTML on an https host (e.g. GitHub Pages). */

const IMG_CACHE = 'cactus-img-v1';
const ASSET_CACHE = 'cactus-assets-v1';

// Card art + the logo
const IMG_HOSTS = ['images.pokemontcg.io', 'raw.githubusercontent.com'];
// Pinned libraries, fonts and styles
const ASSET_HOSTS = ['cdn.tailwindcss.com', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'www.gstatic.com'];

self.addEventListener('install', (e) => { self.skipWaiting(); });

self.addEventListener('activate', (e) => {
    e.waitUntil((async () => {
        const keep = [IMG_CACHE, ASSET_CACHE];
        const names = await caches.keys();
        await Promise.all(names.filter(n => !keep.includes(n)).map(n => caches.delete(n)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET') return;
    let host;
    try { host = new URL(req.url).hostname; } catch (err) { return; }

    // Images: cache-first, kept forever.
    if (IMG_HOSTS.includes(host)) {
        e.respondWith((async () => {
            const cache = await caches.open(IMG_CACHE);
            const hit = await cache.match(req);
            if (hit) return hit;
            try {
                const res = await fetch(req);
                if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
                return res;
            } catch (err) {
                const fallback = await cache.match(req);
                return fallback || Response.error();
            }
        })());
        return;
    }

    // CDN libraries/fonts: stale-while-revalidate.
    if (ASSET_HOSTS.includes(host)) {
        e.respondWith((async () => {
            const cache = await caches.open(ASSET_CACHE);
            const hit = await cache.match(req);
            const fetching = fetch(req).then(res => {
                if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
                return res;
            }).catch(() => hit);
            return hit || fetching;
        })());
    }
});

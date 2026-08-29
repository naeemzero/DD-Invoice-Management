/**
 * DD CMS — Service Worker v2.0
 * Enables offline usage & PWA installability
 */
const CACHE = 'dd-cms-v2.2';
const CORE  = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icon/icon-192.png?v=3',
  './icon/icon-512.png?v=3',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    for (const req of CORE){
      try{
        const resp = await fetch(req);
        if(resp && (resp.status === 200 || resp.type === 'opaque' || resp.type === 'cors')){
          try{ await c.put(req, resp.clone()); } catch(e){ console.warn('[SW] cache put failed', req, e); }
        }
      }catch(err){
        // Don't fail the entire install if a single resource fails.
        console.warn('[SW] fetch failed, skipping resource', req, err);
      }
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const clone = response.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return response;
      }).catch(() => {
        // Offline fallback for navigation
        if (e.request.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});

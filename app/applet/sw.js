/**
 * DD CMS — Service Worker v3.0
 * Enables offline app-shell loading & PWA installability.
 * Data itself is never cached here — Firestore's own SDK handles
 * offline queuing/sync; this only caches the static app shell.
 */
const CACHE = 'dd-cms-v3.0';
const CORE  = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/script.js',
  '/json/manifest.json',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/apple-touch-icon.png',
  '/assets/seal.png',
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
        const resp = await fetch(req, {cache:'reload'});
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
  const url = new URL(e.request.url);
  // Never cache/intercept Firebase or Google API calls — those must always
  // hit the network so auth/Firestore/Storage behave correctly and never
  // serve stale or opaque cached responses for live data.
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('firebaseio.com') ||
      url.hostname.includes('firebasestorage.app') || url.hostname.includes('gstatic.com')) {
    return;
  }
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
        if (e.request.mode === 'navigate') return caches.match('/index.html');
      });
    })
  );
});

// Service Worker para CotizaPro PWA
const CACHE_NAME = 'cotizapro-v2';

self.addEventListener('install', (e) => {
  console.log('[SW] Installed');
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  console.log('[SW] Activated');
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  
  // Never cache Firebase API calls
  if (url.hostname.includes('firebaseio.com') ||
      url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('identitytoolkit.googleapis.com') ||
      url.hostname.includes('googleapis.com')) {
    return;
  }

  // NEVER cache HTML files - always serve fresh to avoid stale auth state
  if (e.request.headers.get('accept')?.includes('text/html') ||
      url.pathname.endsWith('.html') ||
      url.pathname === '/' ||
      url.pathname === '/app' ||
      url.pathname === '/superadmin') {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' }).catch(() => {
        // Offline fallback - try to serve from cache
        return caches.match(e.request);
      })
    );
    return;
  }

  // Cache static assets (JS, CSS, images) with network-first strategy
  e.respondWith(
    fetch(e.request).then(response => {
      // Only cache successful GETs for static assets
      if (response.ok && e.request.method === 'GET' &&
          (url.pathname.includes('/assets/') || url.pathname.includes('/icon'))) {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(e.request, responseClone);
        });
      }
      return response;
    }).catch(() => caches.match(e.request))
  );
});

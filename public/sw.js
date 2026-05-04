// Service Worker para CotizaPro PWA
const CACHE_NAME = 'cotizapro-v3';

self.addEventListener('install', (e) => {
  console.log('[SW] Installed v3 - busting old caches');
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  console.log('[SW] Activated v3');
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] Deleting old cache:', k);
          return caches.delete(k);
        })
      );
    })
  );
  self.clients.claim();
  // Force all clients to reload
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({ type: 'SW_UPDATED', version: CACHE_NAME });
    });
  });
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
      url.pathname === '/superadmin' ||
      url.pathname === '/view') {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' }).catch(() => {
        // Offline fallback - try to serve from cache
        return caches.match(e.request);
      })
    );
    return;
  }

  // NEVER cache SW and manifest
  if (url.pathname === '/sw.js' || url.pathname === '/manifest.json') {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
    );
    return;
  }

  // Cache static assets (JS, CSS, images) with network-first strategy
  e.respondWith(
    fetch(e.request, { cache: 'no-store' }).then(response => {
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

// Listen for messages from clients
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

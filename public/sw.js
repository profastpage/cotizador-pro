/* ==========================================================
   SERVICE WORKER - CotizaPro PWA
   Estrategias de caché: Cache-First para assets, 
   Network-First para datos
========================================================== */

const CACHE_NAME = 'cotizapro-v1.1.0';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './validators.js',
  './data-manager.js',
  './pdf-generator.js',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];

// ==========================================================
// INSTALL - Cache assets on install
// ==========================================================
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando CotizaPro Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Cacheando assets...');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// ==========================================================
// ACTIVATE - Clean old caches
// ==========================================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando nuevo Service Worker...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// ==========================================================
// FETCH - Cache-First strategy for static assets
// Network-First for dynamic content
// ==========================================================
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Cache-First para assets estáticos
  if (event.request.destination === 'document' || 
      event.request.destination === 'script' ||
      event.request.destination === 'style' ||
      event.request.destination === 'image' ||
      event.request.destination === 'manifest' ||
      event.request.destination === 'font') {
    
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          if (response) {
            return response;
          }
          return fetch(event.request).then((fetchResponse) => {
            if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
              return fetchResponse;
            }
            const responseToCache = fetchResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
            return fetchResponse;
          });
        })
        .catch(() => {
          // Fallback para offline
          if (event.request.destination === 'document') {
            return caches.match('./index.html');
          }
        })
    );
  }
});

// ==========================================================
// MESSAGE - Communication with main thread
// ==========================================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

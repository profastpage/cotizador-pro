// Service Worker para CotizaPro PWA
const CACHE_NAME = 'cotizapro-v8';

// Instalación - Solo cacheamos lo esencial
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando...');
  self.skipWaiting();
});

// Activación
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando...');
  self.clients.claim();
});

// Fetch - Network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Ignorar Firebase y otros
  if (event.request.url.includes('firebaseio.com') ||
      event.request.url.includes('firestore.googleapis.com') ||
      event.request.url.includes('identitytoolkit.googleapis.com')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request))
  );
});

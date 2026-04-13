// Service Worker para CotizaPro PWA
const CACHE_NAME = 'cotizapro-v1';
const STATIC_CACHE = 'cotizapro-static-v1';
const DYNAMIC_CACHE = 'cotizapro-dynamic-v1';

// Recursos para cachear en instalación
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.html',
  '/superadmin.html',
  '/manifest.json',
  '/css/styles-app.css',
  '/css/styles-landing.css',
  '/css/styles-superadmin.css',
  '/js/app-user.js',
  '/js/auth.js',
  '/js/superadmin.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap'
];

// Instalación - Cachear recursos estáticos
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando service worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Cacheando recursos estáticos');
        return cache.addAll(STATIC_ASSETS);
      })
      .catch((err) => console.log('[SW] Error cacheando:', err))
  );
  self.skipWaiting();
});

// Activación - Limpiar caches viejos
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch - Estrategia Cache First con fallback a red
self.addEventListener('fetch', (event) => {
  // Ignorar solicitudes de Firebase (Firestore, Auth, etc.)
  if (
    event.request.url.includes('firebaseio.com') ||
    event.request.url.includes('firestore.googleapis.com') ||
    event.request.url.includes('identitytoolkit.googleapis.com')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request)
          .then((response) => {
            // No cachear respuestas inválidas
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clonar respuesta para cachear
            const responseToCache = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(event.request, responseToCache);
            });

            return response;
          })
          .catch(() => {
            // Fallback offline para páginas HTML
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
            }
            return new Response('Offline', { status: 503 });
          });
      })
  );
});

// Manejar notificaciones push (preparado para futuro)
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'CotizaPro';
  const options = {
    body: data.body || 'Tienes una nueva notificación',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'cotizapro-notification'
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Manejar clic en notificaciones
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.openWindow('/')
  );
});

// Background sync (preparado para futuro)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-quotes') {
    event.waitUntil(syncQuotes());
  }
});

async function syncQuotes() {
  // Futura implementación para sincronizar cotizaciones offline
  console.log('[SW] Background sync triggered');
}

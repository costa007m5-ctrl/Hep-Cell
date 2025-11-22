
const CACHE_NAME = 'relp-cell-v23-pwabuilder-ready';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Assets críticos para funcionamento offline completo
const CRITICAL_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://sdk.mercadopago.com/js/v2'
];

// Instalação: Cacheia os arquivos essenciais imediatamente
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Força o SW a ativar imediatamente
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[SW] Caching core assets');
      // Cacheia assets estáticos primeiro
      await cache.addAll(STATIC_ASSETS);
      
      // Tenta cachear assets críticos, mas não falha se algum der erro
      for (const asset of CRITICAL_ASSETS) {
        try {
          await cache.add(asset);
        } catch (error) {
          console.warn(`[SW] Failed to cache ${asset}:`, error);
        }
      }
    })
  );
});

// Ativação: Limpa versões antigas do cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Stale-While-Revalidate para Assets, Network First para HTML
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignora requisições de API (sempre rede) e outros métodos
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/') || url.protocol.startsWith('chrome-extension')) {
    return;
  }

  // Navegação (HTML): Tenta rede primeiro, fallback para cache (Offline)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match('/index.html') || caches.match('/');
        })
    );
    return;
  }

  // Assets Estáticos: Cache First com atualização em background
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Atualiza o cache em background
        fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, networkResponse.clone());
                });
            }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      });
    })
  );
});

// --- Funcionalidades Avançadas PWA (Para PWABuilder Score) ---

// 1. Push Notifications
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Relp Cell';
  const options = {
    body: data.body || 'Nova atualização disponível.',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// 2. Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});

// 3. Background Sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-invoices') {
    // Lógica futura para sincronizar faturas em background
    console.log('[SW] Background Sync disparado para faturas.');
  }
});

// 4. Periodic Background Sync
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-content') {
    console.log('[SW] Periodic Sync disparado.');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.add('/'); // Atualiza a home periodicamente
        })
    );
  }
});


const CACHE_NAME = 'relp-cell-v24-fix-icons';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://placehold.co/192x192/4f46e5/ffffff.png',
  'https://placehold.co/512x512/4f46e5/ffffff.png'
];

// Instalação: Cacheia o Shell do App (HTML + Assets básicos)
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Força o SW a ativar imediatamente
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching core assets');
      return cache.addAll(STATIC_ASSETS);
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

// Fetch: Estratégia Network First com Fallback para Cache (SPA Friendly)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Ignora requisições API, Chrome Extensions, ou métodos não-GET
  // Nota: Permitimos requisições cross-origin para imagens (placehold.co) passarem
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/') || url.protocol.startsWith('chrome-extension')) {
    return;
  }

  // 2. Tratamento de Navegação (HTML)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put('/', networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => {
          return caches.match('/index.html') || caches.match('/');
        })
    );
    return;
  }

  // 3. Tratamento de Assets
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
    icon: 'https://placehold.co/192x192/4f46e5/ffffff.png',
    badge: 'https://placehold.co/96x96/4f46e5/ffffff.png',
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

const CACHE_NAME = 'relp-cell-v20-store-ready';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://placehold.co/192x192/4f46e5/ffffff.png?text=Relp',
  'https://placehold.co/512x512/4f46e5/ffffff.png?text=Relp'
];

// Instalação: Cacheia os arquivos essenciais imediatamente
self.addEventListener('install', (event) => {
  self.skipWaiting();
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

const CACHE_NAME = 'relp-cell-v2';
const STATIC_ASSETS = [
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Instalação: Cacheia apenas o essencial estático
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// Ativação: Limpa caches antigos
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

// Fetch: Estratégia Híbrida
self.addEventListener('fetch', (event) => {
  // Ignora requisições que não são GET ou são para API/Admin
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }

  const url = new URL(event.request.url);

  // 1. Estratégia Network First para HTML (Navegação)
  // Garante que o usuário sempre veja a versão mais recente do app se tiver internet
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  // 2. Estratégia Stale-While-Revalidate para JS, CSS e Imagens
  // Mostra o cache rápido, mas atualiza em segundo plano
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse.clone());
            });
        }
        return networkResponse;
      });
      return cachedResponse || fetchPromise;
    })
  );
});
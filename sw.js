const CACHE_NAME = 'relp-cell-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Instalação: Cacheia o Shell do App (HTML + Assets básicos)
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Força o SW a ativar imediatamente
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// Ativação: Limpa caches antigos para garantir que o usuário tenha a versão nova
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
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
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/') || url.protocol.startsWith('chrome-extension')) {
    return;
  }

  // 2. Tratamento de Navegação (HTML)
  // Tenta pegar da rede. Se falhar (offline), retorna o index.html do cache.
  // Isso permite que rotas como /faturas ou /loja funcionem offline.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            // Atualiza o cache do index.html em segundo plano
            cache.put('/', networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => {
          console.log('[SW] Offline navigation fallback');
          return caches.match('/') || caches.match('/index.html');
        })
    );
    return;
  }

  // 3. Tratamento de Assets (JS, CSS, Imagens, Fonts)
  // Stale-While-Revalidate: Retorna o cache rápido, mas busca atualização no fundo.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse.clone());
            });
        }
        return networkResponse;
      }).catch(() => {
        // Se falhar o fetch (offline) e não tiver cache, não faz nada (ou retorna placeholder)
      });

      return cachedResponse || fetchPromise;
    })
  );
});
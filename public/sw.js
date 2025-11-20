const CACHE_NAME = 'relp-cell-v13';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://placehold.co/192x192/4f46e5/ffffff.png?text=Relp',
  'https://placehold.co/512x512/4f46e5/ffffff.png?text=Relp'
];

// Instalação: Cacheia apenas o essencial para o app abrir
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
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

// Fetch: Network First para HTML, Cache First para assets, com fallback robusto
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignora requisições que não sejam GET ou que sejam para API
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return;
  }

  // Navegação (HTML) - Estratégia Network First
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            // Atualiza o cache com a nova versão da página
            cache.put('/', networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => {
          // Fallback Offline: Tenta retornar o index.html do cache
          return caches.match('/index.html').then((response) => {
              return response || caches.match('/');
          });
        })
    );
    return;
  }

  // Assets estáticos e imagens - Estratégia Cache First
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request).then((networkResponse) => {
        return networkResponse;
      });
    })
  );
});

// Lidar com o clique na notificação
self.addEventListener('notificationclick', function(event) {
  console.log('[SW] Notification click Received.', event.notification.data);
  
  event.notification.close();

  // Foca na janela do app se estiver aberta, ou abre uma nova
  event.waitUntil(
    clients.matchAll({type: 'window', includeUncontrolled: true}).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.indexOf('/') > -1 && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
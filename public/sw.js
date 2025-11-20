const CACHE_NAME = 'relp-cell-v14'; // Versão incrementada
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://placehold.co/192x192/4f46e5/ffffff.png?text=Relp',
  'https://placehold.co/512x512/4f46e5/ffffff.png?text=Relp'
];

// Instalação: Cacheia o Shell do App
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Força ativação imediata
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      // Importante: Cacheia explicitamente o index.html
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

// Fetch: Estratégia Network First com Fallback Robusto para index.html
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Ignora requisições API ou não-GET
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return;
  }

  // 2. Tratamento de Navegação (HTML)
  // Isso é CRÍTICO para a instalação funcionar. Se a rede falhar, DEVE retornar o index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match('/index.html')
            .then((response) => {
                if (response) {
                    return response;
                }
                // Se não achar /index.html, tenta a raiz '/'
                return caches.match('/');
            });
        })
    );
    return;
  }

  // 3. Tratamento de Assets (CSS, JS, Imagens)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request).catch(() => {
          // Retorna null se falhar, para não quebrar a página inteira
          return null;
      });
    })
  );
});

// Lidar com o clique na notificação
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
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

const CACHE_NAME = 'relp-cell-v18-store-ready';
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

// Listener para forçar atualização via interface se necessário
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch: Stale-While-Revalidate para Assets, Network First para HTML/API
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Ignorar requisições de API (sempre rede), extensões ou métodos POST/PUT/DELETE
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/') || url.protocol.startsWith('chrome-extension')) {
    return;
  }

  // 2. Navegação (HTML): Tenta rede primeiro para ter dados frescos, falha para cache (Offline Mode)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match('/index.html') || caches.match('/');
        })
    );
    return;
  }

  // 3. Assets Estáticos (JS, CSS, Imagens): Cache First, depois atualiza em background
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Se tem no cache, retorna ele
      if (cachedResponse) {
        // Mas atualiza o cache em background para a próxima vez (Stale-While-Revalidate)
        fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, networkResponse.clone());
                });
            }
        }).catch(() => {}); // Erros de rede em background são ignorados
        
        return cachedResponse;
      }

      // Se não tem no cache, busca na rede
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

// Suporte a Notificações Push (Preparação para futuro)
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({type: 'window', includeUncontrolled: true}).then(function(clientList) {
      // Se já houver uma janela aberta, foca nela
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.indexOf('/') > -1 && 'focus' in client) {
          return client.focus();
        }
      }
      // Senão, abre uma nova
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

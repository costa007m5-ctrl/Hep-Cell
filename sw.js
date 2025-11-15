const CACHE_NAME = 'relp-cell-cache-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/src/main.tsx'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache aberto');
        return cache.addAll(urlsToCache).catch(err => {
          console.log('Erro ao adicionar ao cache:', err);
        });
      })
  );
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }

        return fetch(event.request).then(
          (response) => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                if (!event.request.url.includes('/api/') && 
                    !event.request.url.includes('aistudiocdn.com') &&
                    !event.request.url.includes('cdn.tailwindcss.com')) {
                   cache.put(event.request, responseToCache);
                }
              });

            return response;
          }
        ).catch(() => {
          return caches.match('/index.html');
        });
      })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deletando cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});
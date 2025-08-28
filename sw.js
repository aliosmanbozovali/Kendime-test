
const CACHE_NAME = 'kendime-v1.0.3';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json'
];

// Install event
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('SW: Cache açıldı');
        return cache.addAll(urlsToCache);
      })
      .then(function() {
        return self.skipWaiting();
      })
  );
});

// Activate event
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('SW: Eski cache siliniyor:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Fetch event
self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Cache'den döndür veya network'ten getir
        if (response) {
          return response;
        }
        
        return fetch(event.request).then(function(response) {
          // Geçerli response kontrolü
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Response'u klonla ve cache'e ekle
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(function(cache) {
              cache.put(event.request, responseToCache);
            });

          return response;
        }).catch(function() {
          // Network hatası durumunda offline sayfası
          if (event.request.destination === 'document') {
            return caches.match('/index.html');
          }
        });
      }
    )
  );
});

// Background sync
self.addEventListener('sync', function(event) {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Offline sırasında kaydedilen notları sync et
      console.log('SW: Background sync çalıştırıldı')
    );
  }
});

// Push notifications
self.addEventListener('push', function(event) {
  let options = {
    body: 'Yeni bildiriminiz var',
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'><rect width='192' height='192' rx='40' fill='%23ff7a00'/><text x='96' y='130' font-size='120' text-anchor='middle' fill='white' font-family='system-ui' font-weight='bold'>K</text></svg>",
    badge: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'><rect width='96' height='96' rx='20' fill='%23ff7a00'/><text x='48' y='65' font-size='60' text-anchor='middle' fill='white' font-family='system-ui' font-weight='bold'>K</text></svg>",
    tag: 'kendime-notification',
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: {
      url: '/'
    }
  };

  if (event.data) {
    try {
      const data = event.data.json();
      options.body = data.message || options.body;
      options.title = data.title || 'Kendime';
    } catch (e) {
      options.body = event.data.text() || options.body;
    }
  }
  
  event.waitUntil(
    self.registration.showNotification('Kendime', options)
  );
});

// Notification click
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  const url = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(function(clientList) {
      // Mevcut pencere varsa odaklan
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // Yoksa yeni pencere aç
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Message event
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

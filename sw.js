
const CACHE_NAME = 'kendime-v3.0.0';
const STATIC_CACHE = 'kendime-static-v3.0.0';
const DYNAMIC_CACHE = 'kendime-dynamic-v3.0.0';

// Static files to cache
const STATIC_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/sw.js'
];

// Cache strategies
const CACHE_STRATEGIES = {
  CACHE_FIRST: 'cache-first',
  NETWORK_FIRST: 'network-first',
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate'
};

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('SW: Installing service worker...');
  
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('SW: Caching static files');
        return cache.addAll(STATIC_FILES);
      }),
      self.skipWaiting()
    ])
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('SW: Activating service worker...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
            .map((name) => {
              console.log('SW: Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      }),
      // Take control of all clients
      self.clients.claim()
    ])
  );
});

// Fetch event - handle requests with different strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other schemes
  if (!url.protocol.startsWith('http')) {
    return;
  }

  event.respondWith(handleRequest(request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  
  try {
    // Static files - Cache First
    if (STATIC_FILES.some(file => url.pathname === file || url.pathname.endsWith(file))) {
      return await cacheFirst(request, STATIC_CACHE);
    }

    // API requests - Network First
    if (url.pathname.startsWith('/api/')) {
      return await networkFirst(request, DYNAMIC_CACHE);
    }

    // Images and assets - Stale While Revalidate
    if (request.destination === 'image' || url.pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|woff|woff2)$/)) {
      return await staleWhileRevalidate(request, DYNAMIC_CACHE);
    }

    // Default strategy - Network First with fallback
    return await networkFirst(request, DYNAMIC_CACHE);

  } catch (error) {
    console.error('SW: Fetch error:', error);
    
    // Return offline fallback for navigation requests
    if (request.mode === 'navigate') {
      const cache = await caches.open(STATIC_CACHE);
      return await cache.match('/index.html') || new Response('Offline', { status: 503 });
    }
    
    return new Response('Network error', { status: 503 });
  }
}

// Cache First Strategy
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  if (cached) {
    // Update cache in background
    updateCache(request, cacheName);
    return cached;
  }
  
  return await fetchAndCache(request, cacheName);
}

// Network First Strategy
async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request.clone(), networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('SW: Network failed, trying cache');
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    
    if (cached) {
      return cached;
    }
    
    throw error;
  }
}

// Stale While Revalidate Strategy
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  // Always try to update from network
  const networkPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request.clone(), response.clone());
    }
    return response;
  }).catch(() => {
    // Network failed, but we might have cache
  });

  // Return cached version immediately if available
  if (cached) {
    return cached;
  }
  
  // If no cache, wait for network
  return await networkPromise;
}

// Helper functions
async function fetchAndCache(request, cacheName) {
  const response = await fetch(request);
  
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request.clone(), response.clone());
  }
  
  return response;
}

async function updateCache(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response);
    }
  } catch (error) {
    // Background update failed, but we have cache
    console.log('SW: Background update failed for:', request.url);
  }
}

// Background sync for notes
self.addEventListener('sync', (event) => {
  console.log('SW: Background sync triggered:', event.tag);
  
  if (event.tag === 'sync-notes') {
    event.waitUntil(syncNotes());
  }
});

async function syncNotes() {
  try {
    // Get pending notes from IndexedDB or localStorage
    const clients = await self.clients.matchAll();
    
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_NOTES',
        action: 'sync'
      });
    });
    
    console.log('SW: Notes sync completed');
  } catch (error) {
    console.error('SW: Notes sync failed:', error);
  }
}

// Push notifications
self.addEventListener('push', (event) => {
  console.log('SW: Push received');
  
  let options = {
    body: 'Yeni bir bildiriminiz var',
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'><defs><linearGradient id='grad' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' style='stop-color:%23ff8a1f'/><stop offset='100%' style='stop-color:%23ff7a00'/></linearGradient></defs><rect width='192' height='192' rx='40' fill='url(%23grad)'/><text x='96' y='130' font-size='120' text-anchor='middle' fill='white' font-family='system-ui' font-weight='bold'>K</text></svg>",
    badge: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'><rect width='96' height='96' rx='20' fill='%23ff7a00'/><text x='48' y='65' font-size='60' text-anchor='middle' fill='white' font-family='system-ui' font-weight='bold'>K</text></svg>",
    tag: 'kendime-notification',
    requireInteraction: false,
    silent: false,
    vibrate: [200, 100, 200, 100, 200],
    actions: [
      {
        action: 'open',
        title: 'Aç',
        icon: '/icons/open.png'
      },
      {
        action: 'dismiss',
        title: 'Kapat',
        icon: '/icons/close.png'
      }
    ],
    data: {
      url: '/',
      timestamp: Date.now()
    }
  };

  if (event.data) {
    try {
      const data = event.data.json();
      options = {
        ...options,
        body: data.message || options.body,
        title: data.title || 'Kendime',
        data: { ...options.data, ...data }
      };
    } catch (e) {
      options.body = event.data.text() || options.body;
    }
  }
  
  event.waitUntil(
    self.registration.showNotification('Kendime', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  console.log('SW: Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;
  }
  
  const url = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ 
      type: 'window',
      includeUncontrolled: true 
    }).then((clientList) => {
      // Check if app is already open
      for (let client of clientList) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Message handling
self.addEventListener('message', (event) => {
  console.log('SW: Message received:', event.data);
  
  const { type, data } = event.data || {};
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'GET_VERSION':
      event.ports[0].postMessage({
        type: 'VERSION',
        version: CACHE_NAME
      });
      break;
      
    case 'CLEAR_CACHE':
      clearAllCaches().then(() => {
        event.ports[0].postMessage({
          type: 'CACHE_CLEARED',
          success: true
        });
      });
      break;
      
    case 'PREFETCH':
      if (data?.urls) {
        prefetchUrls(data.urls);
      }
      break;
      
    default:
      console.log('SW: Unknown message type:', type);
  }
});

// Helper function to clear all caches
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  return Promise.all(
    cacheNames.map(name => caches.delete(name))
  );
}

// Helper function to prefetch URLs
async function prefetchUrls(urls) {
  const cache = await caches.open(DYNAMIC_CACHE);
  
  const promises = urls.map(async (url) => {
    try {
      const response = await fetch(url);
      if (response.ok) {
        await cache.put(url, response);
      }
    } catch (error) {
      console.log('SW: Failed to prefetch:', url);
    }
  });
  
  return Promise.all(promises);
}

// Periodic background sync (experimental)
self.addEventListener('periodicsync', (event) => {
  console.log('SW: Periodic sync triggered:', event.tag);
  
  if (event.tag === 'notes-backup') {
    event.waitUntil(performBackup());
  }
});

async function performBackup() {
  try {
    const clients = await self.clients.matchAll();
    
    clients.forEach(client => {
      client.postMessage({
        type: 'BACKUP_NOTES',
        action: 'backup'
      });
    });
    
    console.log('SW: Backup sync completed');
  } catch (error) {
    console.error('SW: Backup sync failed:', error);
  }
}

// Cache size management
async function manageCacheSize(cacheName, maxItems = 100) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  if (keys.length > maxItems) {
    // Delete oldest entries
    const deleteCount = keys.length - maxItems;
    const deletePromises = keys
      .slice(0, deleteCount)
      .map(key => cache.delete(key));
    
    await Promise.all(deletePromises);
    console.log(`SW: Cleaned ${deleteCount} items from ${cacheName}`);
  }
}

// Periodic cache cleanup
setInterval(() => {
  manageCacheSize(DYNAMIC_CACHE, 100);
}, 60000); // Every minute

// Network status monitoring
self.addEventListener('online', () => {
  console.log('SW: Back online');
  // Sync pending changes
  self.registration.sync.register('sync-notes');
});

self.addEventListener('offline', () => {
  console.log('SW: Gone offline');
});

console.log('SW: Service Worker loaded successfully');

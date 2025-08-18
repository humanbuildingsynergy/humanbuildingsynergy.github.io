// HUBS Laboratory Service Worker
// Provides offline functionality and improved performance

const CACHE_NAME = 'hubs-lab-v1.0.0';
const CACHE_URLS = [
  '/',
  '/index.html',
  '/about.html',
  '/research.html',
  '/people.html',
  '/teaching.html',
  '/joinus.html',
  '/director.html',
  '/css/styles.css',
  '/css/custom.css',
  '/css/index.css',
  '/js/scripts.js',
  '/js/index.js',
  '/assets/logo/hubs_logo_one_inch.png',
  '/assets/hubs_logo.ico',
  '/assets/background/bg-masthead.jpg',
  '/manifest.json'
];

// Install event - cache essential resources
self.addEventListener('install', event => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching essential resources');
        return cache.addAll(CACHE_URLS);
      })
      .then(() => {
        console.log('[SW] Installation complete');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Activation complete');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Skip external requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          console.log('[SW] Serving from cache:', event.request.url);
          return cachedResponse;
        }
        
        console.log('[SW] Fetching from network:', event.request.url);
        return fetch(event.request)
          .then(response => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Cache successful responses for future use
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch(() => {
            // Network failed, try to serve a fallback page for navigation requests
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
            }
          });
      })
  );
});

// Background sync for when connectivity is restored
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    console.log('[SW] Background sync triggered');
    event.waitUntil(
      // You can add background sync logic here
      // For example, sync form submissions or analytics
      Promise.resolve()
    );
  }
});

// Push notification support (for future use)
self.addEventListener('push', event => {
  console.log('[SW] Push message received');
  
  const options = {
    body: event.data ? event.data.text() : 'New update from HUBS Lab',
    icon: '/assets/logo/hubs_logo_one_inch.png',
    badge: '/assets/hubs_logo.ico',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'View Research',
        icon: '/assets/logo/hubs_logo_one_inch.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/assets/logo/hubs_logo_one_inch.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('HUBS Laboratory', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification click received');
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/research.html')
    );
  }
});
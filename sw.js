// LocalBazar Progressive Web App (PWA) Service Worker Engine v105
const CACHE_NAME = 'localbazar-pwa-v105';

// Only static shell assets & PWA icons (Dynamic pages like /explore and /account are NEVER pre-cached)
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/app-logo-hd-192.png',
  '/app-logo-hd-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.png',
  '/favicon.ico',
  '/apple-touch-icon.png'
];

// Install: Cache critical shell assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const asset of STATIC_ASSETS) {
        try {
          await cache.add(asset);
        } catch (e) {
          // Soft-fail
        }
      }
    })
  );
});

// Activate: Immediately purge all legacy cache versions (v90, etc.) and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log('[SW] Purging legacy cache:', key);
            return caches.delete(key);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Pure Network-First with Live Fresh Search
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 1. Bypass all server APIs and Next.js internal chunks
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/')) {
    return;
  }

  // 2. Bypass Firebase, Firestore, Google Auth/APIs, and external image CDNs
  if (
    url.origin.includes('firestore.googleapis.com') ||
    url.origin.includes('firebaseio.com') ||
    url.origin.includes('identitytoolkit') ||
    url.origin.includes('api.imgbb.com') ||
    url.origin.includes('googleapis.com') ||
    url.origin.includes('gstatic.com') ||
    url.origin.includes('googleusercontent.com') ||
    url.origin.includes('ibb.co')
  ) {
    return;
  }

  // 3. Dynamic Pages (/explore, /shops, /account, /admin): ALWAYS fresh network, NEVER hijacked by cache
  if (
    url.pathname.startsWith('/explore') ||
    url.pathname.startsWith('/shops') ||
    url.pathname.startsWith('/account') ||
    url.pathname.startsWith('/admin')
  ) {
    event.respondWith(
      fetch(event.request).catch(async () => {
        // If device is completely offline, return offline fallback
        const home = await caches.match('/');
        return home || new Response('Offline. Please reconnect to access LocalBazar.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      })
    );
    return;
  }

  // 4. Page Navigation (HTML Root /): Network-first with offline fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && url.pathname === '/') {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, copy);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const home = await caches.match('/');
          if (home) return home;
          return new Response('Offline. Please reconnect to access LocalBazar.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
        })
    );
    return;
  }

  // 5. Static Assets (PWA Icons, Manifest, Favicon): Cache First with Network Fallback
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        return cachedResponse || fetch(event.request);
      })
    );
  }
});

// Push Notifications Listener
self.addEventListener('push', (event) => {
  let data = {
    title: 'LocalBazar Alert',
    body: 'You have a new update in your city!',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    url: '/'
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    data: {
      url: data.url || '/'
    },
    vibrate: [100, 50, 100],
    actions: [
      { action: 'open', title: 'Open LocalBazar' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

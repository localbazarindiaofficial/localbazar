// LocalBazar Progressive Web App (PWA) Service Worker Engine v90
const CACHE_NAME = 'localbazar-pwa-v90';

// Next.js Production Core Assets (All legacy .html/.js prototype references removed)
const STATIC_ASSETS = [
  '/',
  '/explore',
  '/account',
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
          // Soft-fail for dynamic routes during build
        }
      }
    })
  );
});

// Activate: Immediately purge all legacy cache versions and claim clients
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

// Fetch: Cloudflare, Next.js & Mobile Safe Routing
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 1. Bypass all server APIs completely (Never cache auth, upload, or dynamic admin endpoints)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 2. Bypass webpack hot-module reload during development
  if (url.pathname.includes('/_next/webpack-hmr')) {
    return;
  }

  // 3. Bypass Firebase, Firestore, Google Auth/APIs, and external image CDNs
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

  // 4. Page Navigation (HTML Routes): Network-first with instant offline fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, copy);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // If offline, try cached version of the requested page
          const cached = await caches.match(event.request, { ignoreSearch: true });
          if (cached) return cached;

          // Fallback to cached home shell
          const home = await caches.match('/');
          if (home) return home;

          return new Response('You are offline. Please reconnect to access LocalBazar.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
        })
    );
    return;
  }

  // 5. Static Assets (Next.js Chunks, CSS, Icons, Fonts): Stale-While-Revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              const copy = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, copy);
              });
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
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
    icon: data.icon,
    badge: data.badge,
    data: { url: data.url },
    vibrate: [100, 50, 100]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('localbazar') && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

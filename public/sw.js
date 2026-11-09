// LocalBazar Progressive Web App (PWA) Service Worker Engine v108
const CACHE_NAME = 'localbazar-pwa-v108';

// Only lightweight static icons & manifest - NEVER CACHE HTML DOCUMENTS
const STATIC_ASSETS = [
  '/manifest.json',
  '/icon-192.png',
  '/favicon.png',
  '/apple-touch-icon.png'
];

// Install: Cache critical static shell icons only
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

// Activate: Immediately purge ALL legacy caches and claim clients
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

  // 1. ALL HTML navigations: ALWAYS bypass service worker and fetch LIVE network
  // This guarantees Next.js build chunks and RSC payloads NEVER mismatch or get stuck!
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          '<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Offline - LocalBazar</title><style>body{font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafc;color:#1e293b;text-align:center;padding:1.5rem}h2{font-size:1.4rem;margin-bottom:0.5rem}p{color:#64748b;margin-bottom:1.25rem}button{padding:0.75rem 1.5rem;background:#2563eb;color:#fff;border:none;border-radius:10px;font-weight:600;font-size:1rem;cursor:pointer}</style></head><body><div><h2>You are offline</h2><p>Please check your internet connection to continue browsing.</p><button onclick="window.location.reload()">Retry</button></div></body></html>',
          {
            status: 503,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          }
        );
      })
    );
    return;
  }

  // 2. Bypass all server APIs, Next.js internal chunks, and external CDNs
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/') ||
    url.searchParams.has('_rsc') ||
    url.origin.includes('firestore.googleapis.com') ||
    url.origin.includes('firebaseio.com') ||
    url.origin.includes('identitytoolkit') ||
    url.origin.includes('api.imgbb.com') ||
    url.origin.includes('googleapis.com') ||
    url.origin.includes('gstatic.com') ||
    url.origin.includes('googleusercontent.com') ||
    url.origin.includes('ibb.co')
  ) {
    return; // Let browser fetch natively
  }

  // 3. Static Assets (PWA Icons, Manifest, Favicon): Cache First with Network Fallback
  if (url.origin === self.location.origin) {
    const isStaticAsset = STATIC_ASSETS.some((a) => url.pathname === a);
    if (isStaticAsset) {
      event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
          return cachedResponse || fetch(event.request);
        })
      );
    }
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

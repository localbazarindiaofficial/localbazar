// LocalBazar Progressive Web App (PWA) Service Worker Engine v49
const CACHE_NAME = 'localbazar-pwa-v49';

const STATIC_ASSETS = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './push-service.js',
    './app-nav.js',
    './explore.html',
    './explore.css',
    './explore.js',
    './listing-detail.html',
    './listing-detail.css',
    './listing-detail.js',
    './store-category.html',
    './store-category.css',
    './store-category.js',
    './account.html',
    './account.css',
    './account.js',
    './pwa.css',
    './pwa.js',
    './manifest.json',
    './app-logo-hd-512.png',
    './app-logo-hd-192.png',
    './icons/app-logo-hd-512.png',
    './icons/app-logo-hd-192.png',
    './icon-1024.png',
    './icon-512.png',
    './icon-maskable-512.png',
    './icon-192.png',
    './icon-maskable-192.png',
    './icon.svg',
    './favicon.png',
    './favicon.ico',
    './apple-touch-icon.png',
    './icons/icon.svg',
    './icons/icon-1024.png',
    './icons/icon-512.png',
    './icons/icon-maskable-512.png',
    './icons/icon-192.png',
    './icons/icon-maskable-192.png',
    './icons/apple-touch-icon.png'
];

// Install: Cache core assets
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            for (const asset of STATIC_ASSETS) {
                try {
                    await cache.add(asset);
                } catch (e) {
                    console.info('PWA Asset cache skip:', asset);
                }
            }
        })
    );
});

// Activate: Immediately purge old cache versions and claim clients
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => {
                    console.log('Purging legacy cache:', key);
                    return caches.delete(key);
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch: Bulletproof Cloudflare & Mobile Safe Routing
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // Bypass Firebase, Firestore, Google Auth APIs, and external image CDNs
    if (url.origin.includes('firestore.googleapis.com') || 
        url.origin.includes('firebaseio.com') || 
        url.origin.includes('identitytoolkit') ||
        url.origin.includes('api.imgbb.com') ||
        url.origin.includes('googleapis.com') ||
        url.origin.includes('gstatic.com') ||
        url.origin.includes('ibb.co')) {
        return;
    }

    // 1. PAGE NAVIGATION (HTML Pages): Network-First, always safe
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(async () => {
                // Offline fallback: try to serve cached HTML page ignoring query strings
                const cached = await caches.match(event.request, { ignoreSearch: true });
                if (cached) return cached;
                const home = await caches.match('./index.html') || await caches.match('/');
                if (home) return home;
                return new Response('Network disconnected. Please check internet connection.', {
                    status: 503,
                    headers: { 'Content-Type': 'text/plain' }
                });
            })
        );
        return;
    }

    // 2. Only handle same-origin static assets
    if (url.origin !== self.location.origin) return;

    // 3. Stale-While-Revalidate for CSS, JS, Images
    event.respondWith(
        caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const copy = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, copy);
                    });
                }
                return networkResponse;
            }).catch(() => {
                return cachedResponse;
            });

            return cachedResponse || fetchPromise;
        }).catch(() => {
            return fetch(event.request);
        })
    );
});

// Push Notifications Listener
self.addEventListener('push', (event) => {
    let data = {
        title: 'LocalBazar Alert',
        body: 'You have a new update in your city!',
        icon: './icons/icon-192.png',
        badge: './icons/icon-192.png',
        url: './index.html'
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
    const targetUrl = (event.notification.data && event.notification.data.url) || './index.html';
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

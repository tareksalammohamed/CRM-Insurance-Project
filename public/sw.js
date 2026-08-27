// Standard PWA Service Worker
// Provides offline caching for the app shell/static assets and keeps
// itself auto-updated. Self-contained, no third-party dependency.

const CACHE_VERSION = 'v3';
const CACHE_NAME = `crm-insurance-cache-${CACHE_VERSION}`;

// Minimal app-shell precache. Vite-hashed build assets are cached on the
// fly via the fetch handler below, so we don't need to know their names
// ahead of time.
const PRECACHE_URLS = ['/', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  // Activate the new service worker as soon as it finishes installing,
  // so updates roll out automatically without waiting on old tabs to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data?.text() || '' };
  }

  const title = payload.title || 'إشعار جديد';
  const options = {
    body: payload.body || payload.message || '',
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/icon-192.png',
    tag: payload.tag || (payload.notification_id ? `crm-notification-${payload.notification_id}` : 'crm-notification'),
    renotify: true,
    dir: 'rtl',
    lang: 'ar',
    data: {
      url: payload.url || '/',
      notification_id: payload.notification_id || null,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const matchingClient = clientList.find((client) => client.url.startsWith(self.location.origin));
      if (matchingClient) {
        return matchingClient.focus().then(() => matchingClient.navigate(targetUrl));
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests; let everything else (POST/PUT/Supabase
  // API calls, etc.) pass straight through to the network untouched.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never intercept cross-origin API/backend calls (e.g. Supabase) —
  // those must always hit the network directly.
  if (url.origin !== self.location.origin) return;

  // Network-first for navigation requests, so users always get the
  // latest app shell when online, with an offline fallback from cache.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/', copy));
          return response;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Cache-first (with background refresh) for static build assets,
  // fonts, and icons — fast loads + offline support.
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});

// Allow the page to trigger an immediate update check/activation.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

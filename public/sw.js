// Standard PWA Service Worker
// Provides offline caching for the app shell/static assets and keeps
// itself auto-updated. Self-contained, no third-party dependency.

const CACHE_VERSION = 'v5-safe-updates';
const CACHE_NAME = `crm-insurance-cache-${CACHE_VERSION}`;

// Minimal app-shell precache. Vite-hashed build assets are cached on the
// fly via the fetch handler below, so we don't need to know their names
// ahead of time.
const PRECACHE_URLS = ['/', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  // Existing tabs keep their version until the user chooses Update now.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          // Keep the previous build for tabs still using its hashed chunks.
          keys.filter((key) => key.startsWith('crm-insurance-cache-') && key !== CACHE_NAME)
            .slice(0, -1).map((key) => caches.delete(key))
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
    icon: payload.icon || '/icons/insurance-crm-icon-192.png',
    badge: payload.badge || '/icons/insurance-crm-icon-192.png',
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
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  const save = async (key, response) => {
    if (!response.ok) return;
    try { await (await caches.open(CACHE_NAME)).put(key, response.clone()); }
    catch { /* Storage quota errors must not break a successful response. */ }
  };

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok && (response.headers.get('content-type') || '').includes('text/html')) {
          event.waitUntil(save('/', response));
          return response;
        }
        return (await caches.match('/')) || response;
      } catch {
        return (await caches.match('/')) || new Response(
          '<html lang="ar" dir="rtl"><meta charset="utf-8"><title>غير متصل</title><p>لا يوجد اتصال بالإنترنت. حاول فتح التطبيق مجددًا عند عودة الاتصال.</p></html>',
          { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }
    })());
    return;
  }

  // Do not cache same-origin API responses or unknown endpoints.
  if (!['script', 'style', 'font', 'image'].includes(request.destination) && url.pathname !== '/manifest.json') return;
  const immutable = url.pathname.startsWith('/assets/');
  event.respondWith((async () => {
    const cached = await caches.match(request);
    // Content-hashed build files never need a background request.
    if (cached && immutable) return cached;
    const networkFetch = fetch(request).then((response) => {
      if (response.ok) event.waitUntil(save(request, response));
      return response;
    });
    if (cached) {
      event.waitUntil(networkFetch.catch(() => undefined));
      return cached;
    }
    try { return await networkFetch; }
    catch { return new Response('', { status: 503, statusText: 'Offline' }); }
  })());
});

// Allow the page to trigger an immediate update check/activation.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

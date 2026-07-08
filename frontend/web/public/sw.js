const CACHE_VERSION = 'planora-pwa-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const OFFLINE_URL = '/offline.html';
const MAX_STATIC_CACHE_ENTRIES = 80;
const STATIC_ASSETS = [
  OFFLINE_URL,
  '/apple-touch-icon.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/maskable-512x512.png',
];

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isApiOrRealtimeRequest(url) {
  return (
    url.pathname.startsWith('/api/')
    || url.pathname.startsWith('/ws')
    || url.pathname.includes('/sockjs')
    || url.pathname.includes('/stomp')
  );
}

function isSensitiveStaticRequest(url) {
  return (
    url.pathname.includes('/download')
    || url.pathname.includes('/attachment')
    || url.pathname.includes('/attachments')
    || url.pathname.includes('/documents')
    || url.pathname.includes('/dms')
  );
}

function isNextStaticAsset(url) {
  return url.pathname.startsWith('/_next/static/');
}

function canCacheStaticRequest(request, url) {
  return (
    request.method === 'GET'
    && isSameOrigin(url)
    && !isApiOrRealtimeRequest(url)
    && !isSensitiveStaticRequest(url)
    && (
      isNextStaticAsset(url)
      || STATIC_ASSETS.includes(url.pathname)
    )
  );
}

function debugPwa(message, detail) {
  if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') {
    console.debug(`[planora-pwa] ${message}`, detail || '');
  }
}

async function trimStaticCache() {
  const cache = await caches.open(STATIC_CACHE);
  const keys = await cache.keys();
  if (keys.length <= MAX_STATIC_CACHE_ENTRIES) return;

  await Promise.all(keys.slice(0, keys.length - MAX_STATIC_CACHE_ENTRIES).map((key) => cache.delete(key)));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch(() => undefined),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    debugPwa('Applying waiting service worker');
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('planora-pwa-') && key !== STATIC_CACHE)
          .map((key) => caches.delete(key)),
      ))
      .then(() => (self.registration.navigationPreload?.enable?.() || Promise.resolve()))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || !isSameOrigin(url) || isApiOrRealtimeRequest(url)) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      Promise.resolve(event.preloadResponse)
        .then((preloadedResponse) => preloadedResponse || fetch(request))
        .catch(() => {
          debugPwa('Serving offline fallback', request.url);
          return caches.match(OFFLINE_URL);
        }),
    );
    return;
  }

  if (!canCacheStaticRequest(request, url)) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (!response || !response.ok || response.type !== 'basic') {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(STATIC_CACHE)
          .then((cache) => cache.put(request, responseToCache))
          .then(() => trimStaticCache())
          .catch(() => undefined);

        return response;
      });
    }),
  );
});

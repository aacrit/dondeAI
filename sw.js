/* ============================================
   DondeAI — Service Worker
   Cache-first for static assets, network-first for API,
   stale-while-revalidate for fonts.
   ============================================ */

const CACHE_VERSION = 'donde-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const FONT_CACHE = `${CACHE_VERSION}-fonts`;
const API_CACHE = `${CACHE_VERSION}-api`;

// Static assets to precache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/css/reset.css',
  '/css/tokens.css',
  '/css/fonts.css',
  '/css/themes/neutral.css',
  '/css/themes/indian.css',
  '/css/themes/japanese.css',
  '/css/themes/southamerican.css',
  '/css/themes/middleeastern.css',
  '/css/layout.css',
  '/css/typography.css',
  '/css/components/canvas.css',
  '/css/components/result.css',
  '/css/components/modals.css',
  '/css/components/ui.css',
  '/css/animations.css',
  '/css/responsive.css',
  '/js/app.js',
  '/img/icons.svg',
];

// ---- Install: precache static assets ----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ---- Activate: clean old caches ----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith('donde-') && !key.startsWith(CACHE_VERSION))
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ---- Fetch: strategy per request type ----
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http(s) schemes
  if (!url.protocol.startsWith('http')) return;

  // API calls: Network-first with cache fallback
  if (url.pathname.includes('/functions/v1/')) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // Font files: Stale-while-revalidate
  if (url.pathname.startsWith('/fonts/') || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(request, FONT_CACHE));
    return;
  }

  // Static assets (CSS, JS, images, HTML): Cache-first
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Everything else: network with cache fallback
  event.respondWith(networkFirst(request, STATIC_CACHE));
});

// ---- Strategies ----

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ success: false, recommendation: 'You appear to be offline.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  // Always revalidate in the background
  const fetchPromise = fetch(request)
    .then(response => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  // Return cached immediately if available, otherwise wait for network
  return cached || fetchPromise;
}

// ---- Helpers ----

function isStaticAsset(url) {
  const ext = url.pathname.split('.').pop()?.toLowerCase();
  return ['css', 'js', 'svg', 'png', 'jpg', 'jpeg', 'webp', 'ico', 'woff2', 'woff', 'json'].includes(ext)
    || url.pathname === '/'
    || url.pathname.endsWith('.html');
}

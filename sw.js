// Offline support: try the network first, fall back to the cached copy.
const CACHE = 'dayblock-v7';
const ASSETS = ['./', './index.html', './styles.css?v=7', './learn-content.js?v=7', './app.js?v=7', './auth.js?v=7', './firebase-config.js?v=7', './manifest.webmanifest', './icon.svg'];
// App files, Firebase SDK scripts and Google Fonts.
const CACHEABLE_HOSTS = [self.location.host, 'www.gstatic.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || !CACHEABLE_HOSTS.includes(url.host)) return;
  // Own files: always check with the server (skips the browser's 10-minute cache) so updates show at once.
  const fresh = url.host === self.location.host ? fetch(req, { cache: 'no-cache' }) : fetch(req);
  e.respondWith(
    fresh
      .then(res => {
        if (res.ok || res.type === 'opaque') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});

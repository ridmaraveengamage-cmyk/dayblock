// Offline support: try the network first, fall back to the cached copy.
const CACHE = 'dayblock-v2';
const ASSETS = ['./', './index.html', './styles.css', './app.js', './auth.js', './firebase-config.js', './manifest.webmanifest', './icon.svg'];
const CACHEABLE_HOSTS = [self.location.host, 'www.gstatic.com']; // app files + Firebase SDK scripts

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
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});

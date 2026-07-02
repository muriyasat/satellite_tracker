// ORBITAL service worker — caches the app shell so the installed app launches
// reliably (and offline for the shell). CDNs, map tiles, and TLE fetches are
// left untouched (network) so live behavior is unchanged when online.
const CACHE = 'orbital-shell-v1';
const SHELL = [
  './',
  'index.html',
  'satellite-tracker.html',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable.png',
  'apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // add each entry individually so a missing/renamed file doesn't abort the rest
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Only manage same-origin requests (the app shell). Let CDNs / OSM tiles / TLE
  // fetches go straight to the network so nothing about live tracking changes.
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // Network-first for the page itself, fall back to cached shell when offline.
    e.respondWith(
      fetch(req)
        .then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); return r; })
        .catch(() => caches.match(req).then((m) => m || caches.match('index.html') || caches.match('./')))
    );
    return;
  }
  // Cache-first for other same-origin assets (icons, manifest).
  e.respondWith(caches.match(req).then((m) => m || fetch(req)));
});

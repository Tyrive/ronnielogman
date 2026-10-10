// RonnieLogman Service Worker
// Bei jedem Update der App diese Versionsnummer erhöhen (z. B. v2, v3 ...).
const CACHE = 'ronnielogman-v6';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Datenbank und Login (Supabase) nie aus dem Cache bedienen
  if (new URL(req.url).hostname.endsWith('.supabase.co')) return;

  // Seitenaufrufe: erst Netz (damit Updates sofort ankommen), offline aus dem Cache
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); return res; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Alles andere (Icons, Schriften): aus dem Cache, im Hintergrund aktualisieren
  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req)
        .then(res => { if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; })
        .catch(() => cached);
      return cached || network;
    })
  );
});

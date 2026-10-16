// RonnieLogman Service Worker
// Bei jedem Update der App diese Versionsnummer erhöhen (z. B. v2, v3 ...).
const CACHE = 'ronnielogman-v34';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/ex/abduktion.svg',
  './icons/ex/beinbeuger-sitzend.svg',
  './icons/ex/beinpresse.svg',
  './icons/ex/beinstrecker.svg',
  './icons/ex/bizepscurl-maschine.svg',
  './icons/ex/butterfly-maschine.svg',
  './icons/ex/hackenschmidt.svg',
  './icons/ex/hammercurl.svg',
  './icons/ex/hip-thrust-maschine.svg',
  './icons/ex/latzug-nautilus.svg',
  './icons/ex/overhead-trizeps.svg',
  './icons/ex/reverse-butterfly.svg',
  './icons/ex/schraegbankdruecken-kh.svg',
  './icons/ex/schulterdruecken-kh.svg',
  './icons/ex/seitheben-maschine.svg',
  './icons/ex/trizepsdruecken-kabel.svg',
  './icons/ex/uni-hammercurl.svg',
  './icons/ex/vertical-chest-press.svg',
  './icons/ex/wadenheben-sitzend.svg'
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
      // 'no-cache': immer beim Server nachfragen, damit neue Versionen sofort ankommen (GitHub Pages cacht sonst bis zu 10 Min.)
      fetch(req, { cache: 'no-cache' })
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

// Tippen auf die Pausen-Mitteilung öffnet die App (oder holt sie in den Vordergrund)
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      return self.clients.openWindow ? self.clients.openWindow('./') : undefined;
    })
  );
});

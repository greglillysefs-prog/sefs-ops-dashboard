const SEFS_CACHE = 'sefs-pwa-v20260806a';
const SEFS_ASSETS = [
  './',
  './index.html',
  './employee-portal.html',
  './employee-admin.html',
  './mobile-job.html',
  './mobile-measure.html',
  './quote-builder.html',
  './quote-print.html',
  './weekly-timesheet-pdf.html',
  './privacy.html',
  './terms.html',
  './manifest.webmanifest',
  './employee-portal.webmanifest',
  './mobile-measure.webmanifest',
  './mobile-job.webmanifest',
  './pwa-init.js',
  './assets/sefs-icon.jpeg',
  './assets/sefs-app-icon-180.png',
  './assets/sefs-app-icon-192.png',
  './assets/sefs-app-icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SEFS_CACHE).then(cache => cache.addAll(SEFS_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== SEFS_CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  if (request.mode === 'navigate') {
    const page = url.pathname.endsWith('/employee-portal.html') ? './employee-portal.html'
      : url.pathname.endsWith('/mobile-job.html') ? './mobile-job.html'
      : url.pathname.endsWith('/mobile-measure.html') ? './mobile-measure.html'
      : url.pathname.endsWith('/employee-admin.html') ? './employee-admin.html'
      : './index.html';
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(SEFS_CACHE).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then(cached => cached || caches.match(page) || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      const fresh = fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(SEFS_CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});

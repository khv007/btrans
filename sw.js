// BOURKHAN TRANS - Progressive Web App (PWA) Service Worker
// Offline caching and background performance optimization

const CACHE_NAME = 'bourkhan-trans-v11';
const CORE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './style.css?v=4.8',
  './app.js',
  './app.js?v=4.8',
  './manifest.json',
  './favicon.ico',
  './favicon-16x16.png',
  './favicon-32x32.png',
  './apple-touch-icon.png',
  './android-chrome-192x192.png',
  './android-chrome-512x512.png'
];

// Install: Cache critical static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS).catch((err) => {
        console.warn('SW: Pre-caching non-fatal asset issue:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Network-First for core assets (CSS, JS, HTML), Cache-First for static media
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Ignore non-GET requests and browser extensions
  if (req.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // Realtime Firestore, Google APIs, and Auth should always go to network directly
  if (url.hostname.includes('firestore.googleapis.com') || 
      url.hostname.includes('identitytoolkit.googleapis.com') ||
      url.hostname.includes('firebaseio.com')) {
    return;
  }

  // Core app code (HTML, CSS, JS): Network-First ensures user ALWAYS gets the latest version immediately
  const isCoreAsset = url.pathname.endsWith('.css') || 
                      url.pathname.endsWith('.js') || 
                      url.pathname.endsWith('.html') || 
                      url.pathname === '/' || 
                      url.pathname.endsWith('/');

  if (isCoreAsset) {
    event.respondWith(
      fetch(req).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, responseToCache).catch(() => {});
          });
        }
        return networkResponse;
      }).catch(() => {
        // Fallback to cache when offline
        return caches.match(req, { ignoreSearch: true });
      })
    );
    return;
  }

  // Static images & icons: Cache-First
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(req).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, responseToCache).catch(() => {});
          });
        }
        return networkResponse;
      });
    })
  );
});

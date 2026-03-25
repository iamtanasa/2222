const CACHE_NAME = 'univers-2222-v3';

// Adaugă aici paginile principale și resursele esențiale
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/2222.html',
  '/style.css',
  '/script.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

// Keep-alive: ping periodic catre serverul Render pentru a nu se opri
const RENDER_HEALTH_URL = 'https://two222-h9x4.onrender.com/health';
const KEEP_ALIVE_INTERVAL = 4 * 60 * 1000; // 4 minute
let _keepAliveTimer = null;

function startKeepAlive() {
  if (_keepAliveTimer) return;
  _keepAliveTimer = setInterval(() => {
    fetch(RENDER_HEALTH_URL).catch(() => {});
  }, KEEP_ALIVE_INTERVAL);
}

self.addEventListener('message', (event) => {
  if (event.data === 'start-keep-alive') {
    startKeepAlive();
  }
  if (event.data === 'stop-keep-alive') {
    if (_keepAliveTimer) { clearInterval(_keepAliveTimer); _keepAliveTimer = null; }
  }
});

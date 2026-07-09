// Versiunea. O schimbi doar dacă vrei să golești forțat cache-ul vechi;
// actualizarea automată nu depinde de ea.
const CACHE_NAME = 'univers-2222-v6';

// Ce ținem offline, ca plasă de siguranță
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/2222.html',
  '/style.css',
  '/script.js'
];

self.addEventListener('install', (event) => {
  // Versiunea nouă preia imediat, fără să aștepte închiderea tuturor filelor.
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Fiecare fișier separat: dacă unul lipsește, instalarea nu cade toată.
      Promise.all(
        ASSETS_TO_CACHE.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => {})
        )
      )
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      // Preluăm controlul filelor deja deschise, ca să nu mai fie nevoie de refresh manual.
      .then(() => self.clients.claim())
  );
});

// REȚEA ÎNTÂI pentru tot ce e al nostru. Cache-ul se folosește doar când
// telefonul e offline. Varianta veche (cache întâi) servea fișiere vechi
// la nesfârșit, de asta trebuia ștearsă manual memoria site-ului.
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Supabase, fonturi, CDN-uri: le lăsăm în seama browserului.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached;
          if (request.mode === 'navigate') return caches.match('/index.html');
          return Response.error();
        })
      )
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

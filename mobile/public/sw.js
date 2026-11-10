/* Service worker de la PWA (/app/).
   Solo guarda archivos estáticos públicos: el código de la app (con hash en el nombre), las fuentes, los íconos
   y la página /app/ como respaldo sin conexión. Nunca guarda la API, el WebSocket ni los adjuntos, que tienen datos
   de las personas. */

const VERSION = 'tutoresonline-pwa-v1';

self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(VERSION).then((c) => c.addAll(['/app/'])).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function esEstatico(url) {
  return url.pathname.startsWith('/app/_expo/static/')
    || url.pathname.startsWith('/app/assets/')
    || /^\/(icono-\d+\.png|apple-touch-icon\.png|icono\.svg)$/.test(url.pathname);
}

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  if (pedido.method !== 'GET' || pedido.headers.has('Authorization')) return;
  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/ws')) return;

  // Página de la app: primero la red (para tener siempre la última versión) y, sin conexión, la guardada.
  if (pedido.mode === 'navigate' && url.pathname.startsWith('/app')) {
    evento.respondWith(
      fetch(pedido)
        .then((r) => {
          if (r.ok) { const copia = r.clone(); caches.open(VERSION).then((c) => c.put('/app/', copia)); }
          return r;
        })
        .catch(() => caches.match('/app/').then((r) => r || Response.error())),
    );
    return;
  }

  // Archivos con hash: de la caché si ya están; si no, de la red y se guardan.
  if (esEstatico(url)) {
    evento.respondWith(
      caches.match(pedido).then((guardada) => guardada || fetch(pedido).then((r) => {
        if (r.ok) { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(pedido, copia)); }
        return r;
      })),
    );
  }
});

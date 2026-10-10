/* eslint-disable no-restricted-globals */
// Incremente VERSION a cada mudança de estratégia/shell. Os bundles do CRA têm hash no nome,
// então são buscados na rede e guardados em runtime (stale-while-revalidate).
const VERSION = 'v3';
const SHELL_CACHE = `bohtreinar-shell-${VERSION}`;
const RUNTIME_CACHE = `bohtreinar-runtime-${VERSION}`;
const SHELL_ASSETS = ['/', '/index.html', '/manifest.json', '/favicon.ico', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];

// Nunca cacheia: Firebase/Google (Firestore, Auth, Storage, APIs).
const BYPASS_HOSTS = /(googleapis\.com|gstatic\.com|firebaseio\.com|firebaseapp\.com|google\.com|cloudfunctions\.net)$/;

self.addEventListener('install', (event) => {
  // Sem skipWaiting aqui: a atualização só ativa quando o usuário aceita (UpdateBanner).
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => /^(academyup|bohtreinar)-/.test(k) && k !== SHELL_CACHE && k !== RUNTIME_CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

const staleWhileRevalidate = async (request) => {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res && res.status === 200 && res.type === 'basic') cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
};

const networkFirstNavigation = async (request) => {
  try {
    const res = await fetch(request);
    if (res && res.status === 200) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put('/index.html', res.clone());
    }
    return res;
  } catch (e) {
    const cached = (await caches.match('/index.html')) || (await caches.match('/'));
    return cached || Response.error();
  }
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (BYPASS_HOSTS.test(url.hostname) || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }
  const isStatic = /\.(js|css|png|jpe?g|webp|gif|svg|ico|woff2?|json)$/i.test(url.pathname);
  if (isStatic) event.respondWith(staleWhileRevalidate(request));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) return c.focus();
      return self.clients.openWindow('/');
    })
  );
});

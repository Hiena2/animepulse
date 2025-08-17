self.addEventListener('install', (e) => {
  e.waitUntil(caches.open('animepulse-v1').then(cache => cache.addAll([
    './','./index.html','./app.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'
  ])));
  self.skipWaiting();
});
self.addEventListener('activate', (e)=> self.clients.claim());

self.addEventListener('fetch', (event) => {
  event.respondWith((async () => {
    try {
      const net = await fetch(event.request);
      return net;
    } catch (_) {
      const cached = await caches.match(event.request, {ignoreSearch:true});
      return cached || caches.match('./');
    }
  })());
});

// Web Push
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch(e){}
  const title = data.title || 'AnimePulse';
  const options = { body: data.body || 'New update', data: { url: data.url || '/' } };
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(clients.matchAll({ type:'window' }).then(list => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});

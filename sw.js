/* DANEGRAM service worker: push notifications only. Do not cache authenticated social content. */
self.addEventListener('install', event => { self.skipWaiting(); });
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('danegram-')).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; }
  catch (_) { payload = { body: event.data ? event.data.text() : '' }; }
  const title = String(payload.title || 'DANEGRAM').slice(0, 80);
  const options = {
    body: String(payload.body || 'You have a new notification.').slice(0, 180),
    icon: '/danegram-192.png',
    badge: '/danegram-192.png',
    data: { url: typeof payload.url === 'string' && payload.url.startsWith('/') ? payload.url : '/' },
    tag: payload.tag ? String(payload.tag).slice(0, 80) : 'danegram-notification'
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data && event.notification.data.url || '/';
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client) await client.navigate(new URL(target, self.location.origin).href);
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(new URL(target, self.location.origin).href);
  })());
});

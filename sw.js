// Jednoduchý service worker: umožní instalaci jako aplikace a start i při výpadku sítě.
// Data o vlacích (api.golemio.cz) se nikdy necachují.
var CACHE = 'odjezdy-v9';
var SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.indexOf('/api/') !== -1) return;
  // síť napřed (ať máš vždy nejnovější verzi stránky), cache jako záloha
  e.respondWith(fetch(e.request).then(function (r) {
    var copy = r.clone();
    caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
    return r;
  })['catch'](function () { return caches.match(e.request).then(function (m) { return m || caches.match('index.html'); }); }));
});

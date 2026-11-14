/* Service Worker: офлайн-режим курса MikroTik Академия */
const VERSION = 'mik-academy-v1';
const CORE = 'core-v1';
const MEDIA = 'media-v1';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/app.css',
  './assets/js/app.js',
  './assets/js/render.js',
  './assets/data/ch00-core.js',
  './assets/data/ch01-interfaces.js',
  './assets/data/ch02-ip-dhcp.js',
  './assets/data/ch03-routing.js',
  './assets/data/ch04-nat.js',
  './assets/data/ch05-firewall.js',
  './assets/data/ch06-queues.js',
  './assets/data/ch07-wifi.js',
  './assets/data/ch08-tunnels.js',
  './assets/data/ch09-security.js',
  './assets/data/ch10-automation.js',
  './assets/data/ch11-troubleshooting.js',
  './assets/data/ch12-advanced.js',
  './assets/data/ch13-exam.js',
  './assets/img/icon-192.png',
  './assets/img/icon-512.png',
  './assets/img/poster.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CORE).then((c) => c.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CORE && k !== MEDIA).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Видео: запросы с Range (перемотка) не кэшируем и отдаём как есть,
  // иначе медиаплеер получает полный файл вместо запрошенного куска.
  if (url.pathname.includes('/assets/media/video/')) {
    if (req.headers.has('range')) {
      e.respondWith(fetch(req));
      return;
    }
    e.respondWith(
      caches.open(MEDIA).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          if (res.ok) c.put(req, res.clone()).catch(() => {});
          return res;
        } catch (err) {
          return new Response('', { status: 504 });
        }
      })
    );
    return;
  }

  // Остальное: сначала сеть, при офлайне — кэш
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && req.url.indexOf('http') === 0) {
          const copy = res.clone();
          caches.open(CORE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
  );
});

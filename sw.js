/* Service worker — Trạm KV9 PWA
   Chiến lược: network-first cho điều hướng/tài nguyên (luôn lấy bản mới khi có mạng),
   tự động lưu cache để xem được khi offline. */
const CACHE = 'kv9-cache-v3';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './icon-maskable.svg',
  './img/hoinghi1.jpg',
  './img/hoinghi2.jpg',
  './img/hoinghi3.jpg',
  './img/bantin.jpg',
  './img/botruong.jpg',
  './img/dai.png',
  './img/vit.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        // Lưu lại bản mới nhất (chỉ với phản hồi hợp lệ cùng nguồn hoặc CORS ok)
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((r) => r || caches.match('./index.html'))
      )
  );
});

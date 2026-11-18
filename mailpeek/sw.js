const CACHE = 'mailpeek-1.0.0';
const FILES = ["./", "index.html", "styles.css", "app.js", "manifest.webmanifest", "privacy.html", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "vendor/postal-mime/address-parser.js", "vendor/postal-mime/base64-decoder.js", "vendor/postal-mime/base64-encoder.js", "vendor/postal-mime/decode-strings.js", "vendor/postal-mime/html-entities.js", "vendor/postal-mime/mime-node.js", "vendor/postal-mime/package.json", "vendor/postal-mime/pass-through-decoder.js", "vendor/postal-mime/postal-mime.js", "vendor/postal-mime/qp-decoder.js", "vendor/postal-mime/text-format.js", "vendor/zipout.js", "vendor/fflate.js", "vendor/pro.js", "vendor/nudge.js", "vendor/appkit.js", "src/mbox.js"];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => {
    const net = fetch(e.request, { cache: 'no-cache' }).then((r) => { if (r && r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); } return r; }).catch(() => hit || caches.match('index.html'));
    return hit || net;
  }));
});

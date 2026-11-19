const CACHE = 'pagestack-1.0.4';
const FILES = ["./", "index.html", "styles.css", "app.js", "manifest.webmanifest", "privacy.html", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "vendor/standard_fonts/FoxitDingbats.pfb", "vendor/standard_fonts/FoxitFixed.pfb", "vendor/standard_fonts/FoxitFixedBold.pfb", "vendor/standard_fonts/FoxitFixedBoldItalic.pfb", "vendor/standard_fonts/FoxitFixedItalic.pfb", "vendor/standard_fonts/FoxitSerif.pfb", "vendor/standard_fonts/FoxitSerifBold.pfb", "vendor/standard_fonts/FoxitSerifBoldItalic.pfb", "vendor/standard_fonts/FoxitSerifItalic.pfb", "vendor/standard_fonts/FoxitSymbol.pfb", "vendor/standard_fonts/LICENSE_FOXIT", "vendor/standard_fonts/LICENSE_LIBERATION", "vendor/standard_fonts/LiberationSans-Bold.ttf", "vendor/standard_fonts/LiberationSans-BoldItalic.ttf", "vendor/standard_fonts/LiberationSans-Italic.ttf", "vendor/standard_fonts/LiberationSans-Regular.ttf", "vendor/zipout.js", "vendor/fflate.js", "vendor/pro.js", "vendor/nudge.js", "vendor/more.js", "vendor/appkit.js", "vendor/pdf-lib.esm.min.js", "vendor/pdf.min.mjs", "vendor/pdf.worker.min.mjs", "i18n.js"];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => {
    const net = fetch(e.request, { cache: 'no-cache' }).then((r) => { if (r && r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); } return r; }).catch(() => hit || caches.match('index.html'));
    return hit || net;
  }));
});

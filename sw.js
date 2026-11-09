const C = "hogar-v2";
const ARCHIVOS = ["./", "index.html", "styles.css", "app.js", "config.js", "icon.svg", "manifest.webmanifest"];
self.addEventListener("install", e => e.waitUntil(caches.open(C).then(c => c.addAll(ARCHIVOS))));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k))))));
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const copia = r.clone(); caches.open(C).then(c => c.put(e.request, copia)); return r; }).catch(() => caches.match(e.request)));
});

// Gold Intelligence OS — Service Worker
// Cache strategy:
//   • Static assets (/_next/static, fonts, icons): cache-first
//   • API routes (/api/*): network-first, stale-while-revalidate fallback
//   • Navigation: network-first

const CACHE = "gios-v1";
const OFFLINE_URL = "/";

const PRECACHE = ["/", "/manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // API routes: network-first, 5-second timeout, no cache for most
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(
      Promise.race([
        fetch(request.clone()),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000)),
      ]).catch(() => caches.match(request))
    );
    return;
  }

  // Next.js static assets: cache-first
  if (url.pathname.startsWith("/_next/static/") || url.pathname.match(/\.(ico|png|svg|woff2?|ttf)$/)) {
    e.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (!res || res.status !== 200 || res.type === "opaque") return res;
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(request, clone));
          return res;
        });
      })
    );
    return;
  }

  // HTML pages: network-first, fall back to offline shell
  e.respondWith(
    fetch(request).catch(() =>
      caches.match(request).then((c) => c ?? caches.match(OFFLINE_URL))
    )
  );
});

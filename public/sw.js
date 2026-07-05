// Gold Intelligence OS — Service Worker (self-healing, network-first).
//
// History: an earlier version cached /_next/static/* CACHE-FIRST, which poisoned
// development with stale webpack chunks ("Cannot read properties of undefined
// (reading 'call')") that survived server restarts. This version:
//   • purges ALL caches on activate and reloads open tabs (so a poisoned page
//     recovers by itself on the next load — the browser fetches this sw.js at
//     the network level, bypassing the broken old worker),
//   • serves everything NETWORK-FIRST, falling back to cache only when offline,
//     so a chunk is never served stale. (Next.js prod assets are content-hashed,
//     so this stays fast in production.)

const CACHE = "gios-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Nuke every cache (including the poisoned gios-v1).
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.clients.claim();
      // Force-reload any open pages so a previously-broken tab recovers now.
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) {
        try {
          client.navigate(client.url);
        } catch {
          /* ignore */
        }
      }
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((res) => {
        // Keep a copy for offline fallback (network-first, so never stale online).
        if (res && res.status === 200 && res.type === "basic") {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(request, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(request).then((c) => c ?? caches.match("/")))
  );
});

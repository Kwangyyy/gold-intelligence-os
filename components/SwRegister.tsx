"use client";

import { useEffect } from "react";

// Registers the PWA service worker in PRODUCTION only.
//
// In development the SW's cache-first strategy for /_next/static/* serves stale
// webpack chunks after every edit, causing "Cannot read properties of undefined
// (reading 'call')" runtime errors. So in dev we do the opposite: unregister any
// existing SW and wipe its caches, so a previously-installed SW self-heals the
// moment this code runs.
export function SwRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {});
      if (typeof caches !== "undefined") {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
      }
      return;
    }

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);

  return null;
}

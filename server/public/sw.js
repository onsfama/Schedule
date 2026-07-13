self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// No caching strategy on purpose — always hit the network.
// This worker exists only to satisfy PWA installability criteria.
self.addEventListener("fetch", () => {});

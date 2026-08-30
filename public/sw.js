// Bewust geen cache. Chrome wil voor "app installeren" een service worker met een
// fetch-afhandelaar zien; alles cachen zou hier juist schaden, want de app toont
// saldo's en reserveringen die kloppen moeten. Dus: netjes doorgeven.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});

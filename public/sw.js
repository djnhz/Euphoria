// Bewust geen cache. Chrome wil voor "app installeren" een service worker met een
// fetch-afhandelaar zien; alles cachen zou hier juist schaden, want de app toont
// saldo's en reserveringen die kloppen moeten. Dus: netjes doorgeven.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});

// De server stuurt {titel, tekst, url} als JSON mee. Komt er niets bruikbaars binnen,
// dan tonen we alsnog iets: een lege melding is verwarrender dan een vage.
self.addEventListener("push", (event) => {
  let bericht = { titel: "Euphoria", tekst: "Er is iets bijgewerkt.", url: "/" };
  try {
    if (event.data) bericht = { ...bericht, ...event.data.json() };
  } catch {
    // Geen geldige JSON; de standaardtekst hierboven volstaat.
  }

  event.waitUntil(
    self.registration.showNotification(bericht.titel, {
      body: bericht.tekst,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      // Zelfde tag betekent: vervang de vorige van dit soort in plaats van stapelen.
      tag: bericht.url,
      data: { url: bericht.url },
    }),
  );
});

// Tikken op de melding brengt je naar het juiste scherm. Staat de app al open, dan
// gebruiken we dat venster in plaats van er nog een te openen.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const doel = new URL(event.notification.data?.url || "/", self.location.origin);

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((vensters) => {
        for (const venster of vensters) {
          if (new URL(venster.url).origin === doel.origin && "focus" in venster) {
            venster.navigate(doel.href);
            return venster.focus();
          }
        }
        return self.clients.openWindow(doel.href);
      }),
  );
});

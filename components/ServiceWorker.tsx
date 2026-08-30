"use client";

import { useEffect } from "react";

/**
 * Registreert de service worker. Die doet niets meer dan verzoeken doorgeven, maar is
 * wel wat Chrome op Android verlangt voordat het "app installeren" aanbiedt in plaats
 * van "snelkoppeling toevoegen".
 */
export default function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      // Mislukt registreren, dan werkt de app gewoon als website verder.
    });
  }, []);
  return null;
}

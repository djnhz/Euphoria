import type { MetadataRoute } from "next";

/**
 * Zonder manifest en service worker biedt Android alleen "snelkoppeling toevoegen".
 * Met allebei verschijnt "app installeren" en start hij zonder browserbalk.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Euphoria — bootfinanciën en vaarplanning",
    short_name: "Euphoria",
    description:
      "Bonnen, verrekening en vaarplanning voor de boot, gedeeld tussen twee huishoudens.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f1f5f9",
    theme_color: "#0f2f6b",
    lang: "nl",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android snijdt er zelf een vorm uit; daarvoor moet de boot ruim binnen de rand blijven.
      { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Bon indienen", url: "/uitgaven/nieuw" },
      { name: "Boot reserveren", url: "/vaarplanning" },
    ],
  };
}

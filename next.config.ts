import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native binaries en WebAssembly niet meebundelen maar als node_modules laden.
  serverExternalPackages: [
    "sharp",
    "@electric-sql/pglite",
    "pdfjs-dist",
    // Leest zijn lettertypebestanden (.afm) van schijf; gebundeld vindt hij ze niet.
    "pdfkit",
  ],

  /**
   * pdfjs laadt zijn worker met een dynamische import die niet in de code staat, dus
   * die ziet Vercel niet bij het inpakken en dan ontbreekt het bestand in productie:
   * "Cannot find module .../pdf.worker.mjs". Hier vragen we er expliciet om.
   */
  outputFileTracingIncludes: {
    "/**": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
    // De PDF van de begroting leest zijn lettertypes en het logo van schijf. Alleen
    // bij die pagina meegeven; de rest van de app heeft ze niet nodig.
    "/begroting": [
      "./node_modules/pdfkit/js/data/*.afm",
      "./node_modules/@fontsource/newsreader/files/newsreader-latin-500-normal.woff",
      "./node_modules/@fontsource/archivo/files/archivo-latin-400-normal.woff",
      "./node_modules/@fontsource/archivo/files/archivo-latin-600-normal.woff",
      "./node_modules/@ibm/plex-mono/fonts/complete/woff/IBMPlexMono-Regular.woff",
      "./node_modules/@ibm/plex-mono/fonts/complete/woff/IBMPlexMono-Medium.woff",
      "./public/euphoria-logo-donker-v2.png",
    ],
  },
};

export default nextConfig;

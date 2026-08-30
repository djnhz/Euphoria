import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native binaries en WebAssembly niet meebundelen maar als node_modules laden.
  serverExternalPackages: ["sharp", "@electric-sql/pglite", "pdfjs-dist"],

  /**
   * pdfjs laadt zijn worker met een dynamische import die niet in de code staat, dus
   * die ziet Vercel niet bij het inpakken en dan ontbreekt het bestand in productie:
   * "Cannot find module .../pdf.worker.mjs". Hier vragen we er expliciet om.
   */
  outputFileTracingIncludes: {
    "/**": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
  },
};

export default nextConfig;

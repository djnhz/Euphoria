import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native binaries en WebAssembly niet meebundelen maar als node_modules laden.
  serverExternalPackages: ["sharp", "@electric-sql/pglite"],
};

export default nextConfig;

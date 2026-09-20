import type { NextConfig } from "next";
import { STATIC_SECURITY_HEADERS } from "./lib/security/headers";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Låter en produktionsbyggd kopia köra bredvid dev-servern utan att de skriver
  // över varandras .next-katalog: NEXT_DIST_DIR=.next-prod npx next build && npx next start -p 3001
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    authInterrupts: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        // Innehållspolicyn (CSP) sätts i middleware.ts eftersom den innehåller en nonce.
        headers: [...STATIC_SECURITY_HEADERS],
      },
    ];
  },
};

export default nextConfig;

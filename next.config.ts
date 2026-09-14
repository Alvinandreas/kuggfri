import type { NextConfig } from "next";

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
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;

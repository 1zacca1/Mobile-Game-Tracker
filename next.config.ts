import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["google-play-scraper"],
  // The site is a single page for now: send the retired section URLs home.
  // (/admin stays reachable by direct URL, key-protected.)
  async redirects() {
    return ["/monthly", "/compare", "/signals"].map((source) => ({ source, destination: "/", permanent: false }));
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true, // Required for Cloudflare Pages
  },
  experimental: {
    serverActions: true,
  },
};

export default nextConfig;

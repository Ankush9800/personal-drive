import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true // Required for Cloudflare Pages
  },
  experimental: {
    serverActions: {
      allowedOrigins: ["*"],
      bodySizeLimit: '2mb'
    }
  },
  // Required for Cloudflare Pages
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    return config;
  },
};

export default nextConfig;

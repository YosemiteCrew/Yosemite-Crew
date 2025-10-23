import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: [
      "d2il6osz49gpup.cloudfront.net",
      "d2kyjiikho62xx.cloudfront.net",
      "images.unsplash.com",
      "plus.unsplash.com", // ✅ add this!
      "yosemitecrew-backend.s3.eu-central-1.amazonaws.com",
    ],
  },
  outputFileTracingExcludes: {
    "/*": ["**/.pnpm/**", "**/node_modules/.pnpm/**", "**/.turbo/**"],
  },
  experimental: {
    webpackMemoryOptimizations: true,
    serverSourceMaps: false,
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: [
      "d2il6osz49gpup.cloudfront.net",
      "images.unsplash.com", // ✅ added Unsplash domain
    ],
  },
};

export default nextConfig;

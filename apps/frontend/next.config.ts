import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: [
      "d2il6osz49gpup.cloudfront.net",
      "d2kyjiikho62xx.cloudfront.net",
      "images.unsplash.com", // ✅ added Unsplash domain
      "yosemitecrew-backend.s3.eu-central-1.amazonaws.com"
    ],
  },
};

export default nextConfig;

import type { NextConfig } from "next";
import { resolve } from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: resolve(__dirname),
  },
  async redirects() {
    return [{ source: "/topology", destination: "/food-web", permanent: true }];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Skip linting in CI builds until legacy files can be cleaned up.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;

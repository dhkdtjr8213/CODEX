import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@household/types", "@household/config", "@household/ui"]
};

export default nextConfig;


import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.29.230"],
  // Remotion uses platform-specific native binaries — never bundle them
  serverExternalPackages: [
    "@remotion/renderer",
    "@remotion/bundler",
    "@remotion/captions",
    "remotion",
  ],
};

export default nextConfig;

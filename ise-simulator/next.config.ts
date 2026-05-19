import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Exclude msedge-tts from webpack bundling so Node.js resolves it natively.
  // This lets ws handle the optional 'bufferutil' require with its own try/catch
  // fallback instead of webpack stubbing it as an empty module.
  serverExternalPackages: ["msedge-tts"],
};

export default nextConfig;

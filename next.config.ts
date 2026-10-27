import type { NextConfig } from "next";
import os from "os";

function getLocalNetworkOrigins(): string[] {
  const origins: string[] = [
    "localhost",
    "localhost:3000",
    "127.0.0.1",
    "127.0.0.1:3000",
    "*.trycloudflare.com",
    "*.codeplay.web.id",
  ];

  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === "IPv4" && !iface.internal) {
          origins.push(iface.address);
          origins.push(`${iface.address}:3000`);
        }
      }
    }
  } catch (err) {
    console.error("Failed to detect network interfaces:", err);
  }

  return Array.from(new Set(origins));
}

const localOrigins = getLocalNetworkOrigins();

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: localOrigins,
  experimental: {
    agentFeedback: true,
    serverActions: {
      allowedOrigins: localOrigins,
    },
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

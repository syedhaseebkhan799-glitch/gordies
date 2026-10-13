import type { NextConfig } from "next";

// Static export: the app becomes plain HTML/JS files, so the same build
// can later be packed into the Android APK (Capacitor) and Windows .exe (Electron).
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
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

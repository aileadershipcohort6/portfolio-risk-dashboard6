import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist ships browser-only code; nothing here needs a Node polyfill.
  // Everything in this app is client-side, so no server/runtime config is needed.
  reactStrictMode: true,
};

export default nextConfig;

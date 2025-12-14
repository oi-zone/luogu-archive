import type { NextConfig } from "next";

const { UMAMI_SCRIPT_URL } = process.env;

const nextConfig: NextConfig = {
  rewrites: () =>
    UMAMI_SCRIPT_URL
      ? [{ source: "/script.js", destination: UMAMI_SCRIPT_URL }]
      : [],
  serverExternalPackages: ["pg"],
};

export default nextConfig;

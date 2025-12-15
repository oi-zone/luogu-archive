import type { NextConfig } from "next";

const { UMAMI_SCRIPT_URL } = process.env;

const nextConfig: NextConfig = {
  rewrites: () => [
    ...(UMAMI_SCRIPT_URL
      ? [{ source: "/script.js", destination: UMAMI_SCRIPT_URL }]
      : []),
    {
      source: "/a/:id@:snapshot",
      destination: "/a/:id/:snapshot",
    },
    {
      source: "/d/:id@:snapshot",
      destination: "/d/:id/:snapshot",
    },
    {
      source: "/p/:id@:snapshot",
      destination: "/p/:id/:snapshot",
    },
  ],
  serverExternalPackages: ["pg"],
};

export default nextConfig;

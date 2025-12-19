import type { NextConfig } from "next";
import createMDX from "@next/mdx";

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
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
};

const withMDX = createMDX({});

export default withMDX(nextConfig);

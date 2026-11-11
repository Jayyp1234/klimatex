import type { NextConfig } from "next";

// Static export: `npm run build` writes plain files to out/, which the existing
// PHP/Apache container can serve. No separate Node pod is needed in the team quota.
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

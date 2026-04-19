import type { NextConfig } from "next";

const isGitHubPagesBuild = process.env.NEXT_EXPORT_GH_PAGES === "true";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: !isGitHubPagesBuild,
  ...(isGitHubPagesBuild
    ? {
        output: "export",
        basePath: "/codex",
        assetPrefix: "/codex/",
        trailingSlash: true,
        images: {
          unoptimized: true,
        },
      }
    : {}),
};

export default nextConfig;

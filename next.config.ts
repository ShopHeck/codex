import type { NextConfig } from "next";

const isGitHubPagesBuild = process.env.NEXT_EXPORT_GH_PAGES === "true";
const gitHubPagesBasePath = process.env.NEXT_EXPORT_BASE_PATH || "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: !isGitHubPagesBuild,
  ...(isGitHubPagesBuild
    ? {
        output: "export",
        basePath: gitHubPagesBasePath,
        assetPrefix: gitHubPagesBasePath || "/",
        trailingSlash: true,
        images: {
          unoptimized: true,
        },
      }
    : {}),
};

export default nextConfig;

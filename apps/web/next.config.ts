import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@fable/api", "@fable/ui", "@fable/auth", "@fable/logger"],
  output: "standalone",
  serverExternalPackages: ["better-auth", "@better-auth/kysely-adapter", "kysely"],
  experimental: {
    swcPlugins: [["@lingui/swc-plugin", {}]],
  },
};

export default nextConfig;

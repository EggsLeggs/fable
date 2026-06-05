import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@overmind-lab/trace-sdk"],
  serverExternalPackages: [
    "@opentelemetry/sdk-node",
    "@opentelemetry/exporter-trace-otlp-proto",
    "@opentelemetry/otlp-exporter-base",
    "@opentelemetry/sdk-trace-base",
    "@opentelemetry/sdk-trace-node",
  ],
};

export default nextConfig;

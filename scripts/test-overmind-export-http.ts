/**
 * Logs raw HTTP status from Overmind OTLP export.
 * npx tsx scripts/test-overmind-export-http.ts
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

async function main() {
  const apiKey = process.env.OVERMIND_API_KEY!;
  const url = "https://api.overmindlab.ai/api/v1/traces";

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const res = await originalFetch(input, init);
    const body = await res.clone().text();
    console.log("\n=== OTLP HTTP ===");
    console.log("URL:", input);
    console.log("Status:", res.status, res.statusText);
    console.log("Response headers:", Object.fromEntries(res.headers.entries()));
    console.log("Response body (first 500 chars):", body.slice(0, 500));
    return res;
  };

  const exporter = new OTLPTraceExporter({
    url,
    headers: { "X-Api-Key": apiKey },
  });

  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: "sentinel",
      "overmind.sdk.name": "overmind-js",
      "overmind.sdk.version": "0.0.6",
    }),
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });
  provider.register();

  const tracer = provider.getTracer("test");
  const span = tracer.startSpan("manual-test-span");
  span.setAttribute("gen_ai.system", "test");
  span.setAttribute("gen_ai.request.model", "gpt-4o-mini");
  span.end();

  await provider.shutdown();
  globalThis.fetch = originalFetch;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// @ts-nocheck — trace-sdk ships raw .ts; we use its instrumentation with a fixed OTLP exporter.
import "./overmind-https-patch";
import { getLastIngest } from "./overmind-https-patch";
export { getLastIngest };
export type { IngestResult } from "./overmind-https-patch";

import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  SimpleSpanProcessor,
  type SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import OpenAI from "openai";

const SDK_VERSION = "0.0.6";

let sdk: NodeSDK | null = null;
let spanProcessor: SpanProcessor | null = null;
let openaiInstrumented = false;

export type InitOptions = {
  apiKey?: string;
  serviceName?: string;
  baseUrl?: string;
};

function resolveServiceName(options: InitOptions): string {
  return (
    options.serviceName ??
    process.env.OVERMIND_SERVICE_NAME ??
    "sentinel"
  );
}

/**
 * Overmind PATH B tracing.
 * @see https://docs.overmindlab.ai/guides/integrations
 * Ingest: POST {baseUrl}/api/v1/traces  Header: X-Api-Key
 * (Official Python/JS SDKs still send X-API-Token → 401 on current API.)
 */
export function init(options: InitOptions = {}) {
  const apiKey = options.apiKey ?? process.env.OVERMIND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[overmind] OVERMIND_API_KEY not set — traces will not be sent");
    }
    return false;
  }

  const baseUrl =
    options.baseUrl ??
    process.env.OVERMIND_TRACES_URL ??
    "https://api.overmindlab.ai";
  const appName = resolveServiceName(options);

  if (!sdk) {
    const traceExporter = new OTLPTraceExporter({
      url: `${baseUrl}/api/v1/traces`,
      headers: { "X-Api-Key": apiKey },
    });

    spanProcessor = new SimpleSpanProcessor(traceExporter);

    const { OpenAIInstrumentation } = require("@overmind-lab/trace-sdk");
    const instrumentations = [];
    if (!openaiInstrumented) {
      const openaiInstrumentation = new OpenAIInstrumentation({ enabled: true });
      openaiInstrumentation.manuallyInstrument(OpenAI);
      instrumentations.push(openaiInstrumentation);
      openaiInstrumented = true;
    }

    const resource = resourceFromAttributes({
      [ATTR_SERVICE_NAME]: appName,
      [ATTR_SERVICE_VERSION]: SDK_VERSION,
      "deployment.environment":
        process.env.DEPLOYMENT_ENVIRONMENT ??
        process.env.OVERMIND_ENVIRONMENT ??
        "development",
      "overmind.sdk.name": "overmind-js",
      "overmind.sdk.version": SDK_VERSION,
    });

    sdk = new NodeSDK({
      resource,
      spanProcessors: [spanProcessor],
      instrumentations,
    });
    sdk.start();
  }

  return true;
}

export async function flushOvermind(): Promise<void> {
  if (spanProcessor && "forceFlush" in spanProcessor) {
    await spanProcessor.forceFlush();
  }
}

export async function shutdownOvermind(): Promise<void> {
  if (!sdk) return;
  await sdk.shutdown();
  sdk = null;
  spanProcessor = null;
}

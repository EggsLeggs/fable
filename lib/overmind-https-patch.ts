// @ts-nocheck
/**
 * Must load before OpenTelemetry HTTP transport. Patched via instrumentation.ts + overmind.ts.
 */
import type { IncomingMessage, RequestOptions } from "http";
import type { ClientRequest } from "http";

export type IngestResult = {
  status: number;
  body: string;
  parsed?: { spans_ingested?: number; spans_post_processed?: number; error?: string };
};

let lastIngest: IngestResult | null = null;

export function getLastIngest(): IngestResult | null {
  return lastIngest;
}

function patchHttpsModule(mod: {
  request: typeof import("https").request;
  __overmindPatched?: boolean;
}) {
  if (mod.__overmindPatched) return;
  mod.__overmindPatched = true;

  const origRequest = mod.request;
  mod.request = function (
    options: RequestOptions | string,
    callback?: (res: IncomingMessage) => void
  ): ClientRequest {
    const path =
      typeof options === "object" && options.path ? String(options.path) : "";
    const req = origRequest.call(
      mod,
      options as RequestOptions,
      (res: IncomingMessage) => {
        if (path.includes("/api/v1/traces")) {
          const chunks: Buffer[] = [];
          res.on("data", (c: Buffer) => chunks.push(c));
          res.on("end", () => {
            const body = Buffer.concat(chunks).toString();
            let parsed: IngestResult["parsed"];
            try {
              parsed = JSON.parse(body);
            } catch {
              parsed = undefined;
            }
            lastIngest = { status: res.statusCode ?? 0, body, parsed };
            if (process.env.OVERMIND_DEBUG === "1") {
              console.log("[overmind] ingest", res.statusCode, body);
            }
          });
        }
        callback?.(res);
      }
    );
    return req;
  } as typeof mod.request;
}

export function patchOvermindHttps() {
  for (const id of ["https", "node:https"]) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      patchHttpsModule(require(id));
    } catch {
      // not available
    }
  }
}

patchOvermindHttps();

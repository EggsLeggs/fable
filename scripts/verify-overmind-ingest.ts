/**
 * Verifies Overmind ingest; prints one JSON line to stdout.
 * Used by POST /api/overmind/ping when in-process capture is unavailable.
 */
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local"), quiet: true });

import OpenAI from "openai";
import { flushOvermind, getLastIngest, init, shutdownOvermind } from "../lib/overmind";

async function main() {
  const serviceName = process.env.OVERMIND_SERVICE_NAME ?? "sentinel";
  init({ serviceName });
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 5,
    messages: [{ role: "user", content: "hi" }],
  });
  await flushOvermind();
  await shutdownOvermind();
  await new Promise((r) => setTimeout(r, 500));

  const ingest = getLastIngest();
  const ingested = ingest?.parsed?.spans_ingested ?? 0;
  console.log(
    JSON.stringify({
      ok: ingest?.status === 200 && ingested >= 1,
      serviceName,
      ingest: ingest?.parsed ?? null,
      ingestStatus: ingest?.status,
    })
  );
}

main().catch((e) => {
  console.log(JSON.stringify({ ok: false, error: String(e) }));
  process.exit(1);
});

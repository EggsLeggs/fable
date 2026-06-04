/**
 * Manual Overmind trace test — run: npx tsx scripts/test-overmind.ts
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import OpenAI from "openai";
import { flushOvermind, init, shutdownOvermind } from "../lib/overmind";

async function main() {
  console.log("OVERMIND_API_KEY set:", !!process.env.OVERMIND_API_KEY);
  console.log("OPENAI_API_KEY set:", !!process.env.OPENAI_API_KEY);

  if (!process.env.OVERMIND_API_KEY || !process.env.OPENAI_API_KEY) {
    console.error("Missing keys in .env.local");
    process.exit(1);
  }

  init({ serviceName: "sentinel-test" });

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  console.log("Calling OpenAI gpt-4o-mini…");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 16,
    messages: [{ role: "user", content: "Reply with exactly: trace-ok" }],
  });

  console.log("Completion:", response.choices[0]?.message?.content?.trim());
  console.log("Flushing traces to api.overmindlab.ai/api/v1/traces …");
  await flushOvermind();
  await shutdownOvermind();
  console.log(
    "Done. In console.overmindlab.ai look for service “sentinel-test” under tracing/telemetry."
  );
  console.log(
    "Note: /agents may stay empty until you register an agent via the Python CLI (PATH A)."
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

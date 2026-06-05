/**
 * Verbose Overmind export test — npx tsx scripts/test-overmind-verbose.ts
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

process.env.OTEL_LOG_LEVEL = "debug";

import OpenAI from "openai";
import { init, shutdownOvermind } from "../lib/overmind";

async function main() {
  const key = process.env.OVERMIND_API_KEY;
  if (!key || !process.env.OPENAI_API_KEY) {
    console.error("Set OVERMIND_API_KEY and OPENAI_API_KEY in .env.local");
    process.exit(1);
  }

  console.log("Key prefix:", key.slice(0, 12) + "…");

  init({ serviceName: "sentinel-verbose-test" });

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 8,
    messages: [{ role: "user", content: "Say hi" }],
  });

  console.log("\n--- shutting down SDK (watch export HTTP status above) ---\n");
  await shutdownOvermind();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

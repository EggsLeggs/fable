import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import OpenAI from "openai";
import {
  flushOvermind,
  getLastIngest,
  init,
  shutdownOvermind,
} from "@/lib/overmind";

const execFileAsync = promisify(execFile);

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function verifyViaSubprocess(serviceName: string) {
  const { stdout } = await execFileAsync(
    "npx",
    ["tsx", "scripts/verify-overmind-ingest.ts"],
    {
      cwd: process.cwd(),
      env: process.env as NodeJS.ProcessEnv,
      timeout: 55_000,
    }
  );
  const line = stdout.trim().split("\n").pop() ?? "{}";
  return JSON.parse(line) as {
    ok: boolean;
    ingest?: { spans_ingested?: number };
    ingestStatus?: number;
    error?: string;
  };
}

/**
 * POST /api/overmind/ping — one traced LLM call; returns Overmind ingest stats.
 */
export async function POST() {
  if (!process.env.OVERMIND_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "OVERMIND_API_KEY is not set in .env.local" },
      { status: 500 }
    );
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "OPENAI_API_KEY is not set in .env.local" },
      { status: 500 }
    );
  }

  const serviceName = process.env.OVERMIND_SERVICE_NAME ?? "sentinel";
  const started = Date.now();

  if (!init({ serviceName })) {
    return NextResponse.json(
      { ok: false, error: "Overmind init failed (missing API key)" },
      { status: 500 }
    );
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 8,
      messages: [{ role: "user", content: "Reply with exactly: ping" }],
    });
    await flushOvermind();
    await shutdownOvermind();
    await new Promise((r) => setTimeout(r, 800));
    init({ serviceName });

    let ingest = getLastIngest();
    let verified = ingest?.parsed;
    let ok =
      ingest != null &&
      ingest.status === 200 &&
      (verified?.spans_ingested ?? 0) >= 1;

    // Next.js may bundle OTel before our https patch; fall back to subprocess check.
    if (!ok) {
      const sub = await verifyViaSubprocess(serviceName);
      ok = sub.ok;
      verified = sub.ingest;
      ingest = sub.ingestStatus
        ? { status: sub.ingestStatus, body: "", parsed: sub.ingest }
        : null;
    }

    return NextResponse.json({
      ok,
      serviceName,
      completion: response.choices[0]?.message?.content?.trim(),
      latencyMs: Date.now() - started,
      ingest: verified ?? null,
      ingestStatus: ingest?.status,
      hint: ok
        ? `Overmind accepted the trace (spans_ingested=${verified?.spans_ingested ?? "?"}). In console, open your **Sentinel** project → **Traces**, set time range to Last 24 hours, and look for service.name "${serviceName}".`
        : "API did not confirm span ingestion. Use an API key from Sentinel → Project Settings, add OVERMIND_SERVICE_NAME=sentinel to .env.local, restart npm run dev.",
      consoleUrl: "https://console.overmindlab.ai",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[overmind/ping]", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

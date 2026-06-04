import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { getAuthorizedCampaign } from "@/lib/campaign-auth";
import { dbCampaignToAgentCampaign } from "@/lib/campaigns-db";
import { SCENARIO_CATEGORIES } from "@/lib/scenario-categories";
import { createScenarios } from "@/lib/scenarios-db";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  prompt: z.string().min(3).max(1000),
  count: z.number().int().min(1).max(8).optional(),
});

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1),
});

const scenarioSchema = z.object({
  label: z.string().min(1).max(200),
  category: z.enum(SCENARIO_CATEGORIES),
  messages: z.array(messageSchema).min(1).max(20),
});

const outputSchema = z.object({
  scenarios: z.array(scenarioSchema).min(1).max(8),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await getAuthorizedCampaign(id);
  if (!authResult) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OpenAI is not configured" },
      { status: 503 }
    );
  }

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid prompt" },
      { status: 400 }
    );
  }

  const count = parsed.data.count ?? 1;
  const campaign = dbCampaignToAgentCampaign(authResult.campaign);
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.6,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You create realistic AI chat conversation scenarios for testing an autonomous ad placement agent.
Return JSON: { "scenarios": Array<{ label, category, messages }> } with exactly ${count} scenario(s).

Each scenario:
- label: short human-readable title (e.g. "High intent — marathon training")
- category: one of ${SCENARIO_CATEGORIES.join(", ")}
  - success: high purchase intent, good ad context
  - safety: brand safety risk (controversy, negative press about advertiser)
  - muted: no commercial intent (weather, small talk)
  - warning: medium intent, borderline fit
  - blocked: touches blocked topics: ${campaign.blockedTopics.join(", ") || "none"}
- messages: 2-4 turns alternating user/assistant in a ChatGPT-style thread relevant to ${campaign.advertiser}

Campaign: ${campaign.name} (${campaign.advertiser}). Goal: ${campaign.goal || "general"}. Max CPM $${campaign.maxCPM}.
Brand keywords: ${campaign.brandKeywords.join(", ") || "none"}.`,
        },
        {
          role: "user",
          content: parsed.data.prompt,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return NextResponse.json({ error: "No response from model" }, { status: 502 });
    }

    const json = JSON.parse(raw) as unknown;
    const result = outputSchema.safeParse(json);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid model output" }, { status: 502 });
    }

    const scenarios = await createScenarios(id, result.data.scenarios);
    return NextResponse.json({ scenarios, source: "ai" as const });
  } catch (err) {
    console.error("scenario generation failed", err);
    return NextResponse.json({ error: "Failed to generate scenarios" }, { status: 500 });
  }
}

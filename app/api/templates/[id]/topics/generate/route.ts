import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { getAuthorizedTemplate } from "@/lib/template-auth";
import { dbTemplateToAgentCampaign } from "@/lib/templates-db";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  prompt: z.string().min(3).max(500),
});

const topicsSchema = z.object({
  topics: z.array(z.string().min(1).max(80)).min(1).max(20),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await getAuthorizedTemplate(id);
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

  const campaign = dbTemplateToAgentCampaign(authResult.template);
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You help media buyers define blocked conversation topics for brand safety.
Return JSON: { "topics": string[] } with 5-12 short lowercase topic phrases (1-4 words each).
Topics should be things an AI ad agent would detect in chat and avoid placing ads near.
Do not duplicate existing blocked topics: ${campaign.blockedTopics.join(", ") || "none"}.
Template: ${campaign.name} (${campaign.advertiser}). Goal: ${campaign.goal || "general brand safety"}.`,
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
    const result = topicsSchema.safeParse(json);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid model output" }, { status: 502 });
    }

    const normalized = [
      ...new Set(
        result.data.topics.map((t) => t.trim().toLowerCase()).filter(Boolean)
      ),
    ];

    return NextResponse.json({ topics: normalized, source: "ai" as const });
  } catch (err) {
    console.error("topic generation failed", err);
    return NextResponse.json({ error: "Failed to generate topics" }, { status: 500 });
  }
}

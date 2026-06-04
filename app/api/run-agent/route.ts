import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { runDecisionAgentWithTracing } from "@/lib/agent";
import { getAuthorizedCampaign } from "@/lib/campaign-auth";
import { dbCampaignToAgentCampaign } from "@/lib/campaigns-db";
import { getScenarioById } from "@/lib/scenarios-db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const campaignId = body.campaignId as string | undefined;
  if (!campaignId) {
    return NextResponse.json({ error: "campaignId required" }, { status: 400 });
  }

  const authResult = await getAuthorizedCampaign(campaignId);
  if (!authResult) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let messages = body.messages as { role: "user" | "assistant"; content: string }[] | undefined;
  if (body.scenarioId) {
    const scenario = await getScenarioById(campaignId, body.scenarioId as string);
    if (!scenario) {
      return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
    }
    messages = scenario.messages;
  }
  if (!messages) {
    return NextResponse.json({ error: "No messages" }, { status: 400 });
  }

  const campaign = dbCampaignToAgentCampaign(authResult.campaign);
  await runDecisionAgentWithTracing(campaignId, messages, campaign);
  return NextResponse.json({ ok: true });
}

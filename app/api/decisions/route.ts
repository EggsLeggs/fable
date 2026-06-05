import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { getAuthorizedCampaign } from "@/lib/campaign-auth";
import { dbCampaignToAgentCampaign } from "@/lib/campaigns-db";
import { clearDecisions, getDecisions } from "@/lib/store";

export async function DELETE(req: NextRequest) {
  const campaignId = req.nextUrl.searchParams.get("campaignId");
  if (!campaignId) {
    return NextResponse.json({ error: "campaignId required" }, { status: 400 });
  }

  const authResult = await getAuthorizedCampaign(campaignId);
  if (!authResult) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await clearDecisions(campaignId);
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const campaignId = req.nextUrl.searchParams.get("campaignId");
  if (!campaignId) {
    return NextResponse.json({ error: "campaignId required" }, { status: 400 });
  }

  const authResult = await getAuthorizedCampaign(campaignId);
  if (!authResult) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { campaign } = authResult;
  const decisions = await getDecisions(campaignId);

  return NextResponse.json({
    decisions,
    campaign: dbCampaignToAgentCampaign(campaign),
    stats: {
      total: decisions.length,
      bids: decisions.filter((d) => d.decision === "bid").length,
      skips: decisions.filter((d) => d.decision === "skip").length,
      flagged: decisions.filter((d) => d.decision === "flagged").length,
      vetoed: decisions.filter((d) => d.humanAction === "vetoed").length,
      humanReviewed: decisions.filter((d) => d.humanAction).length,
    },
  });
}

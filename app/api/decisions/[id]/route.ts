import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { getAuthorizedCampaign } from "@/lib/campaign-auth";
import { dbCampaignToAgentCampaign } from "@/lib/campaigns-db";
import { getDecisionById } from "@/lib/decisions-db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const campaignId = req.nextUrl.searchParams.get("campaignId");
  if (!campaignId) {
    return NextResponse.json({ error: "campaignId required" }, { status: 400 });
  }

  const authResult = await getAuthorizedCampaign(campaignId);
  if (!authResult) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const decision = await getDecisionById(campaignId, id);
  if (!decision) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    decision,
    campaign: dbCampaignToAgentCampaign(authResult.campaign),
  });
}

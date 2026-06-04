import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { getAuthorizedCampaign } from "@/lib/campaign-auth";
import { applyHumanAction } from "@/lib/decisions-db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { action, note, campaignId } = await req.json();

  if (!campaignId) {
    return NextResponse.json({ error: "campaignId required" }, { status: 400 });
  }
  if (!["approved", "vetoed", "flagged"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const authResult = await getAuthorizedCampaign(campaignId);
  if (!authResult) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await applyHumanAction(
    campaignId,
    id,
    action,
    authResult.session.user.id,
    note
  );
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

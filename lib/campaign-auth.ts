import { auth } from "@/lib/auth";
import { getCampaignById } from "@/lib/campaigns-db";
import { getWorkspaceForUser } from "@/lib/workspace";

export async function getAuthorizedCampaign(campaignId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const workspace = await getWorkspaceForUser(session.user.id);
  if (!workspace) return null;

  const campaign = await getCampaignById(workspace.id, campaignId);
  if (!campaign) return null;

  return { campaign, workspace, session };
}

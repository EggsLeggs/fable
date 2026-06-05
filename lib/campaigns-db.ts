import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { campaigns, type DbCampaign } from "@/lib/db/schema";
import type { Campaign } from "@/lib/store";

export type CampaignInput = {
  name: string;
  advertiser: string;
  goal?: string;
  maxCPM?: number;
  brandKeywords?: string[];
  blockedTopics?: string[];
};

export type CampaignUpdateInput = Partial<CampaignInput> & {
  archived?: boolean;
};

export function dbCampaignToAgentCampaign(row: DbCampaign): Campaign {
  return {
    name: row.name,
    advertiser: row.advertiser,
    goal: row.goal,
    maxCPM: row.maxCPM,
    brandKeywords: row.brandKeywords ?? [],
    blockedTopics: row.blockedTopics ?? [],
  };
}

export async function listCampaigns(workspaceId: string) {
  return getDb()
    .select()
    .from(campaigns)
    .where(eq(campaigns.workspaceId, workspaceId))
    .orderBy(desc(campaigns.createdAt));
}

export async function getCampaignById(workspaceId: string, campaignId: string) {
  const [campaign] = await getDb()
    .select()
    .from(campaigns)
    .where(
      and(eq(campaigns.id, campaignId), eq(campaigns.workspaceId, workspaceId))
    )
    .limit(1);
  return campaign ?? null;
}

export async function createCampaign(workspaceId: string, input: CampaignInput) {
  const [campaign] = await getDb()
    .insert(campaigns)
    .values({
      id: crypto.randomUUID(),
      workspaceId,
      name: input.name,
      advertiser: input.advertiser,
      goal: input.goal ?? "",
      maxCPM: input.maxCPM ?? 8,
      brandKeywords: input.brandKeywords ?? [],
      blockedTopics: input.blockedTopics ?? [],
    })
    .returning();
  return campaign;
}

export async function updateCampaign(
  workspaceId: string,
  campaignId: string,
  input: CampaignUpdateInput
) {
  const patch: Partial<typeof campaigns.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (input.name !== undefined) patch.name = input.name;
  if (input.advertiser !== undefined) patch.advertiser = input.advertiser;
  if (input.goal !== undefined) patch.goal = input.goal;
  if (input.maxCPM !== undefined) patch.maxCPM = input.maxCPM;
  if (input.brandKeywords !== undefined) patch.brandKeywords = input.brandKeywords;
  if (input.blockedTopics !== undefined) patch.blockedTopics = input.blockedTopics;
  if (input.archived !== undefined) patch.archived = input.archived;

  const [campaign] = await getDb()
    .update(campaigns)
    .set(patch)
    .where(
      and(eq(campaigns.id, campaignId), eq(campaigns.workspaceId, workspaceId))
    )
    .returning();
  return campaign ?? null;
}

export async function deleteCampaign(workspaceId: string, campaignId: string) {
  const deleted = await getDb()
    .delete(campaigns)
    .where(
      and(eq(campaigns.id, campaignId), eq(campaigns.workspaceId, workspaceId))
    )
    .returning({ id: campaigns.id });
  return deleted.length > 0;
}

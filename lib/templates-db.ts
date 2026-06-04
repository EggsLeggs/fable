import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { templates, type DbTemplate } from "@/lib/db/schema";
import { createCampaign, type CampaignInput } from "@/lib/campaigns-db";
import { createScenarios, seedDefaultScenarios } from "@/lib/scenarios-db";
import { listTemplateScenarios } from "@/lib/template-scenarios-db";
import type { Campaign } from "@/lib/store";

export type TemplateInput = {
  name: string;
  advertiser: string;
  goal?: string;
  maxCPM?: number;
  brandKeywords?: string[];
  blockedTopics?: string[];
};

export type TemplateUpdateInput = Partial<TemplateInput>;

export function dbTemplateToAgentCampaign(row: DbTemplate): Campaign {
  return {
    name: row.name,
    advertiser: row.advertiser,
    goal: row.goal,
    maxCPM: row.maxCPM,
    brandKeywords: row.brandKeywords ?? [],
    blockedTopics: row.blockedTopics ?? [],
  };
}

export async function listTemplates(workspaceId: string) {
  return getDb()
    .select()
    .from(templates)
    .where(eq(templates.workspaceId, workspaceId))
    .orderBy(desc(templates.updatedAt));
}

export async function getTemplateById(workspaceId: string, templateId: string) {
  const [template] = await getDb()
    .select()
    .from(templates)
    .where(
      and(eq(templates.id, templateId), eq(templates.workspaceId, workspaceId))
    )
    .limit(1);
  return template ?? null;
}

export async function createTemplate(workspaceId: string, input: TemplateInput) {
  const [template] = await getDb()
    .insert(templates)
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
  return template;
}

export async function updateTemplate(
  workspaceId: string,
  templateId: string,
  input: TemplateUpdateInput
) {
  const patch: Partial<typeof templates.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (input.name !== undefined) patch.name = input.name;
  if (input.advertiser !== undefined) patch.advertiser = input.advertiser;
  if (input.goal !== undefined) patch.goal = input.goal;
  if (input.maxCPM !== undefined) patch.maxCPM = input.maxCPM;
  if (input.brandKeywords !== undefined) patch.brandKeywords = input.brandKeywords;
  if (input.blockedTopics !== undefined) patch.blockedTopics = input.blockedTopics;

  const [template] = await getDb()
    .update(templates)
    .set(patch)
    .where(
      and(eq(templates.id, templateId), eq(templates.workspaceId, workspaceId))
    )
    .returning();
  return template ?? null;
}

export async function deleteTemplate(workspaceId: string, templateId: string) {
  const deleted = await getDb()
    .delete(templates)
    .where(
      and(eq(templates.id, templateId), eq(templates.workspaceId, workspaceId))
    )
    .returning({ id: templates.id });
  return deleted.length > 0;
}

export async function createCampaignFromTemplate(
  workspaceId: string,
  templateId: string,
  overrides: CampaignInput
) {
  const template = await getTemplateById(workspaceId, templateId);
  if (!template) return null;

  const campaign = await createCampaign(workspaceId, {
    name: overrides.name,
    advertiser: overrides.advertiser,
    goal: overrides.goal ?? template.goal,
    maxCPM: overrides.maxCPM ?? template.maxCPM,
    brandKeywords: overrides.brandKeywords ?? template.brandKeywords ?? [],
    blockedTopics: overrides.blockedTopics ?? template.blockedTopics ?? [],
  });

  const templateScenarios = await listTemplateScenarios(templateId);
  if (templateScenarios.length > 0) {
    await createScenarios(
      campaign.id,
      templateScenarios.map((s) => ({
        label: s.label,
        category: s.category,
        messages: s.messages,
      }))
    );
  } else {
    await seedDefaultScenarios(campaign.id);
  }

  return campaign;
}

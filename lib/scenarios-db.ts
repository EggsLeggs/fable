import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { campaignScenarios, type DbCampaignScenario } from "@/lib/db/schema";
import { DEFAULT_SCENARIOS } from "@/lib/scenarios";
import type { ScenarioCategory } from "@/lib/scenario-categories";
import type { Message } from "@/lib/store";

export type ScenarioInput = {
  label: string;
  category: ScenarioCategory;
  messages: Message[];
};

export type CampaignScenario = {
  id: string;
  campaignId: string;
  label: string;
  category: ScenarioCategory;
  messages: Message[];
  sortOrder: number;
  createdAt: string;
};

function rowToScenario(row: DbCampaignScenario): CampaignScenario {
  return {
    id: row.id,
    campaignId: row.campaignId,
    label: row.label,
    category: row.category,
    messages: row.messages,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listScenarios(campaignId: string): Promise<CampaignScenario[]> {
  const rows = await getDb()
    .select()
    .from(campaignScenarios)
    .where(eq(campaignScenarios.campaignId, campaignId))
    .orderBy(asc(campaignScenarios.sortOrder), asc(campaignScenarios.createdAt));
  return rows.map(rowToScenario);
}

export async function getScenarioById(campaignId: string, scenarioId: string) {
  const [row] = await getDb()
    .select()
    .from(campaignScenarios)
    .where(eq(campaignScenarios.id, scenarioId))
    .limit(1);
  if (!row || row.campaignId !== campaignId) return null;
  return rowToScenario(row);
}

async function nextSortOrder(campaignId: string) {
  const existing = await listScenarios(campaignId);
  if (existing.length === 0) return 0;
  return Math.max(...existing.map((s) => s.sortOrder)) + 1;
}

export async function createScenario(campaignId: string, input: ScenarioInput) {
  const sortOrder = await nextSortOrder(campaignId);
  const [row] = await getDb()
    .insert(campaignScenarios)
    .values({
      id: crypto.randomUUID(),
      campaignId,
      label: input.label,
      category: input.category,
      messages: input.messages,
      sortOrder,
    })
    .returning();
  return rowToScenario(row);
}

export async function createScenarios(
  campaignId: string,
  inputs: ScenarioInput[]
): Promise<CampaignScenario[]> {
  const created: CampaignScenario[] = [];
  let sortOrder = await nextSortOrder(campaignId);
  for (const input of inputs) {
    const [row] = await getDb()
      .insert(campaignScenarios)
      .values({
        id: crypto.randomUUID(),
        campaignId,
        label: input.label,
        category: input.category,
        messages: input.messages,
        sortOrder: sortOrder++,
      })
      .returning();
    created.push(rowToScenario(row));
  }
  return created;
}

export async function updateScenario(
  campaignId: string,
  scenarioId: string,
  input: Partial<ScenarioInput>
) {
  const patch: Partial<typeof campaignScenarios.$inferInsert> = {};
  if (input.label !== undefined) patch.label = input.label;
  if (input.category !== undefined) patch.category = input.category;
  if (input.messages !== undefined) patch.messages = input.messages;

  const [row] = await getDb()
    .update(campaignScenarios)
    .set(patch)
    .where(eq(campaignScenarios.id, scenarioId))
    .returning();
  if (!row || row.campaignId !== campaignId) return null;
  return rowToScenario(row);
}

export async function deleteScenario(campaignId: string, scenarioId: string) {
  const [row] = await getDb()
    .delete(campaignScenarios)
    .where(eq(campaignScenarios.id, scenarioId))
    .returning();
  if (!row || row.campaignId !== campaignId) return false;
  return true;
}

export async function seedDefaultScenarios(campaignId: string) {
  const existing = await listScenarios(campaignId);
  if (existing.length > 0) return existing;
  return createScenarios(
    campaignId,
    DEFAULT_SCENARIOS.map((s) => ({
      label: s.label,
      category: s.category,
      messages: s.messages,
    }))
  );
}

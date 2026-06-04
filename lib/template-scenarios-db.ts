import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { templateScenarios, type DbTemplateScenario } from "@/lib/db/schema";
import { DEFAULT_SCENARIOS } from "@/lib/scenarios";
import type { ScenarioCategory } from "@/lib/scenario-categories";
import type { Message } from "@/lib/store";

export type ScenarioInput = {
  label: string;
  category: ScenarioCategory;
  messages: Message[];
};

export type TemplateScenario = {
  id: string;
  templateId: string;
  label: string;
  category: ScenarioCategory;
  messages: Message[];
  sortOrder: number;
  createdAt: string;
};

function rowToScenario(row: DbTemplateScenario): TemplateScenario {
  return {
    id: row.id,
    templateId: row.templateId,
    label: row.label,
    category: row.category,
    messages: row.messages,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listTemplateScenarios(
  templateId: string
): Promise<TemplateScenario[]> {
  const rows = await getDb()
    .select()
    .from(templateScenarios)
    .where(eq(templateScenarios.templateId, templateId))
    .orderBy(asc(templateScenarios.sortOrder), asc(templateScenarios.createdAt));
  return rows.map(rowToScenario);
}

export async function getTemplateScenarioById(templateId: string, scenarioId: string) {
  const [row] = await getDb()
    .select()
    .from(templateScenarios)
    .where(eq(templateScenarios.id, scenarioId))
    .limit(1);
  if (!row || row.templateId !== templateId) return null;
  return rowToScenario(row);
}

async function nextSortOrder(templateId: string) {
  const existing = await listTemplateScenarios(templateId);
  if (existing.length === 0) return 0;
  return Math.max(...existing.map((s) => s.sortOrder)) + 1;
}

export async function createTemplateScenario(templateId: string, input: ScenarioInput) {
  const sortOrder = await nextSortOrder(templateId);
  const [row] = await getDb()
    .insert(templateScenarios)
    .values({
      id: crypto.randomUUID(),
      templateId,
      label: input.label,
      category: input.category,
      messages: input.messages,
      sortOrder,
    })
    .returning();
  return rowToScenario(row);
}

export async function createTemplateScenarios(
  templateId: string,
  inputs: ScenarioInput[]
): Promise<TemplateScenario[]> {
  const created: TemplateScenario[] = [];
  let sortOrder = await nextSortOrder(templateId);
  for (const input of inputs) {
    const [row] = await getDb()
      .insert(templateScenarios)
      .values({
        id: crypto.randomUUID(),
        templateId,
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

export async function updateTemplateScenario(
  templateId: string,
  scenarioId: string,
  input: Partial<ScenarioInput>
) {
  const patch: Partial<typeof templateScenarios.$inferInsert> = {};
  if (input.label !== undefined) patch.label = input.label;
  if (input.category !== undefined) patch.category = input.category;
  if (input.messages !== undefined) patch.messages = input.messages;

  const [row] = await getDb()
    .update(templateScenarios)
    .set(patch)
    .where(eq(templateScenarios.id, scenarioId))
    .returning();
  if (!row || row.templateId !== templateId) return null;
  return rowToScenario(row);
}

export async function deleteTemplateScenario(templateId: string, scenarioId: string) {
  const [row] = await getDb()
    .delete(templateScenarios)
    .where(eq(templateScenarios.id, scenarioId))
    .returning();
  if (!row || row.templateId !== templateId) return false;
  return true;
}

export async function seedDefaultTemplateScenarios(templateId: string) {
  const existing = await listTemplateScenarios(templateId);
  if (existing.length > 0) return existing;
  return createTemplateScenarios(
    templateId,
    DEFAULT_SCENARIOS.map((s) => ({
      label: s.label,
      category: s.category,
      messages: s.messages,
    }))
  );
}

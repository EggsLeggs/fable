import { and, count, desc, eq, inArray } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { getDb } from "@/lib/db";
import { decisions, type DbDecision } from "@/lib/db/schema";
import type { Decision, DecisionAuditEvent } from "@/lib/store";
import { createAuditEvent } from "@/lib/decision-audit";

const MAX_DECISIONS_PER_CAMPAIGN = 50;

function rowToDecision(row: DbDecision): Decision {
  return {
    id: row.id,
    timestamp: row.createdAt.toISOString(),
    campaignName: row.campaignName,
    advertiser: row.advertiser,
    contextSnippet: row.contextSnippet,
    fullContext: row.fullContext,
    decision: row.decision,
    reasoning: row.reasoning,
    confidence: row.confidence,
    flags: row.flags ?? [],
    suggestedCPM: row.suggestedCPM ?? undefined,
    adReturned: row.adReturned ?? undefined,
    humanAction: row.humanAction ?? undefined,
    humanNote: row.humanNote ?? undefined,
    humanTimestamp: row.humanTimestamp?.toISOString(),
    auditLog: row.auditLog ?? [],
  };
}

export async function getDecisionById(
  campaignId: string,
  id: string
): Promise<Decision | null> {
  const [row] = await getDb()
    .select()
    .from(decisions)
    .where(and(eq(decisions.id, id), eq(decisions.campaignId, campaignId)))
    .limit(1);
  return row ? rowToDecision(row) : null;
}


export async function getDecisions(campaignId: string): Promise<Decision[]> {
  const rows = await getDb()
    .select()
    .from(decisions)
    .where(eq(decisions.campaignId, campaignId))
    .orderBy(desc(decisions.createdAt))
    .limit(MAX_DECISIONS_PER_CAMPAIGN);
  return rows.map(rowToDecision);
}

export async function getVetoedCount(campaignId: string): Promise<number> {
  const [result] = await getDb()
    .select({ count: count() })
    .from(decisions)
    .where(
      and(eq(decisions.campaignId, campaignId), eq(decisions.humanAction, "vetoed"))
    );
  return result?.count ?? 0;
}

export async function addDecision(
  campaignId: string,
  d: Omit<Decision, "id" | "timestamp"> & { auditLog?: DecisionAuditEvent[] }
): Promise<Decision> {
  const id = uuid();
  const [row] = await getDb()
    .insert(decisions)
    .values({
      id,
      campaignId,
      campaignName: d.campaignName,
      advertiser: d.advertiser,
      contextSnippet: d.contextSnippet,
      fullContext: d.fullContext,
      decision: d.decision,
      reasoning: d.reasoning,
      confidence: d.confidence,
      flags: d.flags,
      suggestedCPM: d.suggestedCPM,
      adReturned: d.adReturned,
      auditLog: d.auditLog ?? [],
    })
    .returning();

  await pruneOldDecisions(campaignId);
  return rowToDecision(row);
}

async function pruneOldDecisions(campaignId: string) {
  const rows = await getDb()
    .select({ id: decisions.id })
    .from(decisions)
    .where(eq(decisions.campaignId, campaignId))
    .orderBy(desc(decisions.createdAt));

  if (rows.length <= MAX_DECISIONS_PER_CAMPAIGN) return;

  const excessIds = rows.slice(MAX_DECISIONS_PER_CAMPAIGN).map((r) => r.id);
  await getDb().delete(decisions).where(inArray(decisions.id, excessIds));
}

export async function clearDecisions(campaignId: string) {
  await getDb().delete(decisions).where(eq(decisions.campaignId, campaignId));
}

export async function applyHumanAction(
  campaignId: string,
  id: string,
  action: "approved" | "vetoed" | "flagged",
  userId: string,
  note?: string
): Promise<Decision | null> {
  const existing = await getDecisionById(campaignId, id);
  if (!existing) return null;

  const humanTimestamp = new Date();
  const auditEvent = createAuditEvent({
    timestamp: humanTimestamp.toISOString(),
    actor: "operator",
    service: "sentinel",
    action: "human_review",
    summary: `Operator ${action} this decision`,
    status: action === "vetoed" ? "warning" : "success",
    details: { action, note: note ?? null, userId },
  });

  const [row] = await getDb()
    .update(decisions)
    .set({
      humanAction: action,
      humanNote: note,
      humanTimestamp,
      humanRespondedByUserId: userId,
      auditLog: [...(existing.auditLog ?? []), auditEvent],
    })
    .where(and(eq(decisions.id, id), eq(decisions.campaignId, campaignId)))
    .returning();

  return row ? rowToDecision(row) : null;
}

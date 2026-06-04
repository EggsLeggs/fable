import type { Job } from "bullmq";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { db, projects, translationKeys } from "@fable/db";

export interface VcsSyncPayload {
  projectId: string;
  keys: Array<{ key: string; description?: string }>;
}

export async function handleVcsSync(job: Job<VcsSyncPayload>): Promise<void> {
  const { projectId, keys } = job.data;

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) throw new Error(`Project ${projectId} not found`);

  const existing = await db.query.translationKeys.findMany({
    where: eq(translationKeys.projectId, projectId),
  });

  const existingKeys = new Set(existing.map((k) => k.key));

  const toInsert = keys.filter((k) => !existingKeys.has(k.key));

  if (toInsert.length > 0) {
    await db.insert(translationKeys).values(
      toInsert.map((k) => ({
        id: uuid(),
        projectId,
        key: k.key,
        description: k.description ?? null,
        tags: [],
      }))
    );
  }
}

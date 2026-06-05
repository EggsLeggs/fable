import { v4 as uuid } from "uuid";
import { activityLog, type ActivityMetadata, type ActivityType } from "@fable/db";
import type { Db } from "@fable/db";

export async function logActivity(
  db: Db,
  params: {
    projectId: string;
    userId: string | null;
    type: ActivityType;
    locale?: string | null;
    metadata: ActivityMetadata;
  }
): Promise<void> {
  await db.insert(activityLog).values({
    id: uuid(),
    projectId: params.projectId,
    userId: params.userId ?? null,
    type: params.type,
    locale: params.locale ?? null,
    metadata: params.metadata,
  });
}

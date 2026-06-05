import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";

export async function getWorkspaceForUser(userId: string) {
  const [workspace] = await getDb()
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerId, userId))
    .limit(1);
  return workspace ?? null;
}

export async function createWorkspaceForUser(userId: string, name: string) {
  const [workspace] = await getDb()
    .insert(workspaces)
    .values({ id: crypto.randomUUID(), name, ownerId: userId })
    .returning();
  return workspace;
}

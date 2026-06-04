import { auth } from "@/lib/auth";
import { getTemplateById } from "@/lib/templates-db";
import { getWorkspaceForUser } from "@/lib/workspace";

export async function getAuthorizedTemplate(templateId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const workspace = await getWorkspaceForUser(session.user.id);
  if (!workspace) return null;

  const template = await getTemplateById(workspace.id, templateId);
  if (!template) return null;

  return { template, workspace, session };
}

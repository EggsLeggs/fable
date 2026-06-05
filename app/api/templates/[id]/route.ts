import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  dbTemplateToAgentCampaign,
  deleteTemplate,
  getTemplateById,
  updateTemplate,
} from "@/lib/templates-db";
import { getWorkspaceForUser } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  advertiser: z.string().trim().min(1).max(200).optional(),
  blockedTopics: z.array(z.string().min(1).max(80)).max(50).optional(),
  brandKeywords: z.array(z.string().min(1).max(80)).max(50).optional(),
  goal: z.string().max(500).optional(),
  maxCPM: z.number().positive().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspace = await getWorkspaceForUser(session.user.id);
  if (!workspace) {
    return NextResponse.json({ error: "No workspace found" }, { status: 404 });
  }

  const template = await getTemplateById(workspace.id, id);
  if (!template) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    template,
    agentCampaign: dbTemplateToAgentCampaign(template),
    workspace: { name: workspace.name },
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspace = await getWorkspaceForUser(session.user.id);
  if (!workspace) {
    return NextResponse.json({ error: "No workspace found" }, { status: 404 });
  }

  const ok = await deleteTemplate(workspace.id, id);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspace = await getWorkspaceForUser(session.user.id);
  if (!workspace) {
    return NextResponse.json({ error: "No workspace found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const updated = await updateTemplate(workspace.id, id, parsed.data);
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    template: updated,
    agentCampaign: dbTemplateToAgentCampaign(updated),
  });
}

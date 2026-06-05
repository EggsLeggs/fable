import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { createCampaign, listCampaigns } from "@/lib/campaigns-db";
import { createCampaignFromTemplate } from "@/lib/templates-db";
import { getWorkspaceForUser } from "@/lib/workspace";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  advertiser: z.string().min(1).max(200),
  goal: z.string().max(500).optional(),
  maxCPM: z.number().positive().optional(),
  brandKeywords: z.array(z.string()).optional(),
  blockedTopics: z.array(z.string()).optional(),
  templateId: z.string().uuid().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspace = await getWorkspaceForUser(session.user.id);
  if (!workspace) {
    return NextResponse.json({ campaigns: [], workspace: null });
  }

  const list = await listCampaigns(workspace.id);
  return NextResponse.json({ campaigns: list, workspace });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspace = await getWorkspaceForUser(session.user.id);
  if (!workspace) {
    return NextResponse.json({ error: "No workspace found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { templateId, ...input } = parsed.data;

  const campaign = templateId
    ? await createCampaignFromTemplate(workspace.id, templateId, input)
    : await createCampaign(workspace.id, input);

  if (!campaign) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  return NextResponse.json({ campaign }, { status: 201 });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { createTemplate, listTemplates } from "@/lib/templates-db";
import { getWorkspaceForUser } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  advertiser: z.string().min(1).max(200),
  goal: z.string().max(500).optional(),
  maxCPM: z.number().positive().optional(),
  brandKeywords: z.array(z.string()).optional(),
  blockedTopics: z.array(z.string()).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspace = await getWorkspaceForUser(session.user.id);
  if (!workspace) {
    return NextResponse.json({ templates: [], workspace: null });
  }

  const list = await listTemplates(workspace.id);
  return NextResponse.json({ templates: list, workspace });
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

  const template = await createTemplate(workspace.id, parsed.data);
  return NextResponse.json({ template }, { status: 201 });
}

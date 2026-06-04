import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthorizedTemplate } from "@/lib/template-auth";
import { SCENARIO_CATEGORIES } from "@/lib/scenario-categories";
import {
  deleteTemplateScenario,
  updateTemplateScenario,
} from "@/lib/template-scenarios-db";

export const dynamic = "force-dynamic";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const patchSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  category: z.enum(SCENARIO_CATEGORIES).optional(),
  messages: z.array(messageSchema).min(1).max(20).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; scenarioId: string }> }
) {
  const { id, scenarioId } = await params;
  const authResult = await getAuthorizedTemplate(id);
  if (!authResult) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const scenario = await updateTemplateScenario(id, scenarioId, parsed.data);
  if (!scenario) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ scenario });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; scenarioId: string }> }
) {
  const { id, scenarioId } = await params;
  const authResult = await getAuthorizedTemplate(id);
  if (!authResult) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ok = await deleteTemplateScenario(id, scenarioId);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

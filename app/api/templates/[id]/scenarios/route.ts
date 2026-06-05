import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthorizedTemplate } from "@/lib/template-auth";
import { SCENARIO_CATEGORIES } from "@/lib/scenario-categories";
import {
  createTemplateScenario,
  listTemplateScenarios,
  seedDefaultTemplateScenarios,
} from "@/lib/template-scenarios-db";

export const dynamic = "force-dynamic";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const createSchema = z.object({
  label: z.string().min(1).max(200),
  category: z.enum(SCENARIO_CATEGORIES),
  messages: z.array(messageSchema).min(1).max(20),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await getAuthorizedTemplate(id);
  if (!authResult) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let scenarios = await listTemplateScenarios(id);
  if (scenarios.length === 0) {
    scenarios = await seedDefaultTemplateScenarios(id);
  }

  return NextResponse.json({ scenarios });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await getAuthorizedTemplate(id);
  if (!authResult) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const scenario = await createTemplateScenario(id, parsed.data);
  return NextResponse.json({ scenario }, { status: 201 });
}

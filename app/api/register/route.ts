import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createWorkspaceForUser } from "@/lib/workspace";
import { createCampaign } from "@/lib/campaigns-db";
import { DEFAULT_NIKE_CAMPAIGN } from "@/lib/default-campaign";
import { seedDefaultScenarios } from "@/lib/scenarios-db";

const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  workspaceName: z.string().min(1).max(100).optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { name, email, password, workspaceName } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const [existing] = await getDb()
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userId = crypto.randomUUID();
    const [user] = await getDb()
      .insert(users)
      .values({
        id: userId,
        name,
        email: normalizedEmail,
        passwordHash,
      })
      .returning();

    const workspace = await createWorkspaceForUser(
      user.id,
      workspaceName ?? `${name}'s workspace`
    );

    const campaign = await createCampaign(workspace.id, DEFAULT_NIKE_CAMPAIGN);
    await seedDefaultScenarios(campaign.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

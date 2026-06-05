import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import { auth } from "@fable/auth";
import { isGitHubAppConfigured } from "@fable/api/integration-config";
import { db, githubInstallations } from "@fable/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const installationId = searchParams.get("installation_id");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;

  if (!installationId) {
    return NextResponse.redirect(new URL("/settings/connections", appUrl));
  }

  if (!isGitHubAppConfigured()) {
    return NextResponse.redirect(
      new URL("/settings/connections?error=github_not_configured", appUrl)
    );
  }

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    // Not logged in — send to sign-in, then back here
    const callbackUrl = encodeURIComponent(new URL(req.nextUrl.pathname + req.nextUrl.search, appUrl).toString());
    return NextResponse.redirect(new URL(`/sign-in?callbackUrl=${callbackUrl}`, appUrl));
  }

  // Upsert: one installation per user (last install wins)
  const existing = await db.query.githubInstallations.findFirst({
    where: eq(githubInstallations.userId, session.user.id),
  });

  if (existing) {
    await db
      .update(githubInstallations)
      .set({ installationId, updatedAt: new Date() })
      .where(eq(githubInstallations.id, existing.id));
  } else {
    await db.insert(githubInstallations).values({
      id: uuid(),
      userId: session.user.id,
      installationId,
    });
  }

  return NextResponse.redirect(new URL("/settings/connections", appUrl));
}

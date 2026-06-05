import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq, and, inArray } from "drizzle-orm";
import { auth } from "@fable/auth";
import {
  db,
  sourceFiles,
  orgMembers,
  projects,
  translationKeys,
  translations,
} from "@fable/db";
import { getAdapter, resolveOutputPath } from "@fable/formats";
import { zipSync, strToU8 } from "fflate";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const member = await db.query.orgMembers.findFirst({
    where: and(
      eq(orgMembers.userId, session.user.id),
      eq(orgMembers.orgId, project.orgId)
    ),
  });
  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const localesParam = req.nextUrl.searchParams.get("locales");
  const locales = localesParam ? localesParam.split(",").map((l) => l.trim()).filter(Boolean) : [];
  if (locales.length === 0) {
    return NextResponse.json({ error: "No locales specified" }, { status: 400 });
  }

  const files = await db.query.sourceFiles.findMany({
    where: and(
      eq(sourceFiles.projectId, projectId),
      eq(sourceFiles.status, "active")
    ),
  });

  const zipEntries: Record<string, Uint8Array> = {};

  for (const file of files) {
    const keys = await db.query.translationKeys.findMany({
      where: and(
        eq(translationKeys.sourceFileId, file.id),
        eq(translationKeys.status, "active")
      ),
    });
    if (keys.length === 0) continue;
    const keyIds = keys.map((k) => k.id);

    for (const locale of locales) {
      const outputPath = resolveOutputPath(file, project.sourceLocale, locale);
      if (!outputPath) continue;

      const approvedTranslations = await db.query.translations.findMany({
        where: and(
          inArray(translations.keyId, keyIds),
          eq(translations.locale, locale),
          eq(translations.state, "approved")
        ),
      });
      if (approvedTranslations.length === 0) continue;

      const translationMap: Record<string, string> = {};
      for (const t of approvedTranslations) {
        const key = keys.find((k) => k.id === t.keyId);
        if (key) translationMap[key.key] = t.value;
      }

      const adapter = getAdapter(file.format);
      const content = adapter.serialize(translationMap);
      zipEntries[outputPath] = strToU8(content);
    }
  }

  if (Object.keys(zipEntries).length === 0) {
    return NextResponse.json(
      { error: "No approved translations found for the selected locales" },
      { status: 404 }
    );
  }

  const zipBuffer = zipSync(zipEntries);

  return new NextResponse(zipBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="translations.zip"`,
    },
  });
}

import { NextResponse } from "next/server";
import { eq, and, count, ne } from "drizzle-orm";
import { db, projects, projectLocales, translationKeys, translations } from "@fable/db";

export const dynamic = "force-dynamic";

function badgeColor(pct: number): string {
  if (pct >= 90) return "brightgreen";
  if (pct >= 70) return "green";
  if (pct >= 50) return "yellow";
  if (pct >= 30) return "orange";
  return "red";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!project) {
    return NextResponse.json(
      { schemaVersion: 1, label: "translated", message: "unknown", color: "lightgrey" },
      { headers: { "Cache-Control": "s-maxage=300" } }
    );
  }

  const [keyRow] = await db
    .select({ value: count() })
    .from(translationKeys)
    .where(and(eq(translationKeys.projectId, id), eq(translationKeys.status, "active")));

  const keyCount = keyRow?.value ?? 0;

  const targetLocales = await db.query.projectLocales.findMany({
    where: and(eq(projectLocales.projectId, id), eq(projectLocales.isSource, false)),
  });

  const [approvedRow] = await db
    .select({ value: count() })
    .from(translations)
    .innerJoin(translationKeys, eq(translations.keyId, translationKeys.id))
    .where(
      and(
        eq(translationKeys.projectId, id),
        eq(translationKeys.status, "active"),
        eq(translations.state, "approved"),
        ne(translations.locale, project.sourceLocale)
      )
    );

  const approvedCount = approvedRow?.value ?? 0;
  const total = keyCount * targetLocales.length;
  const pct = total === 0 ? 0 : Math.round((approvedCount / total) * 100);

  return NextResponse.json(
    {
      schemaVersion: 1,
      label: "translated",
      message: `${pct}%`,
      color: badgeColor(pct),
    },
    { headers: { "Cache-Control": "s-maxage=300" } }
  );
}

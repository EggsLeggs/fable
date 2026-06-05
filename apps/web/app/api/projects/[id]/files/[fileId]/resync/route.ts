import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";
import { eq, and } from "drizzle-orm";
import { auth } from "@fable/auth";
import { db, sourceFiles, ingestJobs, orgMembers, projects } from "@fable/db";
import { getIngestQueue } from "@/lib/queues";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId, fileId } = await params;

  const file = await db.query.sourceFiles.findFirst({
    where: and(
      eq(sourceFiles.id, fileId),
      eq(sourceFiles.projectId, projectId),
      eq(sourceFiles.status, "active")
    ),
  });
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

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

  const ingestJobId = uuid();
  await db.insert(ingestJobs).values({
    id: ingestJobId,
    sourceFileId: fileId,
    trigger: "manual_upload",
    status: "queued",
  });

  await getIngestQueue().add(
    "ingest",
    { ingestJobId, sourceFileId: fileId },
    { jobId: `ingest:resync:${ingestJobId}` }
  );

  return NextResponse.json({ ingestJobId }, { status: 202 });
}

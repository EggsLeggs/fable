import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";
import { eq, and } from "drizzle-orm";
import { auth } from "@fable/auth";
import { db, sourceFiles, ingestJobs, orgMembers, projects } from "@fable/db";
import { detectFormat } from "@fable/formats";
import { ingestSourceFile } from "@fable/ingest";
import { logActivity } from "@fable/api/log-activity";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(
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

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File exceeds 10MB limit" },
      { status: 422 }
    );
  }

  const content = await file.text();
  const filename = file.name;

  const formatOverride = formData.get("format");
  let format = typeof formatOverride === "string" && formatOverride
    ? formatOverride
    : detectFormat(filename, content);

  if (!format) {
    return NextResponse.json(
      { error: "Unrecognised file format" },
      { status: 422 }
    );
  }

  const validFormats = ["json_flat", "json_nested", "po", "yaml", "lingui_json"] as const;
  if (!validFormats.includes(format as (typeof validFormats)[number])) {
    return NextResponse.json(
      { error: `Unsupported format: ${format}` },
      { status: 422 }
    );
  }

  const detectedFormat = format as (typeof validFormats)[number];

  const filePath = filename;
  const sourceFileId = uuid();
  const ingestJobId = uuid();

  const existingFile = await db.query.sourceFiles.findFirst({
    where: and(
      eq(sourceFiles.projectId, projectId),
      eq(sourceFiles.path, filePath)
    ),
  });

  const now = new Date();

  if (existingFile) {
    await db
      .update(sourceFiles)
      .set({
        name: filename,
        format: format as (typeof validFormats)[number],
        rawContent: content,
        updatedAt: now,
      })
      .where(eq(sourceFiles.id, existingFile.id));

    await db.insert(ingestJobs).values({
      id: ingestJobId,
      sourceFileId: existingFile.id,
      trigger: "manual_upload",
      status: "queued",
    });

    await ingestSourceFile({ ingestJobId, sourceFileId: existingFile.id });

    await logActivity(db, {
      projectId,
      userId: session.user.id,
      type: "source_updated",
      metadata: { sourceId: existingFile.id, name: filename, sourcePath: filePath },
    });

    return NextResponse.json(
      { sourceFileId: existingFile.id, ingestJobId, detectedFormat },
      { status: 202 }
    );
  }

  await db.insert(sourceFiles).values({
    id: sourceFileId,
    projectId,
    name: filename,
    path: filePath,
    format: format as (typeof validFormats)[number],
    sourceType: "upload",
    rawContent: content,
    pushEnabled: false,
    status: "active",
  });

  await db.insert(ingestJobs).values({
    id: ingestJobId,
    sourceFileId,
    trigger: "manual_upload",
    status: "queued",
  });

  await ingestSourceFile({ ingestJobId, sourceFileId });

  await logActivity(db, {
    projectId,
    userId: session.user.id,
    type: "source_created",
    metadata: { sourceId: sourceFileId, name: filename, sourcePath: filePath },
  });

  return NextResponse.json({ sourceFileId, ingestJobId, detectedFormat }, { status: 202 });
}

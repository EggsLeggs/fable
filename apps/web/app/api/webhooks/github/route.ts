import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { v4 as uuid } from "uuid";
import { eq, and } from "drizzle-orm";
import { db, vcsIntegrations, sourceFiles, ingestJobs } from "@fable/db";
import { getIngestQueue } from "@/lib/queues";

export const dynamic = "force-dynamic";

interface GitHubCommit {
  added: string[];
  modified: string[];
  removed: string[];
}

interface GitHubPushEvent {
  ref: string;
  repository: {
    owner: { login: string };
    name: string;
  };
  commits: GitHubCommit[];
}

function matchesPattern(path: string, patterns: string[]): boolean {
  if (patterns.length === 0) return true;
  return patterns.some((pattern) => {
    const regex = new RegExp(
      "^" +
        pattern
          .replace(/[.+^${}()|[\]\\]/g, "\\$&")
          .replace(/\*\*/g, "__DOUBLE_STAR__")
          .replace(/\*/g, "[^/]*")
          .replace(/__DOUBLE_STAR__/g, ".*") +
        "$"
    );
    return regex.test(path);
  });
}

function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(`sha256=${expected}`, "utf-8");
  const signatureBuf = Buffer.from(signature, "utf-8");
  return (
    expectedBuf.length === signatureBuf.length &&
    timingSafeEqual(expectedBuf, signatureBuf)
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  const event = req.headers.get("x-github-event");
  const deliveryId = req.headers.get("x-github-delivery") ?? uuid();

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }

  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[github-webhook] GITHUB_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  if (!verifySignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Acknowledge non-push events immediately after signature check
  if (event !== "push") {
    return NextResponse.json({ ok: true });
  }

  let payload: GitHubPushEvent;
  try {
    payload = JSON.parse(rawBody) as GitHubPushEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const ref = payload.ref;

  const integrations = await db.query.vcsIntegrations.findMany({
    where: and(
      eq(vcsIntegrations.repoOwner, owner),
      eq(vcsIntegrations.repoName, repo)
    ),
  });

  for (const integration of integrations) {
    // Ignore pushes to the translation branch to prevent ingest loop
    if (ref === `refs/heads/${integration.translationBranch}`) {
      continue;
    }

    // Only handle pushes to the default branch
    if (ref !== `refs/heads/${integration.defaultBranch}`) {
      continue;
    }

    const changedPaths = new Set<string>();
    for (const commit of payload.commits) {
      for (const p of [...commit.added, ...commit.modified]) {
        changedPaths.add(p);
      }
    }

    const matchedPaths = [...changedPaths].filter((p) =>
      matchesPattern(p, integration.filePatterns)
    );

    for (const filePath of matchedPaths) {
      const filename = filePath.split("/").pop() ?? filePath;

      const existing = await db.query.sourceFiles.findFirst({
        where: and(
          eq(sourceFiles.projectId, integration.projectId),
          eq(sourceFiles.path, filePath)
        ),
      });

      let sourceFileId: string;

      if (existing) {
        sourceFileId = existing.id;
        await db
          .update(sourceFiles)
          .set({ updatedAt: new Date() })
          .where(eq(sourceFiles.id, sourceFileId));
      } else {
        sourceFileId = uuid();
        await db.insert(sourceFiles).values({
          id: sourceFileId,
          projectId: integration.projectId,
          name: filename,
          path: filePath,
          format: "json_flat",
          sourceType: "vcs",
          vcsIntegrationId: integration.id,
          vcsPath: filePath,
          vcsBranch: integration.defaultBranch,
          pushEnabled: true,
          status: "active",
        });
      }

      const ingestJobId = uuid();
      await db.insert(ingestJobs).values({
        id: ingestJobId,
        sourceFileId,
        trigger: "vcs_webhook",
        status: "queued",
      });

      await getIngestQueue().add(
        "ingest",
        { ingestJobId, sourceFileId },
        { jobId: `ingest:${sourceFileId}:${deliveryId}` }
      );

      console.log(`[github-webhook] queued ingest for ${filePath} (${ingestJobId})`);
    }
  }

  return NextResponse.json({ ok: true });
}

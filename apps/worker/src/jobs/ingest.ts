import type { Job } from "bullmq";
import { eq, and } from "drizzle-orm";
import { createHash } from "crypto";
import { v4 as uuid } from "uuid";
import {
  db,
  sourceFiles,
  ingestJobs,
  translationKeys,
  translations,
  vcsIntegrations,
  projects,
} from "@fable/db";
import { getAdapter, detectFormat } from "@fable/formats";

export interface IngestJobPayload {
  ingestJobId: string;
  sourceFileId: string;
}

function keyHash(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

async function getInstallationToken(installationId: string): Promise<string> {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!appId || !privateKey) {
    throw new Error("GITHUB_APP_ID and GITHUB_PRIVATE_KEY must be set for VCS ingestion");
  }

  // Dynamic import to avoid requiring jsonwebtoken at startup when not needed
  const jwt = await import("jsonwebtoken");
  const appToken = jwt.default.sign({ iss: appId }, privateKey, {
    algorithm: "RS256",
    expiresIn: "10m",
  });

  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get installation token: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { token: string };
  return data.token;
}

async function fetchGitHubFileContent(
  token: string,
  owner: string,
  repo: string,
  path: string,
  ref: string
): Promise<string> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${ref}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch file from GitHub: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { content: string; encoding: string };
  if (data.encoding !== "base64") {
    throw new Error(`Unexpected encoding: ${data.encoding}`);
  }
  return Buffer.from(data.content, "base64").toString("utf-8");
}

export async function handleIngest(job: Job<IngestJobPayload>): Promise<void> {
  const { ingestJobId, sourceFileId } = job.data;

  const ingestJob = await db.query.ingestJobs.findFirst({
    where: eq(ingestJobs.id, ingestJobId),
  });
  if (!ingestJob) throw new Error(`IngestJob ${ingestJobId} not found`);

  const sourceFile = await db.query.sourceFiles.findFirst({
    where: eq(sourceFiles.id, sourceFileId),
  });
  if (!sourceFile) throw new Error(`SourceFile ${sourceFileId} not found`);

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, sourceFile.projectId),
  });
  if (!project) throw new Error(`Project ${sourceFile.projectId} not found`);

  await db
    .update(ingestJobs)
    .set({ status: "processing", startedAt: new Date() })
    .where(eq(ingestJobs.id, ingestJobId));

  try {
    let content: string;

    if (sourceFile.sourceType === "upload") {
      if (!sourceFile.rawContent) {
        throw new Error("SourceFile has no rawContent for upload type");
      }
      content = sourceFile.rawContent;
    } else {
      // VCS: fetch from GitHub
      const integration = await db.query.vcsIntegrations.findFirst({
        where: eq(vcsIntegrations.id, sourceFile.vcsIntegrationId!),
      });
      if (!integration) throw new Error("VCS integration not found");

      const token = await getInstallationToken(integration.installationId);
      content = await fetchGitHubFileContent(
        token,
        integration.repoOwner,
        integration.repoName,
        sourceFile.vcsPath!,
        sourceFile.vcsBranch ?? integration.defaultBranch
      );
    }

    const detectedFormat = detectFormat(sourceFile.name, content);
    const resolvedFormat = detectedFormat ?? sourceFile.format;
    const adapter = getAdapter(resolvedFormat);
    const parsed = adapter.parse(content);

    // Look up all keys in the project (active and archived) — keys are unique
    // per project, not per source file. Fetching archived keys too prevents a
    // unique-constraint error when a previously-archived key reappears in a sync.
    const existingKeys = await db.query.translationKeys.findMany({
      where: eq(translationKeys.projectId, sourceFile.projectId),
      with: {
        translations: {
          where: eq(translations.locale, project.sourceLocale),
        },
      },
    });

    const existingByKey = new Map(existingKeys.map((k) => [k.key, k]));
    const incomingKeys = new Set(Object.keys(parsed));

    // Only archive keys that this source file actively owns and are no longer present.
    const ownedActiveKeys = new Set(
      existingKeys
        .filter((k) => k.sourceFileId === sourceFileId && k.status === "active")
        .map((k) => k.key)
    );

    let stringsAdded = 0;
    let stringsUpdated = 0;
    let stringsRemoved = 0;

    await db.transaction(async (tx) => {
      for (const [key, value] of Object.entries(parsed)) {
        const existing = existingByKey.get(key);

        if (!existing) {
          const keyId = uuid();
          await tx.insert(translationKeys).values({
            id: keyId,
            projectId: sourceFile.projectId,
            key,
            keyHash: keyHash(key),
            sourceFileId,
            status: "active",
            tags: [],
          });

          await tx.insert(translations).values({
            id: uuid(),
            keyId,
            locale: project.sourceLocale,
            value,
            state: "approved",
          });

          stringsAdded++;
        } else if (existing.status === "archived") {
          // Key was archived but has reappeared — reactivate it in place to
          // avoid a unique-constraint violation on (projectId, key).
          await tx
            .update(translationKeys)
            .set({ status: "active", sourceFileId, updatedAt: new Date() })
            .where(eq(translationKeys.id, existing.id));

          const sourceTranslation = existing.translations[0];
          if (!sourceTranslation) {
            await tx.insert(translations).values({
              id: uuid(),
              keyId: existing.id,
              locale: project.sourceLocale,
              value,
              state: "approved",
            });
          } else if (sourceTranslation.value !== value) {
            await tx
              .update(translations)
              .set({ value, updatedAt: new Date() })
              .where(eq(translations.id, sourceTranslation.id));
          }
          stringsAdded++;
        } else {
          const sourceTranslation = existing.translations[0];
          if (sourceTranslation && sourceTranslation.value !== value) {
            await tx
              .update(translations)
              .set({ value, updatedAt: new Date() })
              .where(eq(translations.id, sourceTranslation.id));

            // Mark all non-source translations as needs_review when source changes
            await tx
              .update(translations)
              .set({ state: "needs_review", updatedAt: new Date() })
              .where(
                and(
                  eq(translations.keyId, existing.id),
                  eq(translations.locale, project.sourceLocale)
                )
              );

            stringsUpdated++;
          } else if (!sourceTranslation) {
            await tx.insert(translations).values({
              id: uuid(),
              keyId: existing.id,
              locale: project.sourceLocale,
              value,
              state: "approved",
            });
            stringsAdded++;
          }
        }
      }

      // Archive keys owned by this source file that are no longer in it
      for (const [key, existing] of existingByKey) {
        if (ownedActiveKeys.has(key) && !incomingKeys.has(key)) {
          await tx
            .update(translationKeys)
            .set({ status: "archived", updatedAt: new Date() })
            .where(eq(translationKeys.id, existing.id));
          stringsRemoved++;
        }
      }

      await tx
        .update(sourceFiles)
        .set({ lastSyncedAt: new Date(), updatedAt: new Date(), rawContent: content, format: resolvedFormat })
        .where(eq(sourceFiles.id, sourceFileId));

      await tx
        .update(ingestJobs)
        .set({
          status: "done",
          stringsAdded,
          stringsUpdated,
          stringsRemoved,
          completedAt: new Date(),
        })
        .where(eq(ingestJobs.id, ingestJobId));
    });

    console.log(
      `[ingest] job ${ingestJobId} done: +${stringsAdded} ~${stringsUpdated} -${stringsRemoved}`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ingest] job ${ingestJobId} failed:`, message);

    await db
      .update(ingestJobs)
      .set({ status: "failed", error: message, completedAt: new Date() })
      .where(eq(ingestJobs.id, ingestJobId));

    throw err;
  }
}

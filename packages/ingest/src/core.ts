import { createHash } from "crypto";
import { and, eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import {
  db,
  ingestJobs,
  projectLocales,
  projects,
  sourceFiles,
  translationKeys,
  translations,
  vcsIntegrations,
} from "@fable/db";
import {
  detectFormat,
  getAdapter,
  inferOutputPattern,
  parseLinguiJsonDetailed,
  resolveOutputPath,
} from "@fable/formats";
import type { VcsProvider } from "./providers";

type IngestResult = {
  stringsAdded: number;
  stringsUpdated: number;
  stringsRemoved: number;
};

type VcsProviderFactoryInput = {
  installationId: string;
  repoOwner: string;
  repoName: string;
};

function keyHash(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export async function ingestSourceFile(opts: {
  ingestJobId: string;
  sourceFileId: string;
  createVcsProvider?: (
    integration: VcsProviderFactoryInput
  ) => VcsProvider;
}): Promise<IngestResult> {
  const { ingestJobId, sourceFileId } = opts;

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

  let resolvedFormat = sourceFile.format;
  let effectiveTranslationPattern = sourceFile.translationPattern;
  const result: IngestResult = {
    stringsAdded: 0,
    stringsUpdated: 0,
    stringsRemoved: 0,
  };

  try {
    let content: string;

    if (sourceFile.sourceType === "upload") {
      if (!sourceFile.rawContent) {
        throw new Error("SourceFile has no rawContent for upload type");
      }
      content = sourceFile.rawContent;
    } else {
      if (!sourceFile.vcsIntegrationId || !sourceFile.vcsPath) {
        throw new Error("SourceFile is missing VCS details");
      }
      if (!opts.createVcsProvider) {
        throw new Error("A VCS provider is required for VCS ingestion");
      }

      const integration = await db.query.vcsIntegrations.findFirst({
        where: eq(vcsIntegrations.id, sourceFile.vcsIntegrationId),
      });
      if (!integration) throw new Error("VCS integration not found");

      const provider = opts.createVcsProvider({
        installationId: integration.installationId,
        repoOwner: integration.repoOwner,
        repoName: integration.repoName,
      });
      content = await provider.fetchFile(
        sourceFile.vcsPath,
        sourceFile.vcsBranch ?? integration.defaultBranch
      );
    }

    const detectedFormat = detectFormat(sourceFile.name, content);
    resolvedFormat =
      sourceFile.formatOverride ?? detectedFormat ?? sourceFile.format;
    const adapter = getAdapter(resolvedFormat);
    const parsed = adapter.parse(content);

    const linguiTranslations = new Map<string, string>();
    if (resolvedFormat === "lingui_json") {
      for (const parsedString of parseLinguiJsonDetailed(content)) {
        if (parsedString.existingTranslation !== undefined) {
          linguiTranslations.set(
            parsedString.key,
            parsedString.existingTranslation
          );
        }
      }
    }

    const existingKeys = await db.query.translationKeys.findMany({
      where: eq(translationKeys.projectId, sourceFile.projectId),
      with: {
        translations: {
          where: eq(translations.locale, project.sourceLocale),
        },
      },
    });

    const existingByKey = new Map(existingKeys.map((key) => [key.key, key]));
    const incomingKeys = new Set(Object.keys(parsed));
    const ownedActiveKeys = new Set(
      existingKeys
        .filter((key) => key.sourceFileId === sourceFileId && key.status === "active")
        .map((key) => key.key)
    );

    const inferredTranslationPattern =
      sourceFile.sourceType === "vcs" &&
      sourceFile.vcsPath &&
      sourceFile.translationPattern === null
        ? inferOutputPattern(sourceFile.vcsPath, project.sourceLocale)
        : null;
    if (inferredTranslationPattern) {
      effectiveTranslationPattern = inferredTranslationPattern;
    }

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

          const existingTranslation = linguiTranslations.get(key);
          if (existingTranslation) {
            await tx.insert(translations).values({
              id: uuid(),
              keyId,
              locale: project.sourceLocale,
              value: existingTranslation,
              state: "suggested",
            });
          }

          result.stringsAdded++;
        } else if (existing.status === "archived") {
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
          result.stringsAdded++;
        } else {
          const sourceTranslation = existing.translations[0];
          if (sourceTranslation && sourceTranslation.value !== value) {
            await tx
              .update(translations)
              .set({ value, updatedAt: new Date() })
              .where(eq(translations.id, sourceTranslation.id));

            await tx
              .update(translations)
              .set({ state: "needs_review", updatedAt: new Date() })
              .where(
                and(
                  eq(translations.keyId, existing.id),
                  eq(translations.locale, project.sourceLocale)
                )
              );

            result.stringsUpdated++;
          } else if (!sourceTranslation) {
            await tx.insert(translations).values({
              id: uuid(),
              keyId: existing.id,
              locale: project.sourceLocale,
              value,
              state: "approved",
            });
            result.stringsAdded++;
          }
        }
      }

      for (const [key, existing] of existingByKey) {
        if (ownedActiveKeys.has(key) && !incomingKeys.has(key)) {
          await tx
            .update(translationKeys)
            .set({ status: "archived", updatedAt: new Date() })
            .where(eq(translationKeys.id, existing.id));
          result.stringsRemoved++;
        }
      }

      await tx
        .update(sourceFiles)
        .set({
          lastSyncedAt: new Date(),
          updatedAt: new Date(),
          rawContent: content,
          format: resolvedFormat,
          ...(inferredTranslationPattern
            ? { translationPattern: inferredTranslationPattern }
            : {}),
        })
        .where(eq(sourceFiles.id, sourceFileId));

      await tx
        .update(ingestJobs)
        .set({
          status: "done",
          stringsAdded: result.stringsAdded,
          stringsUpdated: result.stringsUpdated,
          stringsRemoved: result.stringsRemoved,
          completedAt: new Date(),
        })
        .where(eq(ingestJobs.id, ingestJobId));
    });

    console.log(
      `[ingest] job ${ingestJobId} done format=${resolvedFormat}: +${result.stringsAdded} ~${result.stringsUpdated} -${result.stringsRemoved}`
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

  if (
    sourceFile.sourceType === "vcs" &&
    sourceFile.vcsIntegrationId &&
    sourceFile.vcsPath &&
    opts.createVcsProvider
  ) {
    try {
      const integration = await db.query.vcsIntegrations.findFirst({
        where: eq(vcsIntegrations.id, sourceFile.vcsIntegrationId),
      });
      if (!integration) return result;

      const provider = opts.createVcsProvider({
        installationId: integration.installationId,
        repoOwner: integration.repoOwner,
        repoName: integration.repoName,
      });
      const targetLocales = await db.query.projectLocales.findMany({
        where: and(
          eq(projectLocales.projectId, sourceFile.projectId),
          eq(projectLocales.isSource, false)
        ),
      });

      for (const { locale: targetLocale } of targetLocales) {
        const translationPath = resolveOutputPath(
          {
            path: sourceFile.vcsPath,
            translationPattern: effectiveTranslationPattern,
          },
          project.sourceLocale,
          targetLocale
        );
        if (!translationPath || translationPath === sourceFile.vcsPath) continue;

        let localeContent: string;
        try {
          localeContent = await provider.fetchFile(
            translationPath,
            sourceFile.vcsBranch ?? integration.defaultBranch
          );
        } catch {
          continue;
        }

        let parsedLocale: Record<string, string>;
        try {
          parsedLocale = getAdapter(resolvedFormat).parseTranslation(
            localeContent
          );
        } catch {
          continue;
        }

        const currentKeys = await db.query.translationKeys.findMany({
          where: and(
            eq(translationKeys.projectId, sourceFile.projectId),
            eq(translationKeys.sourceFileId, sourceFileId)
          ),
          with: {
            translations: {
              where: eq(translations.locale, targetLocale),
            },
          },
        });

        const keyByKey = new Map(currentKeys.map((key) => [key.key, key]));

        await db.transaction(async (tx) => {
          for (const [key, value] of Object.entries(parsedLocale)) {
            if (!value.trim()) continue;
            const keyRecord = keyByKey.get(key);
            if (!keyRecord) continue;
            if (keyRecord.translations.length === 0) {
              await tx.insert(translations).values({
                id: uuid(),
                keyId: keyRecord.id,
                locale: targetLocale,
                value,
                state: "approved",
              });
            }
          }
        });

        console.log(
          `[ingest] imported existing translations for ${targetLocale} from ${translationPath}`
        );
      }
    } catch (err) {
      console.error(
        `[ingest] locale detection failed for job ${ingestJobId}:`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  return result;
}

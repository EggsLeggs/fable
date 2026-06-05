import { z } from "zod";
import { eq, and, desc, gt, inArray, sql } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import {
  projects,
  orgMembers,
  sourceFiles,
  vcsIntegrations,
  pushJobs,
  translationKeys,
  translations,
  projectLocales,
} from "@fable/db";
import { resolveOutputPath, getAdapter } from "@fable/formats";
import { logActivity } from "../log-activity";

async function assertProjectAccess(
  db: import("@fable/db").Db,
  userId: string,
  projectId: string
) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) throw new TRPCError({ code: "NOT_FOUND" });
  const member = await db.query.orgMembers.findFirst({
    where: and(
      eq(orgMembers.userId, userId),
      eq(orgMembers.orgId, project.orgId)
    ),
  });
  if (!member) throw new TRPCError({ code: "FORBIDDEN" });
  return { project, member };
}

export const exportRouter = router({
  preview: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        locales: z.array(z.string()).min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      const { project } = await assertProjectAccess(
        ctx.db,
        ctx.session.user.id,
        input.projectId
      );

      const files = await ctx.db.query.sourceFiles.findMany({
        where: and(
          eq(sourceFiles.projectId, input.projectId),
          eq(sourceFiles.status, "active")
        ),
      });

      const integrations = await ctx.db.query.vcsIntegrations.findMany({
        where: eq(vcsIntegrations.projectId, input.projectId),
      });

      const integrationMap = new Map(integrations.map((i) => [i.id, i]));

      type VcsTarget = {
        integrationId: string;
        repoOwner: string;
        repoName: string;
        branch: string;
        files: Array<{
          sourceFileName: string;
          outputPath: string;
          locale: string;
        }>;
      };

      const vcsTargetsMap = new Map<string, VcsTarget>();
      const downloadTargets: Array<{
        sourceFileName: string;
        outputPath: string;
        locale: string;
      }> = [];
      const skipped: Array<{
        sourceFileName: string;
        locale: string;
        reason: string;
      }> = [];

      for (const file of files) {
        for (const locale of input.locales) {
          const outputPath = resolveOutputPath(file, project.sourceLocale, locale);
          if (!outputPath) {
            skipped.push({
              sourceFileName: file.name,
              locale,
              reason: "Cannot infer output path - no locale segment found in source path",
            });
            continue;
          }

          if (file.sourceType === "vcs" && file.vcsIntegrationId) {
            const integration = integrationMap.get(file.vcsIntegrationId);
            if (!integration) continue;

            if (!vcsTargetsMap.has(file.vcsIntegrationId)) {
              vcsTargetsMap.set(file.vcsIntegrationId, {
                integrationId: integration.id,
                repoOwner: integration.repoOwner,
                repoName: integration.repoName,
                branch: integration.translationBranch,
                files: [],
              });
            }
            vcsTargetsMap.get(file.vcsIntegrationId)!.files.push({
              sourceFileName: file.name,
              outputPath,
              locale,
            });
          } else {
            downloadTargets.push({
              sourceFileName: file.name,
              outputPath,
              locale,
            });
          }
        }
      }

      // Compute completion percentages for each locale
      const totalActiveKeys = await ctx.db.query.translationKeys.findMany({
        where: and(
          eq(translationKeys.projectId, input.projectId),
          eq(translationKeys.status, "active")
        ),
        columns: { id: true },
      });
      const totalCount = totalActiveKeys.length;
      const keyIds = totalActiveKeys.map((k) => k.id);

      const localeProgress: Record<string, number> = {};
      if (totalCount > 0 && keyIds.length > 0) {
        for (const locale of input.locales) {
          const approved = await ctx.db.query.translations.findMany({
            where: and(
              eq(translations.locale, locale),
              eq(translations.state, "approved")
            ),
            columns: { keyId: true },
          });
          const approvedInProject = approved.filter((t) =>
            keyIds.includes(t.keyId)
          ).length;
          localeProgress[locale] = Math.round((approvedInProject / totalCount) * 100);
        }
      }

      return {
        vcsTargets: Array.from(vcsTargetsMap.values()),
        downloadTargets,
        skipped,
        localeProgress,
        hasVcsIntegrations: integrations.length > 0,
      };
    }),

  triggerPush: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        vcsIntegrationId: z.string(),
        locales: z.array(z.string()).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.pushTranslationsQueue) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Push translations queue is not available",
        });
      }

      await assertProjectAccess(ctx.db, ctx.session.user.id, input.projectId);

      const integration = await ctx.db.query.vcsIntegrations.findFirst({
        where: and(
          eq(vcsIntegrations.id, input.vcsIntegrationId),
          eq(vcsIntegrations.projectId, input.projectId)
        ),
      });
      if (!integration) throw new TRPCError({ code: "NOT_FOUND" });

      const pushJobId = uuid();
      await ctx.db.insert(pushJobs).values({
        id: pushJobId,
        projectId: input.projectId,
        vcsIntegrationId: input.vcsIntegrationId,
        locales: input.locales,
        status: "queued",
      });

      await ctx.pushTranslationsQueue.add(
        "push-translations",
        { pushJobId },
        { jobId: pushJobId }
      );

      await logActivity(ctx.db, {
        projectId: input.projectId,
        userId: ctx.session.user.id,
        type: "translations_pushed",
        metadata: {
          provider: integration.provider,
          repoOwner: integration.repoOwner,
          repoName: integration.repoName,
          locales: input.locales,
        },
      });

      return { jobId: pushJobId };
    }),

  getPushJob: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ ctx, input }) => {
      const job = await ctx.db.query.pushJobs.findFirst({
        where: eq(pushJobs.id, input.jobId),
      });
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });
      await assertProjectAccess(ctx.db, ctx.session.user.id, job.projectId);
      return job;
    }),

  listPushJobs: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertProjectAccess(ctx.db, ctx.session.user.id, input.projectId);
      return ctx.db.query.pushJobs.findMany({
        where: eq(pushJobs.projectId, input.projectId),
        orderBy: [desc(pushJobs.createdAt)],
        limit: 10,
        with: { vcsIntegration: { columns: { repoOwner: true, repoName: true } } },
      });
    }),

  getLocalesWithProgress: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { project } = await assertProjectAccess(
        ctx.db,
        ctx.session.user.id,
        input.projectId
      );

      const locales = await ctx.db.query.projectLocales.findMany({
        where: and(
          eq(projectLocales.projectId, input.projectId),
          eq(projectLocales.isSource, false)
        ),
      });

      const allKeys = await ctx.db.query.translationKeys.findMany({
        where: and(
          eq(translationKeys.projectId, input.projectId),
          eq(translationKeys.status, "active")
        ),
        columns: { id: true },
      });
      const totalCount = allKeys.length;
      const keyIds = allKeys.map((k) => k.id);

      const result = await Promise.all(
        locales.map(async (loc) => {
          if (totalCount === 0) return { locale: loc.locale, progress: 0 };
          const approved = await ctx.db.query.translations.findMany({
            where: and(
              eq(translations.locale, loc.locale),
              eq(translations.state, "approved")
            ),
            columns: { keyId: true },
          });
          const approvedCount = approved.filter((t) =>
            keyIds.includes(t.keyId)
          ).length;
          return {
            locale: loc.locale,
            progress: Math.round((approvedCount / totalCount) * 100),
          };
        })
      );

      return { locales: result, sourceLocale: project.sourceLocale };
    }),

  getLocalePushStatus: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertProjectAccess(ctx.db, ctx.session.user.id, input.projectId);

      const locales = await ctx.db.query.projectLocales.findMany({
        where: and(
          eq(projectLocales.projectId, input.projectId),
          eq(projectLocales.isSource, false)
        ),
      });

      // Most recent completed push job per locale — use a subquery via raw SQL
      // so we avoid N+1 queries for potentially many locales.
      const completedJobs = await ctx.db.query.pushJobs.findMany({
        where: and(
          eq(pushJobs.projectId, input.projectId),
          eq(pushJobs.status, "done")
        ),
        orderBy: [desc(pushJobs.completedAt)],
        columns: { id: true, locales: true, completedAt: true },
      });

      // For each locale, find the most recent push job that included it
      const lastPushedAtByLocale = new Map<string, Date>();
      for (const job of completedJobs) {
        for (const locale of job.locales) {
          if (!lastPushedAtByLocale.has(locale) && job.completedAt) {
            lastPushedAtByLocale.set(locale, job.completedAt);
          }
        }
      }

      // Get all active translation keys for the project
      const allKeys = await ctx.db.query.translationKeys.findMany({
        where: and(
          eq(translationKeys.projectId, input.projectId),
          eq(translationKeys.status, "active")
        ),
        columns: { id: true },
      });
      const keyIds = allKeys.map((k) => k.id);

      if (keyIds.length === 0) {
        return locales.map((l) => ({
          locale: l.locale,
          lastPushedAt: lastPushedAtByLocale.get(l.locale) ?? null,
          hasUnpushedChanges: false,
        }));
      }

      // For each locale, check if any approved translations were updated after the last push
      const result = await Promise.all(
        locales.map(async (loc) => {
          const lastPushedAt = lastPushedAtByLocale.get(loc.locale) ?? null;

          // Count approved translations updated after last push (or all if never pushed)
          const approvedSincePush = await ctx.db.query.translations.findFirst({
            where: and(
              inArray(translations.keyId, keyIds),
              eq(translations.locale, loc.locale),
              eq(translations.state, "approved"),
              lastPushedAt
                ? gt(translations.updatedAt, lastPushedAt)
                : sql`true`
            ),
            columns: { id: true },
          });

          return {
            locale: loc.locale,
            lastPushedAt,
            hasUnpushedChanges: !!approvedSincePush,
          };
        })
      );

      return result;
    }),
});

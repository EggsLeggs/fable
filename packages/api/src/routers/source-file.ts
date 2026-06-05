import { z } from "zod";
import { eq, and, desc, count, ilike, or, isNull, asc, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import {
  projects,
  orgMembers,
  sourceFiles,
  ingestJobs,
  translationKeys,
  translations,
  vcsIntegrations,
  githubInstallations,
  type Db,
} from "@fable/db";
import { logActivity } from "../log-activity";
import { assertGitHubAppConfigured } from "../integration-config";

async function assertProjectAccess(db: Db, userId: string, projectId: string) {
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

export const sourceFileRouter = router({
  get: protectedProcedure
    .input(z.object({ sourceFileId: z.string() }))
    .query(async ({ ctx, input }) => {
      const file = await ctx.db.query.sourceFiles.findFirst({
        where: eq(sourceFiles.id, input.sourceFileId),
      });
      if (!file) throw new TRPCError({ code: "NOT_FOUND" });
      await assertProjectAccess(ctx.db, ctx.session.user.id, file.projectId);
      return file;
    }),

  list: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertProjectAccess(ctx.db, ctx.session.user.id, input.projectId);

      const files = await ctx.db.query.sourceFiles.findMany({
        where: and(
          eq(sourceFiles.projectId, input.projectId),
          eq(sourceFiles.status, "active")
        ),
        orderBy: [desc(sourceFiles.createdAt)],
        with: {
          ingestJobs: {
            orderBy: [desc(ingestJobs.createdAt)],
            limit: 1,
          },
        },
      });

      const keyCounts = await ctx.db
        .select({
          sourceFileId: translationKeys.sourceFileId,
          count: count(),
        })
        .from(translationKeys)
        .where(eq(translationKeys.status, "active"))
        .groupBy(translationKeys.sourceFileId);

      const countMap = new Map(
        keyCounts
          .filter((r) => r.sourceFileId !== null)
          .map((r) => [r.sourceFileId!, r.count])
      );

      return files.map((f) => ({
        ...f,
        keyCount: countMap.get(f.id) ?? 0,
        latestIngestJob: f.ingestJobs[0] ?? null,
      }));
    }),

  getIngestJobs: protectedProcedure
    .input(
      z.object({
        sourceFileId: z.string(),
        limit: z.number().int().min(1).max(50).default(20),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const file = await ctx.db.query.sourceFiles.findFirst({
        where: eq(sourceFiles.id, input.sourceFileId),
      });
      if (!file) throw new TRPCError({ code: "NOT_FOUND" });
      await assertProjectAccess(ctx.db, ctx.session.user.id, file.projectId);

      return ctx.db.query.ingestJobs.findMany({
        where: eq(ingestJobs.sourceFileId, input.sourceFileId),
        orderBy: [desc(ingestJobs.createdAt)],
        limit: input.limit,
        offset: input.offset,
      });
    }),

  getIngestJob: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ ctx, input }) => {
      const job = await ctx.db.query.ingestJobs.findFirst({
        where: eq(ingestJobs.id, input.jobId),
        with: { sourceFile: true },
      });
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });
      await assertProjectAccess(
        ctx.db,
        ctx.session.user.id,
        job.sourceFile.projectId
      );
      return job;
    }),

  archive: protectedProcedure
    .input(z.object({ sourceFileId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const file = await ctx.db.query.sourceFiles.findFirst({
        where: eq(sourceFiles.id, input.sourceFileId),
      });
      if (!file) throw new TRPCError({ code: "NOT_FOUND" });
      await assertProjectAccess(ctx.db, ctx.session.user.id, file.projectId);

      await ctx.db.transaction(async (tx) => {
        await tx
          .update(sourceFiles)
          .set({ status: "archived", updatedAt: new Date() })
          .where(eq(sourceFiles.id, input.sourceFileId));

        await tx
          .update(translationKeys)
          .set({ status: "archived", updatedAt: new Date() })
          .where(eq(translationKeys.sourceFileId, input.sourceFileId));
      });

      await logActivity(ctx.db, {
        projectId: file.projectId,
        userId: ctx.session.user.id,
        type: "source_deleted",
        metadata: { sourceId: file.id, name: file.name, sourcePath: file.path },
      });

      return { success: true };
    }),

  createVcsIntegration: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        repoOwner: z.string(),
        repoName: z.string(),
        defaultBranch: z.string().default("main"),
        translationBranch: z.string().default("l10n_localise"),
        filePatterns: z.array(z.string()).default([]),
        pushMode: z.enum(["pull_request", "direct_push", "disabled"]).default("pull_request"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertProjectAccess(ctx.db, ctx.session.user.id, input.projectId);
      assertGitHubAppConfigured();

      const ghInstallation = await ctx.db.query.githubInstallations.findFirst({
        where: eq(githubInstallations.userId, ctx.session.user.id),
      });
      if (!ghInstallation) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Connect your GitHub account in Settings before adding a repository.",
        });
      }

      const [integration] = await ctx.db
        .insert(vcsIntegrations)
        .values({
          id: uuid(),
          projectId: input.projectId,
          provider: "github",
          installationId: ghInstallation.installationId,
          repoOwner: input.repoOwner,
          repoName: input.repoName,
          defaultBranch: input.defaultBranch,
          translationBranch: input.translationBranch,
          pushMode: input.pushMode,
          filePatterns: input.filePatterns,
        })
        .returning();

      await logActivity(ctx.db, {
        projectId: input.projectId,
        userId: ctx.session.user.id,
        type: "integration_created",
        metadata: {
          provider: "github",
          repoOwner: input.repoOwner,
          repoName: input.repoName,
        },
      });

      return integration!;
    }),

  updateVcsIntegration: protectedProcedure
    .input(
      z.object({
        integrationId: z.string(),
        defaultBranch: z.string().min(1).optional(),
        filePatterns: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const integration = await ctx.db.query.vcsIntegrations.findFirst({
        where: eq(vcsIntegrations.id, input.integrationId),
      });
      if (!integration) throw new TRPCError({ code: "NOT_FOUND" });
      await assertProjectAccess(ctx.db, ctx.session.user.id, integration.projectId);

      const [updated] = await ctx.db
        .update(vcsIntegrations)
        .set({
          ...(input.defaultBranch !== undefined && { defaultBranch: input.defaultBranch }),
          ...(input.filePatterns !== undefined && { filePatterns: input.filePatterns }),
          updatedAt: new Date(),
        })
        .where(eq(vcsIntegrations.id, input.integrationId))
        .returning();

      await logActivity(ctx.db, {
        projectId: integration.projectId,
        userId: ctx.session.user.id,
        type: "integration_updated",
        metadata: {
          provider: integration.provider,
          repoOwner: integration.repoOwner,
          repoName: integration.repoName,
        },
      });

      return updated!;
    }),

  listVcsIntegrations: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertProjectAccess(ctx.db, ctx.session.user.id, input.projectId);

      return ctx.db.query.vcsIntegrations.findMany({
        where: eq(vcsIntegrations.projectId, input.projectId),
        orderBy: (t, { desc }) => [desc(t.createdAt)],
      });
    }),

  listSourceStrings: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        sourceFileId: z.string().optional(),
        q: z.string().optional(),
        label: z.string().optional(),
        status: z.enum(["active", "archived"]).default("active"),
        missingContext: z.boolean().optional(),
        limit: z.number().int().min(1).max(200).default(100),
        cursor: z.number().int().min(1).default(1),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertProjectAccess(ctx.db, ctx.session.user.id, input.projectId);

      const project = await ctx.db.query.projects.findFirst({
        where: eq(projects.id, input.projectId),
        columns: { sourceLocale: true },
      });
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });

      const limit = input.limit;
      const offset = (input.cursor - 1) * limit;

      const conditions: SQL[] = [
        eq(translationKeys.projectId, input.projectId),
        eq(translationKeys.status, input.status),
      ];

      if (input.sourceFileId) {
        conditions.push(eq(translationKeys.sourceFileId, input.sourceFileId));
      }

      if (input.missingContext) {
        conditions.push(isNull(translationKeys.description));
      }

      if (input.label) {
        conditions.push(
          sql`${translationKeys.tags} @> ${JSON.stringify([input.label])}::jsonb`
        );
      }

      if (input.q) {
        const searchCond = or(
          ilike(translationKeys.key, `%${input.q}%`),
          ilike(translations.value, `%${input.q}%`)
        );
        if (searchCond) conditions.push(searchCond);
      }

      const whereClause = and(...conditions);

      const rows = await ctx.db
        .select({
          id: translationKeys.id,
          key: translationKeys.key,
          context: translationKeys.description,
          labels: translationKeys.tags,
          screenshot: translationKeys.screenshot,
          status: translationKeys.status,
          value: translations.value,
          sfId: sourceFiles.id,
          sfName: sourceFiles.name,
          sfFormat: sourceFiles.format,
        })
        .from(translationKeys)
        .leftJoin(
          translations,
          and(
            eq(translations.keyId, translationKeys.id),
            eq(translations.locale, project.sourceLocale)
          )
        )
        .leftJoin(sourceFiles, eq(sourceFiles.id, translationKeys.sourceFileId))
        .where(whereClause)
        .orderBy(asc(translationKeys.key))
        .limit(limit + 1)
        .offset(offset);

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;

      let total: number | undefined;
      if (input.cursor === 1) {
        const [countResult] = await ctx.db
          .select({ total: count() })
          .from(translationKeys)
          .leftJoin(
            translations,
            and(
              eq(translations.keyId, translationKeys.id),
              eq(translations.locale, project.sourceLocale)
            )
          )
          .leftJoin(sourceFiles, eq(sourceFiles.id, translationKeys.sourceFileId))
          .where(whereClause);
        total = countResult?.total ?? 0;
      }

      return {
        strings: items.map((r) => ({
          id: r.id,
          key: r.key,
          value: r.value ?? null,
          context: r.context ?? null,
          labels: r.labels ?? [],
          hasScreenshot: !!r.screenshot,
          status: r.status,
          sourceFile: r.sfId
            ? { id: r.sfId, name: r.sfName!, format: r.sfFormat! }
            : null,
        })),
        total,
        nextCursor: hasMore ? input.cursor + 1 : null,
      };
    }),
});

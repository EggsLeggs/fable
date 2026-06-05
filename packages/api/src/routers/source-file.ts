import { z } from "zod";
import { eq, and, desc, count } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import {
  projects,
  orgMembers,
  sourceFiles,
  ingestJobs,
  translationKeys,
  vcsIntegrations,
  githubInstallations,
  type Db,
} from "@fable/db";

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
});

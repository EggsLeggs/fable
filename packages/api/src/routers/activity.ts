import { z } from "zod";
import { and, desc, eq, gte, inArray, isNotNull, lt, lte } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { activityLog, projects, orgMembers } from "@fable/db";
import { TRPCError } from "@trpc/server";
import type { Db } from "@fable/db";

const PAGE_SIZE = 50;

const ACTIVITY_TYPE_VALUES = [
  "project_created",
  "project_updated",
  "locale_added",
  "locale_removed",
  "source_created",
  "source_updated",
  "source_deleted",
  "member_joined",
  "member_left",
  "task_created",
  "task_updated",
  "task_deleted",
  "integration_created",
  "integration_updated",
  "integration_deleted",
  "translation_suggested",
  "translation_approved",
  "translation_rejected",
  "comment_added",
] as const;

async function assertProjectAccess(db: Db, userId: string, projectId: string) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) throw new TRPCError({ code: "NOT_FOUND" });
  const member = await db.query.orgMembers.findFirst({
    where: and(eq(orgMembers.userId, userId), eq(orgMembers.orgId, project.orgId)),
  });
  if (!member) throw new TRPCError({ code: "FORBIDDEN" });
  return { project, member };
}

export const activityRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        types: z.array(z.enum(ACTIVITY_TYPE_VALUES)).optional(),
        locale: z.string().optional(),
        userId: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertProjectAccess(ctx.db, ctx.session.user.id, input.projectId);

      const filters = [eq(activityLog.projectId, input.projectId)];

      if (input.types?.length) {
        filters.push(inArray(activityLog.type, input.types));
      }
      if (input.userId) {
        filters.push(eq(activityLog.userId, input.userId));
      }
      if (input.locale) {
        filters.push(eq(activityLog.locale, input.locale));
      }
      if (input.from) {
        filters.push(gte(activityLog.createdAt, new Date(input.from)));
      }
      if (input.to) {
        // Add 1 day so the "to" date is inclusive of the full day
        const toDate = new Date(input.to);
        toDate.setDate(toDate.getDate() + 1);
        filters.push(lte(activityLog.createdAt, toDate));
      }
      if (input.cursor) {
        filters.push(lt(activityLog.createdAt, new Date(input.cursor)));
      }

      const items = await ctx.db.query.activityLog.findMany({
        where: and(...filters),
        orderBy: [desc(activityLog.createdAt)],
        limit: PAGE_SIZE + 1,
        with: {
          user: {
            columns: { id: true, name: true, username: true, email: true, image: true },
          },
        },
      });

      const hasMore = items.length > PAGE_SIZE;
      if (hasMore) items.pop();

      const nextCursor =
        hasMore ? items[items.length - 1]?.createdAt.toISOString() ?? null : null;

      return { items, nextCursor };
    }),

  listActors: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertProjectAccess(ctx.db, ctx.session.user.id, input.projectId);

      const rows = await ctx.db
        .selectDistinct({ userId: activityLog.userId })
        .from(activityLog)
        .where(
          and(
            eq(activityLog.projectId, input.projectId),
            isNotNull(activityLog.userId)
          )
        );

      if (rows.length === 0) return [];

      const userIds = rows.map((r) => r.userId).filter((id): id is string => id !== null);

      const actorProfiles = await ctx.db.query.users.findMany({
        where: (u, { inArray: inArr }) => inArr(u.id, userIds),
        columns: { id: true, name: true, username: true, email: true, image: true },
      });

      return actorProfiles;
    }),
});

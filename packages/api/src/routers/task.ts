import { z } from "zod";
import { eq, and, or, ne, gte, isNull } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { router, protectedProcedure } from "../trpc";
import { tasks, projects, orgMembers } from "@fable/db";
import { TRPCError } from "@trpc/server";
import type { Db } from "@fable/db";

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

const taskStatusValues = ["todo", "in_progress", "done"] as const;

export const taskRouter = router({
  list: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertProjectAccess(ctx.db, ctx.session.user.id, input.projectId);

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      return ctx.db.query.tasks.findMany({
        where: and(
          eq(tasks.projectId, input.projectId),
          isNull(tasks.deletedAt),
          or(
            ne(tasks.status, "done"),
            gte(tasks.updatedAt, thirtyDaysAgo)
          )
        ),
        with: {
          assignedToUser: { columns: { id: true, name: true, email: true, username: true } },
          createdByUser: { columns: { id: true, name: true, email: true, username: true } },
          sourceFile: { columns: { id: true, name: true } },
        },
        orderBy: (t, { asc }) => [asc(t.createdAt)],
      });
    }),

  get: protectedProcedure
    .input(z.object({ taskId: z.string() }))
    .query(async ({ ctx, input }) => {
      const task = await ctx.db.query.tasks.findFirst({
        where: and(eq(tasks.id, input.taskId), isNull(tasks.deletedAt)),
        with: {
          assignedToUser: { columns: { id: true, name: true, email: true, username: true } },
          createdByUser: { columns: { id: true, name: true, email: true, username: true } },
          sourceFile: { columns: { id: true, name: true } },
        },
      });
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });
      await assertProjectAccess(ctx.db, ctx.session.user.id, task.projectId);
      return task;
    }),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        title: z.string().min(1).max(255),
        description: z.string().max(2000).optional(),
        status: z.enum(taskStatusValues).default("todo"),
        locale: z.string().optional(),
        sourceFileId: z.string().optional(),
        assignedTo: z.string().optional(),
        dueDate: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertProjectAccess(ctx.db, ctx.session.user.id, input.projectId);
      const [task] = await ctx.db
        .insert(tasks)
        .values({
          id: uuid(),
          projectId: input.projectId,
          title: input.title,
          description: input.description ?? null,
          status: input.status,
          locale: input.locale ?? null,
          sourceFileId: input.sourceFileId ?? null,
          assignedTo: input.assignedTo ?? null,
          createdBy: ctx.session.user.id,
          dueDate: input.dueDate ?? null,
        })
        .returning();
      return task!;
    }),

  update: protectedProcedure
    .input(
      z.object({
        taskId: z.string(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().max(2000).nullable().optional(),
        status: z.enum(taskStatusValues).optional(),
        locale: z.string().nullable().optional(),
        sourceFileId: z.string().nullable().optional(),
        assignedTo: z.string().nullable().optional(),
        dueDate: z.date().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.db.query.tasks.findFirst({
        where: and(eq(tasks.id, input.taskId), isNull(tasks.deletedAt)),
      });
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });
      await assertProjectAccess(ctx.db, ctx.session.user.id, task.projectId);

      const { taskId, ...data } = input;
      const [updated] = await ctx.db
        .update(tasks)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(tasks.id, taskId))
        .returning();
      return updated!;
    }),

  delete: protectedProcedure
    .input(z.object({ taskId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.db.query.tasks.findFirst({
        where: and(eq(tasks.id, input.taskId), isNull(tasks.deletedAt)),
      });
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });
      const { member } = await assertProjectAccess(
        ctx.db,
        ctx.session.user.id,
        task.projectId
      );
      if (member.role === "member" || member.role === "translator") {
        if (task.createdBy !== ctx.session.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      }
      await ctx.db
        .update(tasks)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(tasks.id, input.taskId));
    }),
});

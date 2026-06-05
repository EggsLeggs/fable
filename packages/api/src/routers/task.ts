import { z } from "zod";
import { eq, and, or, ne, gte, isNull } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { router, protectedProcedure } from "../trpc";
import { tasks, projects, orgMembers } from "@fable/db";
import { TRPCError } from "@trpc/server";
import type { Db } from "@fable/db";
import { logActivity } from "../log-activity";

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
      const taskId = uuid();
      const [task] = await ctx.db
        .insert(tasks)
        .values({
          id: taskId,
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

      await logActivity(ctx.db, {
        projectId: input.projectId,
        userId: ctx.session.user.id,
        type: "task_created",
        locale: input.locale ?? null,
        metadata: {
          taskId,
          taskTitle: input.title,
          taskLocale: input.locale ?? null,
          taskStatus: input.status,
        },
      });

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

      const changes: Record<string, { from: unknown; to: unknown }> = {};
      if (data.title !== undefined && data.title !== task.title) {
        changes.title = { from: task.title, to: data.title };
      }
      if (data.status !== undefined && data.status !== task.status) {
        changes.status = { from: task.status, to: data.status };
      }
      if ("locale" in data && data.locale !== task.locale) {
        changes.locale = { from: task.locale, to: data.locale };
      }
      if ("assignedTo" in data && data.assignedTo !== task.assignedTo) {
        changes.assignedTo = { from: task.assignedTo, to: data.assignedTo };
      }
      if ("dueDate" in data) {
        const fromIso = task.dueDate?.toISOString() ?? null;
        const toIso = data.dueDate instanceof Date ? data.dueDate.toISOString() : (data.dueDate ?? null);
        if (fromIso !== toIso) {
          changes.dueDate = { from: fromIso, to: toIso };
        }
      }

      const newLocale = (data.locale !== undefined ? data.locale : task.locale) ?? null;
      await logActivity(ctx.db, {
        projectId: task.projectId,
        userId: ctx.session.user.id,
        type: "task_updated",
        locale: newLocale,
        metadata: {
          taskId,
          taskTitle: data.title ?? task.title,
          taskLocale: newLocale,
          taskStatus: data.status ?? task.status,
          changes: Object.keys(changes).length > 0 ? changes : undefined,
        },
      });

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

      await logActivity(ctx.db, {
        projectId: task.projectId,
        userId: ctx.session.user.id,
        type: "task_deleted",
        metadata: { taskId: input.taskId, taskTitle: task.title },
      });
    }),
});

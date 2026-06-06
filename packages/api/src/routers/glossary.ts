import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import {
  glossaryEntries,
  glossaryTranslations,
  orgMembers,
  projects,
  type Db,
} from "@fable/db";

const ADMIN_ROLES = ["owner", "admin", "member"] as const;

async function resolveGlossaryAccess(
  db: Db,
  userId: string,
  projectId: string
) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    columns: { orgId: true, glossaryAccess: true },
  });
  if (!project) throw new TRPCError({ code: "NOT_FOUND" });

  const member = await db.query.orgMembers.findFirst({
    where: and(
      eq(orgMembers.orgId, project.orgId),
      eq(orgMembers.userId, userId)
    ),
    columns: { role: true },
  });
  if (!member) throw new TRPCError({ code: "FORBIDDEN" });

  return { project, member };
}

export const glossaryRouter = router({
  getContext: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { project, member } = await resolveGlossaryAccess(
        ctx.db,
        ctx.session.user.id,
        input.projectId
      );
      return {
        glossaryAccess: project.glossaryAccess,
        role: member.role,
      };
    }),

  list: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { project, member } = await resolveGlossaryAccess(
        ctx.db,
        ctx.session.user.id,
        input.projectId
      );

      const isAdmin = (ADMIN_ROLES as readonly string[]).includes(member.role);
      if (!isAdmin && project.glossaryAccess === "readonly" && member.role === "translator") {
        // readonly translators can still view — access is not blocked, only writes are
      }
      if (!isAdmin && member.role === "translator" && project.glossaryAccess === "readonly") {
        // fall through — readonly translators see approved entries
      }

      const entries = await ctx.db.query.glossaryEntries.findMany({
        where: and(
          eq(glossaryEntries.orgId, project.orgId),
          eq(glossaryEntries.status, "approved")
        ),
        with: {
          translations: true,
          submittedByUser: { columns: { id: true, name: true, username: true } },
        },
        orderBy: (t, { asc }) => [asc(t.term)],
      });

      return entries;
    }),

  listPending: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { project, member } = await resolveGlossaryAccess(
        ctx.db,
        ctx.session.user.id,
        input.projectId
      );

      if (!(ADMIN_ROLES as readonly string[]).includes(member.role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const entries = await ctx.db.query.glossaryEntries.findMany({
        where: and(
          eq(glossaryEntries.orgId, project.orgId),
          eq(glossaryEntries.status, "pending")
        ),
        with: {
          translations: true,
          submittedByUser: { columns: { id: true, name: true, username: true } },
        },
        orderBy: (t, { asc }) => [asc(t.createdAt)],
      });

      return entries;
    }),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        term: z.string().min(1).max(200),
        definition: z.string().max(500).optional(),
        forbidden: z.boolean().default(false),
        caseSensitive: z.boolean().default(false),
        sourceLocale: z.string().min(2).max(10),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { project, member } = await resolveGlossaryAccess(
        ctx.db,
        ctx.session.user.id,
        input.projectId
      );

      const isAdmin = (ADMIN_ROLES as readonly string[]).includes(member.role);

      if (!isAdmin && member.role === "translator") {
        if (project.glossaryAccess === "readonly") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      }

      const autoApproved =
        isAdmin ||
        (member.role === "translator" && project.glossaryAccess === "full");

      const [entry] = await ctx.db
        .insert(glossaryEntries)
        .values({
          id: randomUUID(),
          orgId: project.orgId,
          sourceLocale: input.sourceLocale,
          term: input.term,
          definition: input.definition ?? null,
          forbidden: input.forbidden,
          caseSensitive: input.caseSensitive,
          status: autoApproved ? "approved" : "pending",
          submittedBy: ctx.session.user.id,
        })
        .returning();

      return entry!;
    }),

  approve: protectedProcedure
    .input(z.object({ id: z.string(), projectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { member } = await resolveGlossaryAccess(
        ctx.db,
        ctx.session.user.id,
        input.projectId
      );

      if (!(ADMIN_ROLES as readonly string[]).includes(member.role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const [entry] = await ctx.db
        .update(glossaryEntries)
        .set({ status: "approved", updatedAt: new Date() })
        .where(eq(glossaryEntries.id, input.id))
        .returning();

      if (!entry) throw new TRPCError({ code: "NOT_FOUND" });
      return entry;
    }),

  reject: protectedProcedure
    .input(z.object({ id: z.string(), projectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { member } = await resolveGlossaryAccess(
        ctx.db,
        ctx.session.user.id,
        input.projectId
      );

      if (!(ADMIN_ROLES as readonly string[]).includes(member.role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await ctx.db
        .delete(glossaryEntries)
        .where(eq(glossaryEntries.id, input.id));

      return { success: true };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        projectId: z.string(),
        term: z.string().min(1).max(200).optional(),
        definition: z.string().max(500).optional().nullable(),
        forbidden: z.boolean().optional(),
        caseSensitive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { member } = await resolveGlossaryAccess(
        ctx.db,
        ctx.session.user.id,
        input.projectId
      );

      if (!(ADMIN_ROLES as readonly string[]).includes(member.role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const { id, projectId: _projectId, ...fields } = input;
      const [entry] = await ctx.db
        .update(glossaryEntries)
        .set({ ...fields, updatedAt: new Date() })
        .where(eq(glossaryEntries.id, id))
        .returning();

      if (!entry) throw new TRPCError({ code: "NOT_FOUND" });
      return entry;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string(), projectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { member } = await resolveGlossaryAccess(
        ctx.db,
        ctx.session.user.id,
        input.projectId
      );

      if (!(ADMIN_ROLES as readonly string[]).includes(member.role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await ctx.db
        .delete(glossaryEntries)
        .where(eq(glossaryEntries.id, input.id));

      return { success: true };
    }),

  upsertTranslation: protectedProcedure
    .input(
      z.object({
        entryId: z.string(),
        projectId: z.string(),
        locale: z.string().min(2).max(10),
        translation: z.string().min(1).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { member } = await resolveGlossaryAccess(
        ctx.db,
        ctx.session.user.id,
        input.projectId
      );

      if (!(ADMIN_ROLES as readonly string[]).includes(member.role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const existing = await ctx.db.query.glossaryTranslations.findFirst({
        where: and(
          eq(glossaryTranslations.entryId, input.entryId),
          eq(glossaryTranslations.locale, input.locale)
        ),
      });

      if (existing) {
        const [updated] = await ctx.db
          .update(glossaryTranslations)
          .set({ translation: input.translation })
          .where(eq(glossaryTranslations.id, existing.id))
          .returning();
        return updated!;
      }

      const [created] = await ctx.db
        .insert(glossaryTranslations)
        .values({
          id: randomUUID(),
          entryId: input.entryId,
          locale: input.locale,
          translation: input.translation,
        })
        .returning();

      return created!;
    }),

  deleteTranslation: protectedProcedure
    .input(
      z.object({
        entryId: z.string(),
        projectId: z.string(),
        locale: z.string().min(2).max(10),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { member } = await resolveGlossaryAccess(
        ctx.db,
        ctx.session.user.id,
        input.projectId
      );

      if (!(ADMIN_ROLES as readonly string[]).includes(member.role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await ctx.db
        .delete(glossaryTranslations)
        .where(
          and(
            eq(glossaryTranslations.entryId, input.entryId),
            eq(glossaryTranslations.locale, input.locale)
          )
        );

      return { success: true };
    }),
});

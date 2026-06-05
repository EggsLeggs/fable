import { z } from "zod";
import { eq, and, count, ne } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { projects, projectLocales, orgMembers, translationKeys, translations, type Db } from "@fable/db";
import { TRPCError } from "@trpc/server";
import { PLAN_LIMITS } from "@fable/stripe";

const customLocaleSchema = z.object({ name: z.string().min(1), code: z.string().min(1) });

async function assertOrgAccess(
  db: Db,
  userId: string,
  orgId: string
) {
  const member = await db.query.orgMembers.findFirst({
    where: and(eq(orgMembers.userId, userId), eq(orgMembers.orgId, orgId)),
  });
  if (!member) throw new TRPCError({ code: "FORBIDDEN" });
  return member;
}

export const projectRouter = router({
  listAll: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.db.query.orgMembers.findMany({
      where: eq(orgMembers.userId, ctx.session.user.id),
      with: {
        org: {
          with: {
            projects: {
              with: { locales: true },
              orderBy: (p, { desc }) => [desc(p.updatedAt)],
            },
          },
        },
      },
    });
    return memberships.flatMap((m) => m.org.projects);
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.db.query.projects.findFirst({
        where: eq(projects.id, input.id),
        with: { locales: true },
      });
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      await assertOrgAccess(ctx.db, ctx.session.user.id, project.orgId);
      return project;
    }),

  list: protectedProcedure
    .input(z.object({ orgId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertOrgAccess(ctx.db, ctx.session.user.id, input.orgId);
      return ctx.db.query.projects.findMany({
        where: eq(projects.orgId, input.orgId),
        with: { locales: true },
        orderBy: (p, { desc }) => [desc(p.updatedAt)],
      });
    }),

  get: protectedProcedure
    .input(z.object({ orgId: z.string(), slug: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertOrgAccess(ctx.db, ctx.session.user.id, input.orgId);
      const project = await ctx.db.query.projects.findFirst({
        where: and(
          eq(projects.orgId, input.orgId),
          eq(projects.slug, input.slug)
        ),
        with: { locales: true, keys: { with: { translations: true } } },
      });
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      return project;
    }),

  getPublic: publicProcedure
    .input(z.object({ orgSlug: z.string(), projectSlug: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.db.query.projects.findFirst({
        where: eq(projects.slug, input.projectSlug),
        with: { locales: true, org: true },
      });
      if (!project || project.visibility !== "public") {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return project;
    }),

  create: protectedProcedure
    .input(
      z.object({
        orgId: z.string(),
        name: z.string().min(1).max(100),
        slug: z
          .string()
          .min(1)
          .max(64)
          .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers, and hyphens"),
        description: z.string().max(500).optional(),
        sourceLocale: z.string().default("en"),
        visibility: z.enum(["public", "private"]).default("private"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertOrgAccess(ctx.db, ctx.session.user.id, input.orgId);

      // Enforce project limit based on the org owner's plan
      const owner = await ctx.db.query.orgMembers.findFirst({
        where: and(eq(orgMembers.orgId, input.orgId), eq(orgMembers.role, "owner")),
        with: { user: { columns: { plan: true } } },
      });

      if (owner?.user.plan === "free") {
        const [{ value: projectCount }] = await ctx.db
          .select({ value: count() })
          .from(projects)
          .where(eq(projects.orgId, input.orgId));
        if (projectCount >= PLAN_LIMITS.free.projects) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "PROJECT_LIMIT_REACHED",
          });
        }
      }

      const id = uuid();
      const [project] = await ctx.db
        .insert(projects)
        .values({ id, ...input })
        .returning();

      await ctx.db.insert(projectLocales).values({
        id: uuid(),
        projectId: id,
        locale: input.sourceLocale,
        isSource: true,
      });

      return project!;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional(),
        visibility: z.enum(["public", "private"]).optional(),
        allowContributions: z.boolean().optional(),
        glossaryAccess: z.enum(["readonly", "suggest", "full"]).optional(),
        notifyTranslatorsOnNewStrings: z.boolean().optional(),
        customLocales: z.array(customLocaleSchema).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const project = await ctx.db.query.projects.findFirst({
        where: eq(projects.id, id),
      });
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      await assertOrgAccess(ctx.db, ctx.session.user.id, project.orgId);
      const [updated] = await ctx.db
        .update(projects)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(projects.id, id))
        .returning();
      return updated!;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.db.query.projects.findFirst({
        where: eq(projects.id, input.id),
      });
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      const member = await assertOrgAccess(ctx.db, ctx.session.user.id, project.orgId);
      if (member.role !== "owner" && member.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await ctx.db.delete(projects).where(eq(projects.id, input.id));
    }),

  addLocale: protectedProcedure
    .input(z.object({ projectId: z.string(), locale: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.db.query.projects.findFirst({
        where: eq(projects.id, input.projectId),
      });
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      await assertOrgAccess(ctx.db, ctx.session.user.id, project.orgId);
      const [locale] = await ctx.db
        .insert(projectLocales)
        .values({ id: uuid(), ...input, isSource: false })
        .returning();
      return locale!;
    }),

  removeLocale: protectedProcedure
    .input(z.object({ projectId: z.string(), localeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.db.query.projects.findFirst({
        where: eq(projects.id, input.projectId),
      });
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      await assertOrgAccess(ctx.db, ctx.session.user.id, project.orgId);
      const locale = await ctx.db.query.projectLocales.findFirst({
        where: eq(projectLocales.id, input.localeId),
      });
      if (!locale) throw new TRPCError({ code: "NOT_FOUND" });
      if (locale.isSource) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot remove the source locale." });
      }
      await ctx.db.delete(projectLocales).where(eq(projectLocales.id, input.localeId));
    }),

  updateSourceLocale: protectedProcedure
    .input(z.object({ id: z.string(), sourceLocale: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.db.query.projects.findFirst({
        where: eq(projects.id, input.id),
        with: { locales: true },
      });
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      await assertOrgAccess(ctx.db, ctx.session.user.id, project.orgId);

      await ctx.db.update(projects).set({ sourceLocale: input.sourceLocale, updatedAt: new Date() }).where(eq(projects.id, input.id));

      const oldSource = project.locales.find((l) => l.isSource);
      if (oldSource) {
        await ctx.db.update(projectLocales).set({ isSource: false }).where(eq(projectLocales.id, oldSource.id));
      }

      const existing = project.locales.find((l) => l.locale === input.sourceLocale);
      if (existing) {
        await ctx.db.update(projectLocales).set({ isSource: true }).where(eq(projectLocales.id, existing.id));
      } else {
        await ctx.db.insert(projectLocales).values({ id: uuid(), projectId: input.id, locale: input.sourceLocale, isSource: true });
      }
    }),

  badgeStats: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.db.query.projects.findFirst({
        where: eq(projects.id, input.id),
      });
      if (!project) return null;

      const [keyRow] = await ctx.db
        .select({ value: count() })
        .from(translationKeys)
        .where(and(eq(translationKeys.projectId, input.id), eq(translationKeys.status, "active")));

      const keyCount = keyRow?.value ?? 0;

      const targetLocales = await ctx.db.query.projectLocales.findMany({
        where: and(eq(projectLocales.projectId, input.id), eq(projectLocales.isSource, false)),
      });

      const [approvedRow] = await ctx.db
        .select({ value: count() })
        .from(translations)
        .innerJoin(translationKeys, eq(translations.keyId, translationKeys.id))
        .where(
          and(
            eq(translationKeys.projectId, input.id),
            eq(translationKeys.status, "active"),
            eq(translations.state, "approved"),
            ne(translations.locale, project.sourceLocale)
          )
        );

      const approvedCount = approvedRow?.value ?? 0;
      const total = keyCount * targetLocales.length;
      const pct = total === 0 ? 0 : Math.round((approvedCount / total) * 100);

      return { pct, keyCount, targetLocaleCount: targetLocales.length };
    }),
});

import { z } from "zod";
import { eq, and, count, ne, or, sql } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { projects, projectLocales, orgMembers, translationKeys, translations, sourceFiles, ingestJobs, users, type Db } from "@fable/db";
import { TRPCError } from "@trpc/server";
import { PLAN_LIMITS, getEffectivePlan } from "@fable/stripe";
import { logActivity } from "../log-activity";
import { getMemberDisplayName } from "../user-display";

const inviteLinkTypeSchema = z.enum(["member", "translator"]);

type InviteLinkType = z.infer<typeof inviteLinkTypeSchema>;

function generateInviteToken(): string {
  return uuid().replace(/-/g, "");
}

async function generateUniqueInviteToken(
  db: Db,
  column: "memberInviteToken" | "translatorInviteToken"
): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const token = generateInviteToken();
    const clash = await db.query.projects.findFirst({
      where: eq(projects[column], token),
      columns: { id: true },
    });
    if (!clash) return token;
  }
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "TOKEN_GENERATION_FAILED" });
}

function resolveInviteLinkType(
  project: {
    memberInviteToken: string | null;
    memberInviteEnabled: boolean;
    translatorInviteToken: string | null;
    translatorInviteEnabled: boolean;
  },
  token: string
): InviteLinkType | null {
  if (project.memberInviteToken === token && project.memberInviteEnabled) return "member";
  if (project.translatorInviteToken === token && project.translatorInviteEnabled) return "translator";
  return null;
}

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
        targetLocales: z.array(z.string()).default([]),
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

      if (getEffectivePlan(owner?.user.plan ?? "free") === "free") {
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

      const uniqueTargetLocales = [
        ...new Set(
          input.targetLocales.filter((locale) => locale !== input.sourceLocale)
        ),
      ];
      if (uniqueTargetLocales.length > 0) {
        await ctx.db.insert(projectLocales).values(
          uniqueTargetLocales.map((locale) => ({
            id: uuid(),
            projectId: id,
            locale,
            isSource: false,
          }))
        );
      }

      await logActivity(ctx.db, {
        projectId: id,
        userId: ctx.session.user.id,
        type: "project_created",
        metadata: { name: input.name },
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
        translatorApprovalRequired: z.boolean().optional(),
        adminSelfReviewRequired: z.boolean().optional(),
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

      const changedFields = Object.keys(data) as (keyof typeof data)[];
      if (changedFields.length > 0) {
        const changes: Record<string, { from: unknown; to: unknown }> = {};
        for (const field of changedFields) {
          changes[field] = { from: project[field as keyof typeof project], to: data[field] };
        }
        await logActivity(ctx.db, {
          projectId: id,
          userId: ctx.session.user.id,
          type: "project_updated",
          metadata: { name: project.name, changes },
        });
      }

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

      await logActivity(ctx.db, {
        projectId: input.projectId,
        userId: ctx.session.user.id,
        type: "locale_added",
        locale: input.locale,
        metadata: { locale: input.locale },
      });

      if (ctx.ingestQueue) {
        const vcsFiles = await ctx.db.query.sourceFiles.findMany({
          where: and(
            eq(sourceFiles.projectId, input.projectId),
            eq(sourceFiles.sourceType, "vcs"),
            eq(sourceFiles.status, "active")
          ),
        });
        for (const file of vcsFiles) {
          const ingestJobId = uuid();
          await ctx.db.insert(ingestJobs).values({
            id: ingestJobId,
            sourceFileId: file.id,
            trigger: "vcs_manual_sync",
            status: "queued",
          });
          await ctx.ingestQueue.add("ingest", { ingestJobId, sourceFileId: file.id }, { jobId: ingestJobId });
        }
      }

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

      await logActivity(ctx.db, {
        projectId: input.projectId,
        userId: ctx.session.user.id,
        type: "locale_removed",
        locale: locale.locale,
        metadata: { locale: locale.locale },
      });
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

  dashboardStats: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.db.query.projects.findFirst({
        where: eq(projects.id, input.id),
        with: { locales: true },
      });
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      await assertOrgAccess(ctx.db, ctx.session.user.id, project.orgId);

      const [keyRow] = await ctx.db
        .select({ value: count() })
        .from(translationKeys)
        .where(and(eq(translationKeys.projectId, input.id), eq(translationKeys.status, "active")));
      const keyCount = keyRow?.value ?? 0;

      const localeRows = await ctx.db
        .select({
          locale: translations.locale,
          total: count(),
          approved: sql<number>`cast(count(*) filter (where ${translations.state} = 'approved') as integer)`,
        })
        .from(translations)
        .innerJoin(translationKeys, eq(translations.keyId, translationKeys.id))
        .where(
          and(
            eq(translationKeys.projectId, input.id),
            eq(translationKeys.status, "active")
          )
        )
        .groupBy(translations.locale);

      const localeStatsMap = new Map(localeRows.map((r) => [r.locale, r]));

      const localeStats = project.locales
        .filter((l) => !l.isSource)
        .map((l) => {
          const row = localeStatsMap.get(l.locale);
          const translated = row?.total ?? 0;
          const approved = row?.approved ?? 0;
          const pct = keyCount === 0 ? 0 : Math.round((approved / keyCount) * 100);
          return { localeId: l.id, locale: l.locale, translated, approved, pct };
        });

      return { project, keyCount, localeStats };
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

  getInviteLinks: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.db.query.projects.findFirst({
        where: eq(projects.id, input.projectId),
        columns: {
          orgId: true,
          memberInviteToken: true,
          memberInviteEnabled: true,
          translatorInviteToken: true,
          translatorInviteEnabled: true,
        },
      });
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });

      const callerMember = await ctx.db.query.orgMembers.findFirst({
        where: and(
          eq(orgMembers.userId, ctx.session.user.id),
          eq(orgMembers.orgId, project.orgId)
        ),
      });
      if (!callerMember) throw new TRPCError({ code: "FORBIDDEN" });

      const canManageMember = callerMember.role === "owner";
      const canManageTranslator = callerMember.role !== "translator";

      return {
        member: canManageMember
          ? {
              enabled: project.memberInviteEnabled,
              token: project.memberInviteEnabled ? project.memberInviteToken : null,
            }
          : null,
        translator: canManageTranslator
          ? {
              enabled: project.translatorInviteEnabled,
              token: project.translatorInviteEnabled ? project.translatorInviteToken : null,
            }
          : null,
      };
    }),

  setInviteLink: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        type: inviteLinkTypeSchema,
        enabled: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.db.query.projects.findFirst({
        where: eq(projects.id, input.projectId),
        columns: { id: true, orgId: true },
      });
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });

      const callerMember = await ctx.db.query.orgMembers.findFirst({
        where: and(
          eq(orgMembers.userId, ctx.session.user.id),
          eq(orgMembers.orgId, project.orgId)
        ),
      });
      if (!callerMember) throw new TRPCError({ code: "FORBIDDEN" });

      if (input.type === "member" && callerMember.role !== "owner") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (input.type === "translator" && callerMember.role === "translator") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      if (input.type === "member") {
        if (!input.enabled) {
          await ctx.db
            .update(projects)
            .set({ memberInviteEnabled: false, memberInviteToken: null })
            .where(eq(projects.id, input.projectId));
          return { enabled: false as const, token: null };
        }

        const token = await generateUniqueInviteToken(ctx.db, "memberInviteToken");
        await ctx.db
          .update(projects)
          .set({ memberInviteToken: token, memberInviteEnabled: true })
          .where(eq(projects.id, input.projectId));
        return { enabled: true as const, token };
      }

      if (!input.enabled) {
        await ctx.db
          .update(projects)
          .set({ translatorInviteEnabled: false, translatorInviteToken: null })
          .where(eq(projects.id, input.projectId));
        return { enabled: false as const, token: null };
      }

      const token = await generateUniqueInviteToken(ctx.db, "translatorInviteToken");
      await ctx.db
        .update(projects)
        .set({ translatorInviteToken: token, translatorInviteEnabled: true })
        .where(eq(projects.id, input.projectId));
      return { enabled: true as const, token };
    }),

  validateInviteToken: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.db.query.projects.findFirst({
        where: or(
          eq(projects.memberInviteToken, input.token),
          eq(projects.translatorInviteToken, input.token)
        ),
        columns: {
          name: true,
          orgId: true,
          memberInviteToken: true,
          memberInviteEnabled: true,
          translatorInviteToken: true,
          translatorInviteEnabled: true,
        },
        with: { org: { columns: { name: true } } },
      });

      if (!project) return { valid: false as const };

      const type = resolveInviteLinkType(project, input.token);
      if (!type) return { valid: false as const };

      return {
        valid: true as const,
        orgName: project.org.name,
        projectName: project.name,
        role: type,
      };
    }),

  acceptInvite: protectedProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.db.query.projects.findFirst({
        where: or(
          eq(projects.memberInviteToken, input.token),
          eq(projects.translatorInviteToken, input.token)
        ),
        columns: {
          id: true,
          orgId: true,
          memberInviteToken: true,
          memberInviteEnabled: true,
          translatorInviteToken: true,
          translatorInviteEnabled: true,
        },
      });

      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "INVITE_INVALID" });
      }

      const type = resolveInviteLinkType(project, input.token);
      if (!type) {
        throw new TRPCError({ code: "NOT_FOUND", message: "INVITE_DISABLED" });
      }

      const existingMember = await ctx.db.query.orgMembers.findFirst({
        where: and(
          eq(orgMembers.orgId, project.orgId),
          eq(orgMembers.userId, ctx.session.user.id)
        ),
      });
      if (existingMember) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "ALREADY_MEMBER" });
      }

      const role = type === "member" ? "member" : "translator";

      if (role === "member") {
        const owner = await ctx.db.query.orgMembers.findFirst({
          where: and(eq(orgMembers.orgId, project.orgId), eq(orgMembers.role, "owner")),
          with: { user: { columns: { plan: true } } },
        });
        if (getEffectivePlan(owner?.user.plan ?? "free") === "free") {
          const [{ value: memberCount }] = await ctx.db
            .select({ value: count() })
            .from(orgMembers)
            .where(eq(orgMembers.orgId, project.orgId));
          if (memberCount >= PLAN_LIMITS.free.members) {
            throw new TRPCError({ code: "FORBIDDEN", message: "MEMBER_LIMIT_REACHED" });
          }
        }
      }

      const joiningUser = await ctx.db.query.users.findFirst({
        where: eq(users.id, ctx.session.user.id),
        columns: { id: true, name: true, username: true, email: true },
      });

      await ctx.db.insert(orgMembers).values({
        id: uuid(),
        orgId: project.orgId,
        userId: ctx.session.user.id,
        role,
      });

      await logActivity(ctx.db, {
        projectId: project.id,
        userId: ctx.session.user.id,
        type: "member_joined",
        metadata: {
          memberUserId: ctx.session.user.id,
          memberName: joiningUser ? getMemberDisplayName(joiningUser) : ctx.session.user.id,
          role,
        },
      });

      return { orgId: project.orgId, projectId: project.id, role };
    }),
});

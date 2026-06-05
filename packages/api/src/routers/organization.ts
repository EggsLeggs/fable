import { z } from "zod";
import { and, count, eq, or } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { organizations, orgMembers, projects, users } from "@fable/db";
import { PLAN_LIMITS, getEffectivePlan } from "@fable/stripe";
import { logActivity } from "../log-activity";
import { getMemberDisplayName } from "../user-display";

const inviteLinkTypeSchema = z.enum(["member", "translator"]);

type InviteLinkType = z.infer<typeof inviteLinkTypeSchema>;

function generateInviteToken(): string {
  return uuid().replace(/-/g, "");
}

async function generateUniqueInviteToken(
  db: Parameters<typeof logActivity>[0],
  column: "memberInviteToken" | "translatorInviteToken"
): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const token = generateInviteToken();
    const clash = await db.query.organizations.findFirst({
      where: eq(organizations[column], token),
      columns: { id: true },
    });
    if (!clash) return token;
  }
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "TOKEN_GENERATION_FAILED" });
}

function resolveInviteLinkType(
  org: {
    memberInviteToken: string | null;
    memberInviteEnabled: boolean;
    translatorInviteToken: string | null;
    translatorInviteEnabled: boolean;
  },
  token: string
): InviteLinkType | null {
  if (org.memberInviteToken === token && org.memberInviteEnabled) return "member";
  if (org.translatorInviteToken === token && org.translatorInviteEnabled) return "translator";
  return null;
}

async function logForAllOrgProjects(
  db: Parameters<typeof logActivity>[0],
  orgId: string,
  params: Omit<Parameters<typeof logActivity>[1], "projectId">
) {
  const orgProjects = await db.query.projects.findMany({
    where: eq(projects.orgId, orgId),
    columns: { id: true },
  });
  await Promise.all(
    orgProjects.map((p) => logActivity(db, { ...params, projectId: p.id }))
  );
}



export const organizationRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.db.query.orgMembers.findMany({
      where: eq(orgMembers.userId, ctx.session.user.id),
      with: { org: true },
    });
    return memberships.map((m) => ({ ...m.org, role: m.role }));
  }),

  get: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const org = await ctx.db.query.organizations.findFirst({
        where: eq(organizations.slug, input.slug),
        with: { members: { with: { user: true } } },
      });
      if (!org) throw new Error("Organisation not found");
      return org;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(64),
        slug: z
          .string()
          .min(1)
          .max(48)
          .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers, and hyphens"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = uuid();

      const [org] = await ctx.db
        .insert(organizations)
        .values({ id: orgId, name: input.name, slug: input.slug })
        .returning();

      await ctx.db.insert(orgMembers).values({
        id: uuid(),
        orgId,
        userId: ctx.session.user.id,
        role: "owner",
      });

      return org!;
    }),

  getOrCreate: protectedProcedure.mutation(async ({ ctx }) => {
    const existing = await ctx.db.query.orgMembers.findFirst({
      where: eq(orgMembers.userId, ctx.session.user.id),
      with: { org: true },
    });

    if (existing) return existing.org;

    const name = ctx.session.user.name ?? ctx.session.user.email?.split("@")[0] ?? "My Workspace";
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48);

    const orgId = uuid();
    const [org] = await ctx.db
      .insert(organizations)
      .values({ id: orgId, name, slug: `${slug}-${orgId.slice(0, 6)}` })
      .returning();

    await ctx.db.insert(orgMembers).values({
      id: uuid(),
      orgId,
      userId: ctx.session.user.id,
      role: "owner",
    });

    return org!;
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const member = await ctx.db.query.orgMembers.findFirst({
        where: and(
          eq(orgMembers.userId, ctx.session.user.id),
          eq(orgMembers.orgId, input.id)
        ),
      });
      if (!member) throw new TRPCError({ code: "FORBIDDEN" });
      const org = await ctx.db.query.organizations.findFirst({
        where: eq(organizations.id, input.id),
        with: { members: { with: { user: true } } },
      });
      if (!org) throw new TRPCError({ code: "NOT_FOUND" });

      if (member.role === "translator") {
        return {
          ...org,
          members: org.members.map((m) => ({
            ...m,
            user: {
              ...m.user,
              name: "",
              email: "",
            },
          })),
        };
      }

      return org;
    }),

  removeMember: protectedProcedure
    .input(z.object({ orgId: z.string(), userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const callerMember = await ctx.db.query.orgMembers.findFirst({
        where: and(
          eq(orgMembers.userId, ctx.session.user.id),
          eq(orgMembers.orgId, input.orgId)
        ),
      });
      if (!callerMember || callerMember.role !== "owner") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (input.userId === ctx.session.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "CANNOT_REMOVE_SELF" });
      }
      const targetUser = await ctx.db.query.users.findFirst({
        where: eq(users.id, input.userId),
        columns: { id: true, name: true, username: true, email: true },
      });
      await ctx.db
        .delete(orgMembers)
        .where(
          and(eq(orgMembers.orgId, input.orgId), eq(orgMembers.userId, input.userId))
        );
      await logForAllOrgProjects(ctx.db, input.orgId, {
        userId: ctx.session.user.id,
        type: "member_left",
        metadata: {
          memberUserId: input.userId,
          memberName: targetUser
            ? getMemberDisplayName(targetUser)
            : input.userId,
        },
      });
    }),

  inviteByEmail: protectedProcedure
    .input(z.object({ orgId: z.string(), email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      const callerMember = await ctx.db.query.orgMembers.findFirst({
        where: and(
          eq(orgMembers.userId, ctx.session.user.id),
          eq(orgMembers.orgId, input.orgId)
        ),
      });
      if (!callerMember || callerMember.role === "member") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const targetUser = await ctx.db.query.users.findFirst({
        where: eq(users.email, input.email),
      });
      if (!targetUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "USER_NOT_FOUND" });
      }
      const existingMember = await ctx.db.query.orgMembers.findFirst({
        where: and(
          eq(orgMembers.orgId, input.orgId),
          eq(orgMembers.userId, targetUser.id)
        ),
      });
      if (existingMember) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "ALREADY_MEMBER" });
      }
      const owner = await ctx.db.query.orgMembers.findFirst({
        where: and(eq(orgMembers.orgId, input.orgId), eq(orgMembers.role, "owner")),
        with: { user: { columns: { plan: true } } },
      });
      if (getEffectivePlan(owner?.user.plan ?? "free") === "free") {
        const [{ value: memberCount }] = await ctx.db
          .select({ value: count() })
          .from(orgMembers)
          .where(eq(orgMembers.orgId, input.orgId));
        if (memberCount >= PLAN_LIMITS.free.members) {
          throw new TRPCError({ code: "FORBIDDEN", message: "MEMBER_LIMIT_REACHED" });
        }
      }
      const [member] = await ctx.db
        .insert(orgMembers)
        .values({ id: uuid(), orgId: input.orgId, userId: targetUser.id, role: "member" })
        .returning();

      await logForAllOrgProjects(ctx.db, input.orgId, {
        userId: ctx.session.user.id,
        type: "member_joined",
        metadata: {
          memberUserId: targetUser.id,
          memberName: getMemberDisplayName(targetUser),
          role: "member",
        },
      });

      return member!;
    }),

  inviteMember: protectedProcedure
    .input(
      z.object({
        orgId: z.string(),
        userId: z.string(),
        role: z.enum(["admin", "member"]).default("member"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const callerMember = await ctx.db.query.orgMembers.findFirst({
        where: and(
          eq(orgMembers.userId, ctx.session.user.id),
          eq(orgMembers.orgId, input.orgId)
        ),
      });
      if (!callerMember || callerMember.role === "member") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const owner = await ctx.db.query.orgMembers.findFirst({
        where: and(eq(orgMembers.orgId, input.orgId), eq(orgMembers.role, "owner")),
        with: { user: { columns: { plan: true } } },
      });

      if (getEffectivePlan(owner?.user.plan ?? "free") === "free") {
        const [{ value: memberCount }] = await ctx.db
          .select({ value: count() })
          .from(orgMembers)
          .where(eq(orgMembers.orgId, input.orgId));
        if (memberCount >= PLAN_LIMITS.free.members) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "MEMBER_LIMIT_REACHED",
          });
        }
      }

      const [member] = await ctx.db
        .insert(orgMembers)
        .values({
          id: uuid(),
          orgId: input.orgId,
          userId: input.userId,
          role: input.role,
        })
        .returning();

      const invitedUser = await ctx.db.query.users.findFirst({
        where: eq(users.id, input.userId),
        columns: { id: true, name: true, username: true, email: true },
      });
      await logForAllOrgProjects(ctx.db, input.orgId, {
        userId: ctx.session.user.id,
        type: "member_joined",
        metadata: {
          memberUserId: input.userId,
          memberName: invitedUser
            ? getMemberDisplayName(invitedUser)
            : input.userId,
          role: input.role,
        },
      });

      return member!;
    }),

  inviteTranslatorByEmail: protectedProcedure
    .input(z.object({ orgId: z.string(), email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      const callerMember = await ctx.db.query.orgMembers.findFirst({
        where: and(
          eq(orgMembers.userId, ctx.session.user.id),
          eq(orgMembers.orgId, input.orgId)
        ),
      });
      if (!callerMember || callerMember.role === "translator") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const targetUser = await ctx.db.query.users.findFirst({
        where: eq(users.email, input.email),
      });
      if (!targetUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "USER_NOT_FOUND" });
      }
      const existingMember = await ctx.db.query.orgMembers.findFirst({
        where: and(
          eq(orgMembers.orgId, input.orgId),
          eq(orgMembers.userId, targetUser.id)
        ),
      });
      if (existingMember) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "ALREADY_MEMBER" });
      }
      const [member] = await ctx.db
        .insert(orgMembers)
        .values({ id: uuid(), orgId: input.orgId, userId: targetUser.id, role: "translator" })
        .returning();

      await logForAllOrgProjects(ctx.db, input.orgId, {
        userId: ctx.session.user.id,
        type: "member_joined",
        metadata: {
          memberUserId: targetUser.id,
          memberName: getMemberDisplayName(targetUser),
          role: "translator",
        },
      });

      return member!;
    }),

  getInviteLinks: protectedProcedure
    .input(z.object({ orgId: z.string() }))
    .query(async ({ ctx, input }) => {
      const callerMember = await ctx.db.query.orgMembers.findFirst({
        where: and(
          eq(orgMembers.userId, ctx.session.user.id),
          eq(orgMembers.orgId, input.orgId)
        ),
      });
      if (!callerMember) throw new TRPCError({ code: "FORBIDDEN" });

      const org = await ctx.db.query.organizations.findFirst({
        where: eq(organizations.id, input.orgId),
        columns: {
          memberInviteToken: true,
          memberInviteEnabled: true,
          translatorInviteToken: true,
          translatorInviteEnabled: true,
        },
      });
      if (!org) throw new TRPCError({ code: "NOT_FOUND" });

      const canManageMember = callerMember.role === "owner";
      const canManageTranslator = callerMember.role !== "translator";

      return {
        member: canManageMember
          ? {
              enabled: org.memberInviteEnabled,
              token: org.memberInviteEnabled ? org.memberInviteToken : null,
            }
          : null,
        translator: canManageTranslator
          ? {
              enabled: org.translatorInviteEnabled,
              token: org.translatorInviteEnabled ? org.translatorInviteToken : null,
            }
          : null,
      };
    }),

  setInviteLink: protectedProcedure
    .input(
      z.object({
        orgId: z.string(),
        type: inviteLinkTypeSchema,
        enabled: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const callerMember = await ctx.db.query.orgMembers.findFirst({
        where: and(
          eq(orgMembers.userId, ctx.session.user.id),
          eq(orgMembers.orgId, input.orgId)
        ),
      });
      if (!callerMember) throw new TRPCError({ code: "FORBIDDEN" });

      if (input.type === "member" && callerMember.role !== "owner") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (input.type === "translator" && callerMember.role === "translator") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const org = await ctx.db.query.organizations.findFirst({
        where: eq(organizations.id, input.orgId),
        columns: { id: true },
      });
      if (!org) throw new TRPCError({ code: "NOT_FOUND" });

      if (input.type === "member") {
        if (!input.enabled) {
          await ctx.db
            .update(organizations)
            .set({ memberInviteEnabled: false })
            .where(eq(organizations.id, input.orgId));
          return { enabled: false as const, token: null };
        }

        const token = await generateUniqueInviteToken(ctx.db, "memberInviteToken");
        await ctx.db
          .update(organizations)
          .set({ memberInviteToken: token, memberInviteEnabled: true })
          .where(eq(organizations.id, input.orgId));
        return { enabled: true as const, token };
      }

      if (!input.enabled) {
        await ctx.db
          .update(organizations)
          .set({ translatorInviteEnabled: false })
          .where(eq(organizations.id, input.orgId));
        return { enabled: false as const, token: null };
      }

      const token = await generateUniqueInviteToken(ctx.db, "translatorInviteToken");
      await ctx.db
        .update(organizations)
        .set({ translatorInviteToken: token, translatorInviteEnabled: true })
        .where(eq(organizations.id, input.orgId));
      return { enabled: true as const, token };
    }),

  validateInviteToken: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const org = await ctx.db.query.organizations.findFirst({
        where: or(
          eq(organizations.memberInviteToken, input.token),
          eq(organizations.translatorInviteToken, input.token)
        ),
        columns: {
          name: true,
          memberInviteToken: true,
          memberInviteEnabled: true,
          translatorInviteToken: true,
          translatorInviteEnabled: true,
        },
      });

      if (!org) return { valid: false as const };

      const type = resolveInviteLinkType(org, input.token);
      if (!type) return { valid: false as const };

      return {
        valid: true as const,
        orgName: org.name,
        role: type,
      };
    }),

  acceptInvite: protectedProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const org = await ctx.db.query.organizations.findFirst({
        where: or(
          eq(organizations.memberInviteToken, input.token),
          eq(organizations.translatorInviteToken, input.token)
        ),
        columns: {
          id: true,
          memberInviteToken: true,
          memberInviteEnabled: true,
          translatorInviteToken: true,
          translatorInviteEnabled: true,
        },
      });

      if (!org) {
        throw new TRPCError({ code: "NOT_FOUND", message: "INVITE_INVALID" });
      }

      const type = resolveInviteLinkType(org, input.token);
      if (!type) {
        throw new TRPCError({ code: "NOT_FOUND", message: "INVITE_DISABLED" });
      }

      const existingMember = await ctx.db.query.orgMembers.findFirst({
        where: and(
          eq(orgMembers.orgId, org.id),
          eq(orgMembers.userId, ctx.session.user.id)
        ),
      });
      if (existingMember) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "ALREADY_MEMBER" });
      }

      const role = type === "member" ? "member" : "translator";

      if (role === "member") {
        const owner = await ctx.db.query.orgMembers.findFirst({
          where: and(eq(orgMembers.orgId, org.id), eq(orgMembers.role, "owner")),
          with: { user: { columns: { plan: true } } },
        });
        if (getEffectivePlan(owner?.user.plan ?? "free") === "free") {
          const [{ value: memberCount }] = await ctx.db
            .select({ value: count() })
            .from(orgMembers)
            .where(eq(orgMembers.orgId, org.id));
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
        orgId: org.id,
        userId: ctx.session.user.id,
        role,
      });

      await logForAllOrgProjects(ctx.db, org.id, {
        userId: ctx.session.user.id,
        type: "member_joined",
        metadata: {
          memberUserId: ctx.session.user.id,
          memberName: joiningUser ? getMemberDisplayName(joiningUser) : ctx.session.user.id,
          role,
        },
      });

      return { orgId: org.id, role };
    }),

  removeTranslator: protectedProcedure
    .input(z.object({ orgId: z.string(), userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const callerMember = await ctx.db.query.orgMembers.findFirst({
        where: and(
          eq(orgMembers.userId, ctx.session.user.id),
          eq(orgMembers.orgId, input.orgId)
        ),
      });
      if (!callerMember || callerMember.role === "translator") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const target = await ctx.db.query.orgMembers.findFirst({
        where: and(
          eq(orgMembers.orgId, input.orgId),
          eq(orgMembers.userId, input.userId)
        ),
      });
      if (!target || target.role !== "translator") {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const translatorUser = await ctx.db.query.users.findFirst({
        where: eq(users.id, input.userId),
        columns: { id: true, name: true, username: true, email: true },
      });
      await ctx.db
        .delete(orgMembers)
        .where(
          and(eq(orgMembers.orgId, input.orgId), eq(orgMembers.userId, input.userId))
        );
      await logForAllOrgProjects(ctx.db, input.orgId, {
        userId: ctx.session.user.id,
        type: "member_left",
        metadata: {
          memberUserId: input.userId,
          memberName: translatorUser
            ? getMemberDisplayName(translatorUser)
            : input.userId,
          role: "translator",
        },
      });
    }),
});

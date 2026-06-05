import { z } from "zod";
import { and, count, eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { organizations, orgMembers, users } from "@fable/db";
import { PLAN_LIMITS } from "@fable/stripe";



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
      await ctx.db
        .delete(orgMembers)
        .where(
          and(eq(orgMembers.orgId, input.orgId), eq(orgMembers.userId, input.userId))
        );
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
      if (owner?.user.plan === "free") {
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

      if (owner?.user.plan === "free") {
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
      return member!;
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
      await ctx.db
        .delete(orgMembers)
        .where(
          and(eq(orgMembers.orgId, input.orgId), eq(orgMembers.userId, input.userId))
        );
    }),
});

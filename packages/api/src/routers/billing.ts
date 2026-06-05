import { z } from "zod";
import { eq, and, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { users, organizations, orgMembers, projects, translationKeys, type Db } from "@fable/db";
import { createCheckoutSession, createPortalSession, PLAN_LIMITS } from "@fable/stripe";

async function getOwnerOrg(db: Db, userId: string) {
  const membership = await db.query.orgMembers.findFirst({
    where: and(eq(orgMembers.userId, userId), eq(orgMembers.role, "owner")),
    with: { org: true },
  });
  return membership?.org ?? null;
}

export const billingRouter = router({
  getUsage: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const user = await ctx.db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        plan: true,
        planStatus: true,
        billingCycle: true,
        planCurrentPeriodEnd: true,
        mtCharsUsed: true,
        mtCharsResetAt: true,
        mtCharsCap: true,
      },
    });

    if (!user) throw new TRPCError({ code: "NOT_FOUND" });

    const org = await getOwnerOrg(ctx.db, userId);

    const [projectCount, memberCount, keyCount] = org
      ? await Promise.all([
          ctx.db
            .select({ value: count() })
            .from(projects)
            .where(eq(projects.orgId, org.id))
            .then((r) => r[0]?.value ?? 0),
          ctx.db
            .select({ value: count() })
            .from(orgMembers)
            .where(eq(orgMembers.orgId, org.id))
            .then((r) => r[0]?.value ?? 0),
          ctx.db
            .select({ value: count() })
            .from(translationKeys)
            .innerJoin(projects, eq(translationKeys.projectId, projects.id))
            .where(eq(projects.orgId, org.id))
            .then((r) => r[0]?.value ?? 0),
        ])
      : [0, 0, 0];

    const limits =
      PLAN_LIMITS[user.plan as keyof typeof PLAN_LIMITS] ?? PLAN_LIMITS.free;

    return {
      plan: user.plan,
      planStatus: user.planStatus,
      billingCycle: user.billingCycle,
      planCurrentPeriodEnd: user.planCurrentPeriodEnd,
      mtCharsUsed: user.mtCharsUsed,
      mtCharsResetAt: user.mtCharsResetAt,
      mtCharsCap: user.mtCharsCap,
      usage: {
        projects: projectCount,
        members: memberCount,
        translationKeys: keyCount,
      },
      limits: {
        projects: limits.projects === Infinity ? null : limits.projects,
        members: limits.members === Infinity ? null : limits.members,
        translationKeys: limits.translationKeys === Infinity ? null : limits.translationKeys,
        mtCharsIncluded: limits.mtCharsIncluded === Infinity ? null : limits.mtCharsIncluded,
      },
    };
  }),

  checkout: protectedProcedure
    .input(z.object({ billingCycle: z.enum(["monthly", "annual"]) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const user = await ctx.db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { plan: true, stripeCustomerId: true, email: true },
      });

      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      if (user.plan !== "free") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You already have an active plan",
        });
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

      const url = await createCheckoutSession({
        userId,
        billingCycle: input.billingCycle,
        stripeCustomerId: user.stripeCustomerId,
        returnBaseUrl: appUrl,
      });

      return { url };
    }),

  portal: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const user = await ctx.db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No billing account found",
      });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const url = await createPortalSession({
      stripeCustomerId: user.stripeCustomerId,
      returnUrl: `${appUrl}/settings/billing`,
    });

    return { url };
  }),

  updateMtCap: protectedProcedure
    .input(z.object({ cap: z.number().int().positive().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const [updated] = await ctx.db
        .update(users)
        .set({ mtCharsCap: input.cap })
        .where(eq(users.id, userId))
        .returning({ id: users.id, mtCharsCap: users.mtCharsCap });

      return updated!;
    }),
});

import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { v4 as uuid } from "uuid";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { users, referrals } from "@fable/db";
import { createReferralCoupon, isStripeConfigured } from "@fable/stripe";
import { REFERRAL_MILESTONES } from "../referral-rewards";

function generateReferralCode(): string {
  return uuid().replace(/-/g, "").slice(0, 8).toUpperCase();
}

function isProSubscriber(user: { plan: string; lifetimePro: boolean }): boolean {
  return user.plan === "pro" || user.lifetimePro;
}

function assertProReferrer(user: { plan: string; lifetimePro: boolean }): void {
  if (!isProSubscriber(user)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Pro subscription required to refer others",
    });
  }
}

export const referralRouter = router({
  validateCode: publicProcedure
    .input(z.object({ code: z.string().min(1).max(16) }))
    .query(async ({ ctx, input }) => {
      const referrer = await ctx.db.query.users.findFirst({
        where: eq(users.referralCode, input.code.toUpperCase()),
        columns: { id: true, plan: true, lifetimePro: true, username: true },
      });

      const code = input.code.toUpperCase();

      if (!referrer || !isProSubscriber(referrer)) {
        return { valid: false as const, code };
      }

      return {
        valid: true as const,
        code,
        referrerHandle: referrer.username,
        billingAvailable: isStripeConfigured(),
      };
    }),

  getMyCode: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const user = await ctx.db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { referralCode: true, plan: true, lifetimePro: true },
    });

    if (!user) throw new TRPCError({ code: "NOT_FOUND" });
    assertProReferrer(user);
    if (user.referralCode) return { code: user.referralCode };

    let code = generateReferralCode();
    for (let i = 0; i < 5; i++) {
      const clash = await ctx.db.query.users.findFirst({
        where: eq(users.referralCode, code),
        columns: { id: true },
      });
      if (!clash) break;
      code = generateReferralCode();
    }

    await ctx.db.update(users).set({ referralCode: code }).where(eq(users.id, userId));
    return { code };
  }),

  getStats: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const user = await ctx.db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { referralCode: true, plan: true, lifetimePro: true },
    });

    if (!user) throw new TRPCError({ code: "NOT_FOUND" });
    assertProReferrer(user);

    const myReferrals = await ctx.db.query.referrals.findMany({
      where: eq(referrals.referrerId, userId),
      orderBy: (r, { desc }) => [desc(r.createdAt)],
    });

    const qualifiedCount = myReferrals.filter(
      (r) => r.status === "qualified" || r.status === "rewarded"
    ).length;

    const pendingCount = myReferrals.filter((r) => r.status === "pending").length;

    const nextMilestone =
      REFERRAL_MILESTONES.find((m) => m.count > qualifiedCount) ?? null;

    const rewardedMilestones = myReferrals
      .filter((r) => r.status === "rewarded" && r.rewardMilestone !== null)
      .map((r) => r.rewardMilestone as number);

    return {
      code: user.referralCode,
      qualifiedCount,
      pendingCount,
      nextMilestone,
      milestones: REFERRAL_MILESTONES as unknown as typeof REFERRAL_MILESTONES,
      rewardedMilestones,
      totalReferrals: myReferrals.length,
    };
  }),

  applyCode: protectedProcedure
    .input(z.object({ code: z.string().min(1).max(16) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const user = await ctx.db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { referredBy: true, stripeReferralCouponId: true },
      });

      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      if (user.referredBy) {
        return { success: true, couponCreated: Boolean(user.stripeReferralCouponId) };
      }

      const referrer = await ctx.db.query.users.findFirst({
        where: eq(users.referralCode, input.code.toUpperCase()),
        columns: { id: true, plan: true, lifetimePro: true },
      });

      if (!referrer || !isProSubscriber(referrer)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invalid referral code" });
      }
      if (referrer.id === userId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot use your own referral code" });
      }

      await ctx.db.update(users).set({ referredBy: referrer.id }).where(eq(users.id, userId));

      let couponCreated = false;
      if (isStripeConfigured()) {
        const couponId = await createReferralCoupon(userId);
        await ctx.db
          .update(users)
          .set({ stripeReferralCouponId: couponId })
          .where(eq(users.id, userId));
        couponCreated = true;
      }

      return { success: true, couponCreated };
    }),
});

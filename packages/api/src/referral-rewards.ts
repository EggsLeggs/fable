export type RewardType = "subscription_months" | "physical_item" | "lifetime_pro";
export type PhysicalItem = "swag_pack" | "device" | "mac_mini";

export interface ReferralMilestone {
  count: number;
  type: RewardType;
  months?: number;
  item?: PhysicalItem;
  label: string;
  description: string;
}

export const REFERRAL_MILESTONES: readonly ReferralMilestone[] = [
  { count: 1,   type: "subscription_months", months: 3, label: "3 months free",   description: "3 months added to your Pro subscription" },
  { count: 2,   type: "subscription_months", months: 3, label: "3 months free",   description: "3 months added to your Pro subscription" },
  { count: 3,   type: "subscription_months", months: 3, label: "3 months free",   description: "3 months added to your Pro subscription" },
  { count: 4,   type: "subscription_months", months: 3, label: "3 months free",   description: "3 months added to your Pro subscription" },
  { count: 5,   type: "physical_item",       item: "swag_pack", label: "Swag pack",     description: "A Fable swag pack shipped to your door" },
  { count: 15,  type: "physical_item",       item: "device",    label: "Free device",   description: "A device shipped to your door" },
  { count: 30,  type: "lifetime_pro",                           label: "Pro forever",   description: "Fable Pro free for life" },
  { count: 100, type: "physical_item",       item: "mac_mini",  label: "Mac Mini",      description: "A Mac Mini shipped to your door" },
] as const;

export function getMilestone(qualifiedCount: number): ReferralMilestone | undefined {
  return REFERRAL_MILESTONES.find((m) => m.count === qualifiedCount);
}

/**
 * Dispatch a referral reward for a referrer who has hit a milestone.
 *
 * Each case is a stub — replace with real implementation when ready:
 *   subscription_months: apply Stripe credit or coupon to referrer's subscription
 *   physical_item:       call swag fulfillment service (e.g. Printful, Swag.com)
 *   lifetime_pro:        set cancel_at_period_end on Stripe sub + set lifetimePro=true on user
 */
export async function fulfillReferralReward(
  referrerId: string,
  milestone: ReferralMilestone
): Promise<void> {
  switch (milestone.type) {
    case "subscription_months": {
      // TODO: add Stripe credit balance to referrer's customer
      // await stripe.customers.createBalanceTransaction(stripeCustomerId, {
      //   amount: -(milestone.months! * 2900), currency: "usd",
      //   description: `Referral reward: ${milestone.months} months free`,
      // });
      console.log(
        `[referral] FULFILLMENT_NEEDED type=subscription_months referrerId=${referrerId} months=${milestone.months}`
      );
      break;
    }
    case "physical_item": {
      // TODO: trigger swag fulfillment service
      // await swagClient.createOrder({ userId: referrerId, item: milestone.item });
      console.log(
        `[referral] FULFILLMENT_NEEDED type=physical_item referrerId=${referrerId} item=${milestone.item}`
      );
      break;
    }
    case "lifetime_pro": {
      // TODO: cancel Stripe subscription at period end + mark user as lifetimePro
      // await stripe.subscriptions.update(stripeSubscriptionId, { cancel_at_period_end: true });
      // await db.update(users).set({ lifetimePro: true }).where(eq(users.id, referrerId));
      console.log(
        `[referral] FULFILLMENT_NEEDED type=lifetime_pro referrerId=${referrerId}`
      );
      break;
    }
  }
}

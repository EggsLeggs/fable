import { stripe } from "./client";

export const REFERRAL_WELCOME_MONTHS = 2;

export async function createReferralCoupon(userId: string): Promise<string> {
  const coupon = await stripe.coupons.create({
    percent_off: 100,
    duration: "repeating",
    duration_in_months: REFERRAL_WELCOME_MONTHS,
    max_redemptions: 1,
    name: `Referral welcome`,
    metadata: { userId, type: "referral_welcome" },
  });

  return coupon.id;
}

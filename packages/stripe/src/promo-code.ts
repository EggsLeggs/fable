import { stripe } from "./client";

export type ResolvedStripePromo =
  | { type: "coupon"; id: string }
  | { type: "promotion_code"; id: string };

function isPromotionCodeRedeemable(promotionCode: {
  active: boolean;
  expires_at: number | null;
  max_redemptions: number | null;
  times_redeemed: number;
  coupon: { valid: boolean };
}): boolean {
  if (!promotionCode.active || !promotionCode.coupon.valid) return false;
  if (promotionCode.expires_at && promotionCode.expires_at * 1000 < Date.now()) {
    return false;
  }
  if (
    promotionCode.max_redemptions !== null &&
    promotionCode.times_redeemed >= promotionCode.max_redemptions
  ) {
    return false;
  }
  return true;
}

async function lookupPromotionCode(code: string): Promise<ResolvedStripePromo | null> {
  const promotionCodes = await stripe.promotionCodes.list({
    code,
    active: true,
    limit: 1,
    expand: ["data.coupon"],
  });

  const promotionCode = promotionCodes.data[0];
  if (!promotionCode || !isPromotionCodeRedeemable(promotionCode)) {
    return null;
  }

  return { type: "promotion_code", id: promotionCode.id };
}

async function lookupCoupon(code: string): Promise<ResolvedStripePromo | null> {
  try {
    const coupon = await stripe.coupons.retrieve(code);
    if (!coupon.valid) return null;
    return { type: "coupon", id: coupon.id };
  } catch {
    return null;
  }
}

export async function resolveStripePromoCode(code: string): Promise<ResolvedStripePromo | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;

  for (const candidate of [trimmed, trimmed.toUpperCase(), trimmed.toLowerCase()]) {
    const promotionCode = await lookupPromotionCode(candidate);
    if (promotionCode) return promotionCode;
  }

  return lookupCoupon(trimmed);
}

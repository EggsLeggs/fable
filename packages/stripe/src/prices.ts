export const PLAN_LIMITS = {
  free: {
    projects: 1,
    members: 3,
    translationKeys: 1000,
    mtCharsIncluded: 0,
  },
  pro: {
    projects: Infinity,
    members: Infinity,
    translationKeys: Infinity,
    mtCharsIncluded: 50_000,
  },
  enterprise: {
    projects: Infinity,
    members: Infinity,
    translationKeys: Infinity,
    mtCharsIncluded: Infinity,
  },
} as const;

export const PRICE_IDS = {
  proMonthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID ?? "",
  proAnnual: process.env.STRIPE_PRO_ANNUAL_PRICE_ID ?? "",
  mtMetered: process.env.STRIPE_MT_METERED_PRICE_ID ?? "",
} as const;

export const PRO_PRICE_MONTHLY_CENTS = 2900;
export const PRO_PRICE_ANNUAL_CENTS = 31320; // 10% off
export const MT_OVERAGE_RATE_PER_100K = 200; // $2.00 in cents

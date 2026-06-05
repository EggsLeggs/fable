export type PlanTier = "free" | "pro" | "enterprise";

export function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY?.trim() &&
      process.env.STRIPE_WEBHOOK_SECRET?.trim() &&
      process.env.STRIPE_PRO_MONTHLY_PRICE_ID?.trim() &&
      process.env.STRIPE_PRO_ANNUAL_PRICE_ID?.trim() &&
      process.env.STRIPE_MT_METERED_PRICE_ID?.trim()
  );
}

export function getEffectivePlan(storedPlan: string): PlanTier {
  if (!isStripeConfigured()) return "free";
  if (storedPlan === "pro" || storedPlan === "enterprise") return storedPlan;
  return "free";
}

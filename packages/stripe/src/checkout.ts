import { stripe } from "./client";
import { PRICE_IDS } from "./prices";
import type { BillingCycle } from "@fable/db";

export async function createCheckoutSession({
  userId,
  billingCycle,
  stripeCustomerId,
  returnBaseUrl,
  trialDays,
  couponId,
  successPath = "/settings/billing?success=true",
  cancelPath = "/settings/billing?canceled=true",
}: {
  userId: string;
  billingCycle: BillingCycle;
  stripeCustomerId?: string | null;
  returnBaseUrl: string;
  trialDays?: number;
  couponId?: string;
  successPath?: string;
  cancelPath?: string;
}): Promise<string> {
  const planPriceId =
    billingCycle === "annual" ? PRICE_IDS.proAnnual : PRICE_IDS.proMonthly;

  const requiresCardUpfront = Boolean(couponId || trialDays);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId ?? undefined,
    line_items: [
      { price: planPriceId, quantity: 1 },
      { price: PRICE_IDS.mtMetered },
    ],
    metadata: { userId },
    ...(couponId ? { discounts: [{ coupon: couponId }] } : {}),
    ...(requiresCardUpfront ? { payment_method_collection: "always" as const } : {}),
    subscription_data: {
      metadata: { userId },
      ...(!couponId && trialDays ? { trial_period_days: trialDays } : {}),
    },
    success_url: `${returnBaseUrl}${successPath}`,
    cancel_url: `${returnBaseUrl}${cancelPath}`,
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}

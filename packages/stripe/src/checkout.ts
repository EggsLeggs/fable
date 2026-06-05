import { stripe } from "./client";
import { PRICE_IDS } from "./prices";
import type { BillingCycle } from "@fable/db";

export async function createCheckoutSession({
  userId,
  billingCycle,
  stripeCustomerId,
  returnBaseUrl,
  trialDays,
}: {
  userId: string;
  billingCycle: BillingCycle;
  stripeCustomerId?: string | null;
  returnBaseUrl: string;
  trialDays?: number;
}): Promise<string> {
  const planPriceId =
    billingCycle === "annual" ? PRICE_IDS.proAnnual : PRICE_IDS.proMonthly;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId ?? undefined,
    line_items: [
      { price: planPriceId, quantity: 1 },
      { price: PRICE_IDS.mtMetered },
    ],
    metadata: { userId },
    subscription_data: {
      metadata: { userId },
      ...(trialDays ? { trial_period_days: trialDays } : {}),
    },
    success_url: `${returnBaseUrl}/settings/billing?success=true`,
    cancel_url: `${returnBaseUrl}/settings/billing?canceled=true`,
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}

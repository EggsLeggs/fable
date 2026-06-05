import { stripe } from "./client";
import { isStripeConfigured } from "./config";
import { db, users } from "@fable/db";
import { eq } from "drizzle-orm";
import type { DbUser } from "@fable/db";

export async function reportMtUsage(
  stripeCustomerId: string,
  chars: number
): Promise<void> {
  if (chars === 0 || !isStripeConfigured()) return;

  await stripe.billing.meterEvents.create({
    event_name: "mt_characters",
    payload: {
      value: String(chars),
      stripe_customer_id: stripeCustomerId,
    },
  });
}

export async function resetMtUsageIfDue(
  user: Pick<DbUser, "id" | "mtCharsResetAt">
): Promise<void> {
  if (!user.mtCharsResetAt || new Date() < user.mtCharsResetAt) return;

  const nextReset = new Date();
  nextReset.setDate(nextReset.getDate() + 30);

  await db
    .update(users)
    .set({ mtCharsUsed: 0, mtCharsResetAt: nextReset })
    .where(eq(users.id, user.id));
}

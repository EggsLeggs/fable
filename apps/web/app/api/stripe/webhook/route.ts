import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import Stripe from "stripe";
import { stripe } from "@fable/stripe";
import { db, users, referrals } from "@fable/db";
import { eq, and, count } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import {
  getMilestone,
  fulfillReferralReward,
  isReferralQualified,
} from "@fable/api/referral-rewards";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Stripe webhook signature verification failed:", message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        if (!userId || !session.subscription) break;

        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string
        );

        const billingCycle =
          subscription.items.data[0]?.price.recurring?.interval === "year"
            ? "annual"
            : "monthly";

        const resetAt = new Date();
        resetAt.setDate(resetAt.getDate() + 30);

        await db
          .update(users)
          .set({
            plan: "pro",
            planStatus: "active",
            billingCycle,
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: subscription.id,
            planCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
            mtCharsUsed: 0,
            mtCharsResetAt: resetAt,
          })
          .where(eq(users.id, userId));

        console.log(`[webhook] user ${userId} upgraded to pro`);

        // Create a pending referral record if this user was referred
        const referee = await db.query.users.findFirst({
          where: eq(users.id, userId),
          columns: { referredBy: true },
        });

        if (referee?.referredBy) {
          const existing = await db.query.referrals.findFirst({
            where: eq(referrals.refereeId, userId),
            columns: { id: true },
          });

          if (!existing) {
            await db.insert(referrals).values({
              id: uuid(),
              referrerId: referee.referredBy,
              refereeId: userId,
              status: "pending",
            });
            console.log(`[referral] pending referral created referrer=${referee.referredBy} referee=${userId}`);
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;
        if (!userId) break;

        const rawStatus = subscription.status;
        const planStatus =
          rawStatus === "active" ||
          rawStatus === "trialing" ||
          rawStatus === "past_due" ||
          rawStatus === "canceled"
            ? rawStatus
            : "active";

        const billingCycle =
          subscription.items.data[0]?.price.recurring?.interval === "year"
            ? "annual"
            : "monthly";

        await db
          .update(users)
          .set({
            planStatus,
            billingCycle,
            planCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
          })
          .where(eq(users.id, userId));

        console.log(`[webhook] user ${userId} subscription updated: ${rawStatus}`);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;
        if (!userId) break;

        // Preserve plan for lifetime Pro users
        const user = await db.query.users.findFirst({
          where: eq(users.id, userId),
          columns: { lifetimePro: true },
        });

        if (user?.lifetimePro) {
          console.log(`[webhook] user ${userId} subscription ended but lifetimePro=true — keeping pro plan`);
          await db
            .update(users)
            .set({ stripeSubscriptionId: null, planCurrentPeriodEnd: null })
            .where(eq(users.id, userId));
          break;
        }

        await db
          .update(users)
          .set({
            plan: "free",
            planStatus: "active",
            billingCycle: "monthly",
            stripeSubscriptionId: null,
            planCurrentPeriodEnd: null,
            mtCharsUsed: 0,
            mtCharsResetAt: null,
          })
          .where(eq(users.id, userId));

        console.log(`[webhook] user ${userId} downgraded to free`);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscription = invoice.subscription
          ? await stripe.subscriptions.retrieve(invoice.subscription as string)
          : null;

        const userId = subscription?.metadata?.userId;
        if (!userId) break;

        if (subscription?.items.data[0]?.price.recurring?.interval !== "year") {
          const resetAt = new Date();
          resetAt.setDate(resetAt.getDate() + 30);
          await db
            .update(users)
            .set({ mtCharsUsed: 0, mtCharsResetAt: resetAt })
            .where(eq(users.id, userId));
          console.log(`[webhook] user ${userId} MT usage reset`);
        }

        // Qualify referral after 3 paid months (monthly) or 1 paid year (annual)
        if (invoice.amount_paid > 0 && subscription) {
          const billingCycle =
            subscription.items.data[0]?.price.recurring?.interval === "year"
              ? "annual"
              : "monthly";

          const paidInvoices = await stripe.invoices.list({
            subscription: subscription.id,
            status: "paid",
            limit: 100,
          });
          const paidCount = paidInvoices.data.filter((inv) => inv.amount_paid > 0).length;

          if (isReferralQualified(billingCycle, paidCount)) {
            await qualifyReferral(userId);
          }
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error(`[webhook] Error handling ${event.type}:`, err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function qualifyReferral(refereeUserId: string): Promise<void> {
  const pending = await db.query.referrals.findFirst({
    where: and(
      eq(referrals.refereeId, refereeUserId),
      eq(referrals.status, "pending")
    ),
    columns: { id: true, referrerId: true },
  });

  if (!pending) return;

  await db
    .update(referrals)
    .set({ status: "qualified", qualifiedAt: new Date() })
    .where(eq(referrals.id, pending.id));

  console.log(`[referral] qualified referral id=${pending.id} referrer=${pending.referrerId}`);

  // Count total qualified referrals for the referrer (including this one)
  const [row] = await db
    .select({ value: count() })
    .from(referrals)
    .where(
      and(
        eq(referrals.referrerId, pending.referrerId),
        // qualified or already rewarded both count toward the total
        eq(referrals.status, "qualified")
      )
    );

  // Also count already-rewarded ones
  const [rewardedRow] = await db
    .select({ value: count() })
    .from(referrals)
    .where(
      and(
        eq(referrals.referrerId, pending.referrerId),
        eq(referrals.status, "rewarded")
      )
    );

  const qualifiedCount = (row?.value ?? 0) + (rewardedRow?.value ?? 0);

  const milestone = getMilestone(qualifiedCount);
  if (!milestone) {
    console.log(`[referral] no milestone at count=${qualifiedCount} for referrer=${pending.referrerId}`);
    return;
  }

  await fulfillReferralReward(pending.referrerId, milestone);

  await db
    .update(referrals)
    .set({ status: "rewarded", rewardedAt: new Date(), rewardMilestone: qualifiedCount })
    .where(eq(referrals.id, pending.id));

  console.log(`[referral] rewarded referral id=${pending.id} milestone=${qualifiedCount} label="${milestone.label}"`);
}

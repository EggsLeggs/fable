import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import Stripe from "stripe";
import { stripe } from "@fable/stripe";
import { db, users } from "@fable/db";
import { eq } from "drizzle-orm";

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

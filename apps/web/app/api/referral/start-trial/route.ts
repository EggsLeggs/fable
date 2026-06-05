import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@fable/auth";
import { db, users } from "@fable/db";
import { createCheckoutSession, createReferralCoupon, isStripeConfigured } from "@fable/stripe";

export const dynamic = "force-dynamic";

function isProSubscriber(user: { plan: string; lifetimePro: boolean }): boolean {
  return user.plan === "pro" || user.lifetimePro;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (!isStripeConfigured()) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  const code = req.nextUrl.searchParams.get("code")?.trim().toUpperCase();
  const billingCycleParam = req.nextUrl.searchParams.get("billingCycle");
  const billingCycle = billingCycleParam === "annual" ? "annual" : "monthly";

  const userId = session.user.id;

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      plan: true,
      referredBy: true,
      stripeReferralCouponId: true,
      stripeCustomerId: true,
    },
  });

  if (!user || user.plan !== "free") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (code && !user.referredBy) {
    const referrer = await db.query.users.findFirst({
      where: eq(users.referralCode, code),
      columns: { id: true, plan: true, lifetimePro: true },
    });

    if (referrer && isProSubscriber(referrer) && referrer.id !== userId) {
      await db.update(users).set({ referredBy: referrer.id }).where(eq(users.id, userId));
      user.referredBy = referrer.id;
    }
  }

  if (!user.referredBy) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  let couponId = user.stripeReferralCouponId;
  if (!couponId) {
    couponId = await createReferralCoupon(userId);
    await db
      .update(users)
      .set({ stripeReferralCouponId: couponId })
      .where(eq(users.id, userId));
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;

  const url = await createCheckoutSession({
    userId,
    billingCycle,
    stripeCustomerId: user.stripeCustomerId,
    returnBaseUrl: appUrl,
    couponId,
    successPath: "/dashboard?welcome=pro",
    cancelPath: "/dashboard",
  });

  return NextResponse.redirect(url);
}

"use client";

import Link from "next/link";
import { Sparkles, Gift, Users } from "lucide-react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { trpc } from "@/lib/trpc/client";

type Props = {
  collapsed?: boolean;
};

type PromoContent = {
  icon: typeof Sparkles;
  title: string;
  description: React.ReactNode;
  href: string;
  cta: string;
};

export function SidebarAdCard({ collapsed }: Props) {
  const { data: usage } = trpc.billing.getUsage.useQuery();

  if (collapsed || !usage) return null;

  let promo: PromoContent | null = null;

  if (usage.isProSubscriber) {
    promo = {
      icon: Users,
      title: t`Refer friends`,
      description: t`Share Fable and earn rewards when your referrals upgrade.`,
      href: "/settings/referrals",
      cta: t`Get your link`,
    };
  } else if (usage.billingAvailable && usage.wasReferred) {
    promo = {
      icon: Gift,
      title: t`Claim your free Pro`,
      description: (
        <Trans>
          You were referred. Add your card for <strong>2 months of Pro free</strong>.
        </Trans>
      ),
      href: "/api/referral/start-trial?billingCycle=monthly",
      cta: t`Start trial`,
    };
  } else if (usage.billingAvailable) {
    promo = {
      icon: Sparkles,
      title: t`Upgrade to Pro`,
      description: t`Unlock unlimited projects, MT translation, webhooks, and more.`,
      href: "/settings/billing",
      cta: t`View plans`,
    };
  }

  if (!promo) return null;

  const Icon = promo.icon;

  return (
    <Link
      href={promo.href}
      className="group mb-2 block rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3 transition-colors hover:bg-sidebar-accent"
    >
      <div className="flex items-start gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-sidebar-foreground">{promo.title}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            {promo.description}
          </p>
          <span className="mt-1.5 inline-block text-[11px] font-medium text-primary group-hover:underline">
            {promo.cta} →
          </span>
        </div>
      </div>
    </Link>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { trpc } from "@/lib/trpc/client";
import type { ReferralMilestone } from "@fable/api/referral-rewards";

const MILESTONE_ICONS: Record<string, string> = {
  subscription_months: "calendar",
  physical_item_swag_pack: "package",
  physical_item_device: "monitor",
  physical_item_mac_mini: "cpu",
};

function milestoneIcon(milestone: ReferralMilestone): string {
  if (milestone.type === "physical_item" && milestone.item) {
    return MILESTONE_ICONS[`physical_item_${milestone.item}`] ?? "package";
  }
  return MILESTONE_ICONS[milestone.type] ?? "gift";
}

function MilestoneRow({
  milestone,
  qualifiedCount,
  isClaimed,
}: {
  milestone: ReferralMilestone;
  qualifiedCount: number;
  isClaimed: boolean;
}) {
  const isUnlocked = qualifiedCount >= milestone.count;
  const isNext = !isUnlocked && qualifiedCount === milestone.count - 1;

  return (
    <div
      className={`flex items-center gap-4 rounded-lg border p-4 transition-colors ${
        isClaimed
          ? "border-primary/30 bg-primary/5"
          : isUnlocked
          ? "border-border bg-card"
          : "border-border bg-card opacity-60"
      }`}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          isClaimed
            ? "bg-primary text-primary-foreground"
            : isUnlocked
            ? "bg-muted text-foreground"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {isClaimed ? (
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        ) : (
          <span>{milestone.count}</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {milestone.count === 1
            ? t`1 referral`
            : t`${milestone.count} referrals`}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{milestone.description}</p>
      </div>

      <div className="shrink-0 text-right">
        {isClaimed ? (
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            {t`Claimed`}
          </span>
        ) : isNext ? (
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {t`Next`}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default function ReferralsPage() {
  const [copied, setCopied] = useState(false);

  const usageQuery = trpc.billing.getUsage.useQuery();
  const isPro = usageQuery.data?.plan === "pro";

  const codeQuery = trpc.referral.getMyCode.useQuery(undefined, { enabled: isPro });
  const statsQuery = trpc.referral.getStats.useQuery(undefined, { enabled: isPro });

  const stats = statsQuery.data;
  const code = codeQuery.data?.code ?? stats?.code;

  const appUrl = typeof window !== "undefined"
    ? `${window.location.origin}/signup`
    : "/signup";

  const referralLink = code ? `${appUrl}?ref=${code}` : null;

  function handleCopy() {
    if (!referralLink) return;
    void navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (usageQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">{t`Loading...`}</div>;
  }

  if (!isPro) {
    return (
      <div className="flex w-full flex-1 flex-col">
        <div className="max-w-xl space-y-6">
          <section className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-sm font-semibold">{t`Pro required`}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t`Only Pro subscribers can refer people and earn referral rewards.`}
            </p>
            <Link href="/settings/billing" className="btn-primary mt-4 inline-block text-sm">
              {t`Upgrade to Pro`}
            </Link>
          </section>

          <section className="rounded-lg border border-border bg-muted/40 p-5">
            <h2 className="mb-3 text-sm font-semibold">{t`How it works`}</h2>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="shrink-0 font-medium text-foreground">1.</span>
                <span>{t`Upgrade to Pro and share your referral link.`}</span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 font-medium text-foreground">2.</span>
                <Trans>
                  <span>Your friends get <strong className="text-foreground">2 months of Pro free</strong> when they upgrade.</span>
                </Trans>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 font-medium text-foreground">3.</span>
                <span>{t`Once they complete 3 paid months on a monthly plan, or 1 paid year on an annual plan, you earn a reward.`}</span>
              </li>
            </ol>
          </section>
        </div>
      </div>
    );
  }

  if (statsQuery.isLoading || codeQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">{t`Loading...`}</div>;
  }

  const qualifiedCount = stats?.qualifiedCount ?? 0;
  const pendingCount = stats?.pendingCount ?? 0;
  const rewardedMilestones = new Set(stats?.rewardedMilestones ?? []);
  const milestones = (stats?.milestones ?? []) as ReferralMilestone[];

  return (
    <div className="flex w-full flex-1 flex-col">
      <div className="max-w-xl space-y-8">

        {/* Referral link */}
        <section className="rounded-lg border border-border bg-card p-6">
          <p className="mb-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {t`Your referral link`}
          </p>
          <p className="mb-4 text-sm text-muted-foreground">
            <Trans>
              Share this link. Anyone who signs up gets <strong>2 months of Pro free</strong> when they upgrade.
            </Trans>
          </p>
          {referralLink ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 overflow-hidden rounded-md border border-border bg-muted px-3 py-2">
                <p className="truncate font-mono text-sm">{referralLink}</p>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="btn-secondary shrink-0 text-sm"
              >
                {copied ? t`Copied!` : t`Copy`}
              </button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t`Generating your link...`}</p>
          )}
        </section>

        {/* Stats */}
        <section>
          <h2 className="mb-4 text-sm font-semibold">{t`Your referrals`}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-card p-4 text-center">
              <p className="text-2xl font-bold">{qualifiedCount}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t`Qualified`}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4 text-center">
              <p className="text-2xl font-bold">{pendingCount}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t`Pending`}</p>
            </div>
          </div>
          {pendingCount > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              <Trans>
                Pending referrals qualify after 3 paid months on a monthly plan, or 1 paid year on an annual plan.
              </Trans>
            </p>
          )}
        </section>

        {/* Progress toward next milestone */}
        {stats?.nextMilestone && (
          <section>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium">{t`Progress to next reward`}</span>
              <span className="text-muted-foreground">
                {qualifiedCount} / {stats.nextMilestone.count}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${Math.min((qualifiedCount / stats.nextMilestone.count) * 100, 100)}%`,
                }}
              />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {stats.nextMilestone.count - qualifiedCount === 1
                ? t`1 more referral to unlock ${stats.nextMilestone.label}`
                : t`${stats.nextMilestone.count - qualifiedCount} more referrals to unlock ${stats.nextMilestone.label}`}
            </p>
          </section>
        )}

        {/* Milestones */}
        <section>
          <h2 className="mb-4 text-sm font-semibold">{t`Rewards`}</h2>
          <div className="space-y-2">
            {milestones.map((milestone) => (
              <MilestoneRow
                key={milestone.count}
                milestone={milestone}
                qualifiedCount={qualifiedCount}
                isClaimed={rewardedMilestones.has(milestone.count)}
              />
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="rounded-lg border border-border bg-muted/40 p-5">
          <h2 className="mb-3 text-sm font-semibold">{t`How it works`}</h2>
          <ol className="space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="shrink-0 font-medium text-foreground">1.</span>
              <span>{t`Share your link with a friend or on social media.`}</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 font-medium text-foreground">2.</span>
              <Trans>
                <span>They sign up and get <strong className="text-foreground">2 months of Pro free</strong> when they upgrade.</span>
              </Trans>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 font-medium text-foreground">3.</span>
              <span>{t`Once they complete 3 paid months on a monthly plan, or 1 paid year on an annual plan, you earn a reward.`}</span>
            </li>
          </ol>
        </section>

      </div>
    </div>
  );
}

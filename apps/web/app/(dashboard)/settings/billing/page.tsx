"use client";

import { useState } from "react";
import { toast } from "sonner";
import { t } from "@lingui/core/macro";
import { trpc } from "@/lib/trpc/client";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border py-6 first:border-t-0 first:pt-0 last:pb-0">
      <div className="mb-5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function UsageMeter({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number | null;
}) {
  const pct = limit === null ? 0 : Math.min((used / limit) * 100, 100);
  const overLimit = limit !== null && used >= limit;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={overLimit ? "font-medium text-destructive" : "font-medium"}>
          {used.toLocaleString()}
          {limit !== null ? ` / ${limit.toLocaleString()}` : ""}
        </span>
      </div>
      {limit !== null && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all ${overLimit ? "bg-destructive" : "bg-primary"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function BillingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [capInput, setCapInput] = useState("");
  const [capSaving, setCapSaving] = useState(false);

  const usageQuery = trpc.billing.getUsage.useQuery();
  const usage = usageQuery.data;
  const isPro = usage?.plan === "pro";
  const billingAvailable = usage?.billingAvailable ?? false;

  const checkoutMutation = trpc.billing.checkout.useMutation({
    onSuccess: ({ url }) => { window.location.href = url; },
    onError: (err) => toast.error(err.message ?? t`Could not start checkout. Please try again.`),
  });

  const portalMutation = trpc.billing.portal.useMutation({
    onSuccess: ({ url }) => { window.location.href = url; },
    onError: (err) => toast.error(err.message ?? t`Could not open billing portal. Please try again.`),
  });

  const updateCapMutation = trpc.billing.updateMtCap.useMutation({
    onSuccess: () => {
      void usageQuery.refetch();
      setCapInput("");
      setCapSaving(false);
      toast.success(t`Overage cap updated.`);
    },
    onError: (err) => {
      toast.error(err.message ?? t`Could not update cap.`);
      setCapSaving(false);
    },
  });

  function handleSaveCap() {
    setCapSaving(true);
    const parsed = capInput === "" ? null : parseInt(capInput, 10);
    updateCapMutation.mutate({ cap: parsed });
  }

  if (usageQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">{t`Loading...`}</div>;
  }

  if (usageQuery.isError) {
    return <div className="text-sm text-destructive">{t`Failed to load billing information.`}</div>;
  }

  const showReferralOffer = !isPro && billingAvailable && usage?.wasReferred;

  return (
    <div className="flex w-full flex-1 flex-col">
      <div className="max-w-xl">
        {showReferralOffer && (
          <Section
            title={t`2 months of Pro free`}
            description={t`You were referred. Your discount is saved and will be applied when you add your card.`}
          >
            <a
              href={`/api/referral/start-trial?billingCycle=${billingCycle}`}
              className="btn-primary inline-block text-sm"
            >
              {t`Start trial`}
            </a>
          </Section>
        )}

        <Section title={t`Current plan`}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold capitalize">
                  {usage?.plan ?? "free"}
                </span>
                {isPro && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {usage?.billingCycle === "annual" ? t`Annual` : t`Monthly`}
                  </span>
                )}
              </div>
              {isPro && usage?.planCurrentPeriodEnd && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t`Renews`} {new Date(usage.planCurrentPeriodEnd).toLocaleDateString()}
                </p>
              )}
            </div>

            {isPro && billingAvailable ? (
              <button
                type="button"
                className="btn-secondary shrink-0 text-sm"
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
              >
                {portalMutation.isPending ? t`Opening...` : t`Manage billing`}
              </button>
            ) : !isPro && billingAvailable ? (
              <div className="flex shrink-0 flex-col items-end gap-2">
                <div className="flex items-center gap-1 rounded-lg border border-border bg-muted p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setBillingCycle("monthly")}
                    className={`rounded-md px-3 py-1 transition-colors ${billingCycle === "monthly" ? "bg-background font-medium shadow-sm" : "text-muted-foreground"}`}
                  >
                    {t`Monthly`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle("annual")}
                    className={`rounded-md px-3 py-1 transition-colors ${billingCycle === "annual" ? "bg-background font-medium shadow-sm" : "text-muted-foreground"}`}
                  >
                    {t`Annual`}
                    <span className="ml-1 text-[10px] font-semibold text-emerald-600">-10%</span>
                  </button>
                </div>
                <button
                  type="button"
                  className="btn-primary text-sm"
                  onClick={() => checkoutMutation.mutate({ billingCycle })}
                  disabled={checkoutMutation.isPending}
                >
                  {checkoutMutation.isPending
                    ? t`Redirecting...`
                    : billingCycle === "annual"
                    ? t`Upgrade - $26/mo billed annually`
                    : t`Upgrade - $29/mo`}
                </button>
              </div>
            ) : null}
          </div>

          {!billingAvailable && (
            <p className="text-xs text-muted-foreground">
              {t`Billing is not configured on this server. Upgrades are unavailable and all accounts use the free tier.`}
            </p>
          )}
        </Section>

        <Section title={t`Usage this period`}>
          <div className="space-y-4 rounded-lg border border-border p-4">
            <UsageMeter
              label={t`Projects`}
              used={usage?.usage.projects ?? 0}
              limit={usage?.limits.projects ?? 1}
            />
            <UsageMeter
              label={t`Team members`}
              used={usage?.usage.members ?? 0}
              limit={usage?.limits.members ?? 3}
            />
            <UsageMeter
              label={t`Translation keys`}
              used={usage?.usage.translationKeys ?? 0}
              limit={usage?.limits.translationKeys ?? 1000}
            />
            {isPro && billingAvailable && (
              <UsageMeter
                label={t`MT characters this month`}
                used={usage?.mtCharsUsed ?? 0}
                limit={usage?.mtCharsCap ?? usage?.limits.mtCharsIncluded ?? null}
              />
            )}
          </div>
        </Section>

        {isPro && billingAvailable && (
          <Section
            title={t`MT overage cap`}
            description={t`Stop machine translation once your monthly usage reaches this limit. This cap applies across all your projects. Leave blank for no cap (you will be billed per character above the 50k included).`}
          >
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="number"
                min={0}
                placeholder={
                  usage?.mtCharsCap != null
                    ? t`Current: ${usage.mtCharsCap.toLocaleString()} chars`
                    : t`No limit (billed per use)`
                }
                value={capInput}
                onChange={(e) => setCapInput(e.target.value)}
                className="w-56 rounded-md border border-border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={handleSaveCap}
                disabled={capSaving}
              >
                {capSaving ? t`Saving...` : t`Save`}
              </button>
              {usage?.mtCharsCap != null && (
                <button
                  type="button"
                  className="text-sm text-muted-foreground underline-offset-2 hover:underline"
                  onClick={() => updateCapMutation.mutate({ cap: null })}
                >
                  {t`Remove cap`}
                </button>
              )}
            </div>
          </Section>
        )}

        <p className="border-t border-border pt-6 text-xs text-muted-foreground">
          <a href="/pricing" className="underline underline-offset-2">
            {t`View full pricing details`}
          </a>
        </p>
      </div>
    </div>
  );
}

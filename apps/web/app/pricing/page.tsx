"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";

const FREE_FEATURES = [
  "1 project",
  "3 team members",
  "1,000 translation keys",
  "Public & private projects",
  "Community support",
];

const PRO_FEATURES = [
  "Unlimited projects",
  "Unlimited team members",
  "Unlimited translation keys",
  "50,000 MT characters included",
  "MT overage at $2 / 100k chars",
  "Monthly overage cap",
  "Webhooks",
  "Glossary",
  "Translation memory",
  "Email support",
];

const ENTERPRISE_FEATURES = [
  "Everything in Pro",
  "Custom MT character limits",
  "SSO / SAML",
  "Audit log",
  "SLA",
  "Dedicated support",
  "Custom contracts",
];

function FeatureItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2 text-sm text-muted-foreground">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      {text}
    </li>
  );
}

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="min-h-screen bg-background px-4 py-24">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-12 text-center">
          <Link href="/" className="mb-8 inline-block text-sm font-bold tracking-tight">
            fable
          </Link>
          <h1 className="mt-6 text-4xl font-bold tracking-tight">
            Simple, transparent pricing
          </h1>
          <p className="mt-3 text-muted-foreground">
            Start free. Upgrade when your team grows.
          </p>

          {/* Billing toggle */}
          <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-border bg-muted p-1 text-sm">
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={`rounded-full px-4 py-1.5 transition-colors ${
                !annual
                  ? "bg-background font-medium shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={`rounded-full px-4 py-1.5 transition-colors ${
                annual
                  ? "bg-background font-medium shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              Annual
              <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                10% off
              </span>
            </button>
          </div>
        </div>

        {/* Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Free */}
          <div className="flex flex-col rounded-xl border border-border bg-card p-8">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Free
              </p>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-bold">$0</span>
                <span className="text-sm text-muted-foreground">/mo</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                For individuals and small open source projects.
              </p>
            </div>

            <Link
              href="/signup"
              className="mb-6 block rounded-lg border border-border bg-muted px-4 py-2 text-center text-sm font-medium transition-colors hover:bg-muted/80"
            >
              Get started free
            </Link>

            <ul className="space-y-3">
              {FREE_FEATURES.map((f) => (
                <FeatureItem key={f} text={f} />
              ))}
            </ul>
          </div>

          {/* Pro */}
          <div className="relative flex flex-col rounded-xl border-2 border-primary bg-card p-8 shadow-lg">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="rounded-full bg-primary px-3 py-0.5 text-[11px] font-semibold uppercase tracking-widest text-primary-foreground">
                Popular
              </span>
            </div>

            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Pro
              </p>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-bold">
                  ${annual ? "26" : "29"}
                </span>
                <span className="text-sm text-muted-foreground">/mo</span>
              </div>
              {annual && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  $313 billed annually
                </p>
              )}
              <p className="mt-2 text-sm text-muted-foreground">
                For growing teams shipping software in multiple languages.
              </p>
            </div>

            <Link
              href="/settings/billing"
              className="mb-6 block rounded-lg bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Upgrade to Pro
            </Link>

            <ul className="space-y-3">
              {PRO_FEATURES.map((f) => (
                <FeatureItem key={f} text={f} />
              ))}
            </ul>
          </div>

          {/* Enterprise */}
          <div className="flex flex-col rounded-xl border border-border bg-card p-8 opacity-80">
            <div className="mb-6">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Enterprise
                </p>
                <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Coming soon
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-bold">Custom</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                For large teams that need custom limits, SSO, and SLAs.
              </p>
            </div>

            <button
              type="button"
              disabled
              className="mb-6 block rounded-lg border border-border bg-muted px-4 py-2 text-center text-sm font-medium text-muted-foreground opacity-60"
            >
              Contact us
            </button>

            <ul className="space-y-3">
              {ENTERPRISE_FEATURES.map((f) => (
                <FeatureItem key={f} text={f} />
              ))}
            </ul>
          </div>
        </div>

        {/* MT pricing note */}
        <p className="mt-10 text-center text-xs text-muted-foreground">
          Pro includes 50,000 MT characters per month. Additional characters are billed at $2 per 100,000 chars.
          Set a monthly cap in billing settings to control spend.
        </p>
      </div>
    </div>
  );
}

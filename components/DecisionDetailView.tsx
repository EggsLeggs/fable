"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Check, ChevronRight, Flag, X } from "lucide-react";
import { Campaign, Decision } from "@/lib/store";
import { getDecisionTimeline } from "@/lib/decision-audit";
import { DecisionTimeline } from "@/components/DecisionTimeline";
import { StatusBadge } from "@/components/StatusBadge";

const iconSm = "h-3.5 w-3.5 shrink-0";

type Props = {
  campaignId: string;
  decisionId: string;
};

export function DecisionDetailView({ campaignId, decisionId }: Props) {
  const [decision, setDecision] = useState<Decision | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [note, setNote] = useState("");
  const [acting, setActing] = useState(false);

  const fetchDecision = useCallback(async () => {
    const res = await fetch(
      `/api/decisions/${decisionId}?campaignId=${encodeURIComponent(campaignId)}`
    );
    if (res.status === 404) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const data = await res.json();
    setDecision(data.decision);
    setCampaign(data.campaign);
    setNotFound(false);
    setLoading(false);
  }, [campaignId, decisionId]);

  useEffect(() => {
    setLoading(true);
    void fetchDecision();
  }, [fetchDecision]);

  async function act(action: "approved" | "vetoed" | "flagged") {
    if (!decision) return;
    setActing(true);
    await fetch(`/api/decisions/${decision.id}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note, campaignId }),
    });
    await fetchDecision();
    setActing(false);
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="font-mono text-xs text-muted-foreground">Loading decision…</span>
      </div>
    );
  }

  if (notFound || !decision) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <p className="text-sm text-muted-foreground">Decision not found</p>
        <Link
          href={`/campaigns/${campaignId}`}
          className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
        >
          <ArrowLeft className={iconSm} aria-hidden />
          Back to campaign
        </Link>
      </div>
    );
  }

  const timeline = getDecisionTimeline(decision);
  const displayStatus =
    decision.humanAction === "vetoed"
      ? "vetoed"
      : decision.humanAction === "approved"
        ? "approved"
        : decision.decision;

  const title =
    decision.decision === "bid"
      ? "Bid placed"
      : decision.decision === "skip"
        ? "Placement skipped"
        : "Decision flagged";

  return (
    <div className="flex min-h-0 flex-1 text-foreground">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-2 border-b border-border px-6 py-3">
          <Link
            href={`/campaigns/${campaignId}`}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className={iconSm} aria-hidden />
            Back
          </Link>
          <ChevronRight className="h-3 w-3 text-muted-foreground" aria-hidden />
          <span className="truncate text-xs text-muted-foreground">
            {campaign?.name ?? decision.campaignName}
          </span>
          <ChevronRight className="h-3 w-3 text-muted-foreground" aria-hidden />
          <span className="truncate font-mono text-xs text-muted-foreground">
            {decision.id.slice(0, 8)}
          </span>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-6 py-8">
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <StatusBadge status={displayStatus} />
              <span className="font-mono text-xs text-muted-foreground">
                {new Date(decision.timestamp).toLocaleString("en-GB", {
                  dateStyle: "medium",
                  timeStyle: "medium",
                })}
              </span>
            </div>

            <h1 className="mb-2 text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              {decision.advertiser} · {decision.campaignName}
            </p>

            <div className="mb-8 rounded-lg border border-border bg-card p-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Context
              </p>
              <div className="mb-4 space-y-2">
                {decision.fullContext.map((m, i) => (
                  <div
                    key={i}
                    className="rounded-md bg-muted/50 px-3 py-2 font-mono text-xs leading-relaxed"
                  >
                    <span className="mr-2 uppercase text-muted-foreground">{m.role}</span>
                    {m.content}
                  </div>
                ))}
              </div>
              <p className="text-sm leading-relaxed">{decision.reasoning}</p>
            </div>

            <section>
              <h2 className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Activity
              </h2>
              <DecisionTimeline events={timeline} />
            </section>
          </div>
        </main>
      </div>

      <aside className="flex w-72 min-h-0 shrink-0 flex-col overflow-y-auto border-l border-border px-5 py-6">
        <p className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Properties
        </p>

        <dl className="space-y-4 text-sm">
          <div>
            <dt className="mb-1 text-xs text-muted-foreground">Status</dt>
            <dd>
              <StatusBadge status={displayStatus} />
            </dd>
          </div>
          <div>
            <dt className="mb-1 text-xs text-muted-foreground">Confidence</dt>
            <dd className="font-mono">{decision.confidence}%</dd>
          </div>
          {decision.suggestedCPM != null && decision.suggestedCPM > 0 && (
            <div>
              <dt className="mb-1 text-xs text-muted-foreground">Suggested CPM</dt>
              <dd className="font-mono">${decision.suggestedCPM.toFixed(2)}</dd>
            </div>
          )}
          {decision.flags.length > 0 && (
            <div>
              <dt className="mb-1.5 text-xs text-muted-foreground">Flags</dt>
              <dd className="flex flex-wrap gap-1.5">
                {decision.flags.map((f) => (
                  <span
                    key={f}
                    className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 font-mono text-xs text-red-500"
                  >
                    <AlertTriangle className={iconSm} aria-hidden />
                    {f}
                  </span>
                ))}
              </dd>
            </div>
          )}
          {decision.adReturned && (
            <div>
              <dt className="mb-1 text-xs text-muted-foreground">Ad served</dt>
              <dd className="space-y-1 rounded-md border border-border bg-muted/30 p-3 text-xs">
                <div className="font-medium text-foreground">{decision.adReturned.headline}</div>
                {decision.adReturned.description && (
                  <div className="text-muted-foreground">{decision.adReturned.description}</div>
                )}
                <div className="font-mono text-muted-foreground">
                  ${decision.adReturned.price.toFixed(2)} CPM · {decision.adReturned.ctaText}
                </div>
              </dd>
            </div>
          )}
          {decision.humanAction && (
            <div>
              <dt className="mb-1 text-xs text-muted-foreground">Human review</dt>
              <dd className="font-mono text-xs">
                {decision.humanAction}
                {decision.humanNote && (
                  <span className="mt-1 block text-muted-foreground">
                    &quot;{decision.humanNote}&quot;
                  </span>
                )}
              </dd>
            </div>
          )}
        </dl>

        {!decision.humanAction && (
          <div className="mt-6 space-y-2 border-t border-border pt-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Review
            </p>
            <div className="flex flex-col gap-2">
              {(
                [
                  { action: "approved" as const, label: "Approve", Icon: Check, className: "text-indigo-500 border-indigo-500/30 hover:bg-indigo-500/10" },
                  { action: "vetoed" as const, label: "Veto", Icon: X, className: "text-orange-500 border-orange-500/30 hover:bg-orange-500/10" },
                  { action: "flagged" as const, label: "Flag", Icon: Flag, className: "text-amber-500 border-amber-500/30 hover:bg-amber-500/10" },
                ] as const
              ).map(({ action, label, Icon, className }) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => act(action)}
                  disabled={acting}
                  className={`flex items-center justify-center gap-1.5 rounded-md border py-2 text-xs font-medium transition-colors disabled:opacity-40 ${className}`}
                >
                  <Icon className={iconSm} aria-hidden />
                  {label}
                </button>
              ))}
            </div>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note (optional)…"
              className="input font-mono text-xs"
            />
          </div>
        )}
      </aside>
    </div>
  );
}

"use client";
import { Hexagon } from "lucide-react";
import { Decision } from "@/lib/store";
import { DecisionCard } from "./DecisionCard";

function DecisionCardSkeleton() {
  return (
    <div
      className="animate-pulse space-y-3 rounded-lg border border-border bg-card p-4"
      aria-hidden
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-5 w-14 rounded-full bg-muted/60" />
          <div className="h-3 w-16 rounded bg-muted/40" />
        </div>
        <div className="h-3 w-12 rounded bg-muted/40" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-muted/40" />
        <div className="h-3 w-4/5 rounded bg-muted/40" />
      </div>
      <div className="h-16 rounded-md bg-muted/30" />
    </div>
  );
}

export function DecisionFeed({
  decisions,
  campaignId,
  onAction,
  loading,
  emptyMessage,
}: {
  decisions: Decision[];
  campaignId: string;
  onAction: () => void;
  loading?: boolean;
  emptyMessage?: string;
}) {
  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading decision log">
        {Array.from({ length: 3 }, (_, i) => (
          <DecisionCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (decisions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Hexagon className="mb-3 h-8 w-8 text-border" strokeWidth={1.25} aria-hidden />
        <div className="font-mono text-xs text-muted-foreground">
          {emptyMessage ?? "No decisions yet — fire a scenario to begin"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {decisions.map((d) => (
        <DecisionCard
          key={d.id}
          decision={d}
          campaignId={campaignId}
          onAction={onAction}
        />
      ))}
    </div>
  );
}

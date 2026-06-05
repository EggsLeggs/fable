"use client";
import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, ChevronRight, Flag, X } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { Decision } from "@/lib/store";

const iconSm = "h-3.5 w-3.5 shrink-0";

export function DecisionCard({
  decision: d,
  campaignId,
  onAction,
}: {
  decision: Decision;
  campaignId: string;
  onAction: () => void;
}) {
  const [note, setNote] = useState("");
  const [acting, setActing] = useState(false);

  async function act(action: "approved" | "vetoed" | "flagged") {
    setActing(true);
    await fetch(`/api/decisions/${d.id}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note, campaignId }),
    });
    onAction();
    setActing(false);
  }

  const time = new Date(d.timestamp).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const borderClass =
    d.humanAction === "vetoed"
      ? "border-orange-500/30"
      : d.humanAction === "approved"
        ? "border-indigo-500/30"
        : d.decision === "flagged"
          ? "border-red-500/30"
          : "border-border";

  const detailHref = `/campaigns/${campaignId}/decisions/${d.id}`;

  return (
    <div
      className={`space-y-3 rounded-lg border bg-card text-card-foreground transition-colors duration-150 ${borderClass}`}
    >
      <Link
        href={detailHref}
        className="block space-y-3 rounded-lg p-4 transition-colors hover:bg-muted"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              status={
                d.humanAction === "vetoed"
                  ? "vetoed"
                  : d.humanAction === "approved"
                    ? "approved"
                    : d.decision
              }
            />
            <span className="font-mono text-xs text-muted-foreground">{d.id.slice(0, 8)}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="font-mono text-xs text-muted-foreground">{time}</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          </div>
        </div>

        <div className="rounded-md bg-muted p-2.5 font-mono text-xs leading-relaxed text-muted-foreground">
          <span className="mr-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            ctx
          </span>
          &quot;{d.contextSnippet}
          {d.contextSnippet.length >= 120 ? "…" : ""}&quot;
        </div>

        <p className="line-clamp-2 text-sm leading-relaxed">{d.reasoning}</p>
      </Link>

      <div className="space-y-3 px-4 pb-4 pt-0">

      <div className="flex flex-wrap gap-4 font-mono text-xs text-muted-foreground">
        <span>
          confidence <span className="text-foreground">{d.confidence}%</span>
        </span>
        {d.suggestedCPM ? (
          <span>
            CPM <span className="text-foreground">${d.suggestedCPM.toFixed(2)}</span>
          </span>
        ) : null}
      </div>

      {d.flags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {d.flags.map((f) => (
            <span
              key={f}
              className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 font-mono text-xs text-red-500"
            >
              <AlertTriangle className={iconSm} aria-hidden />
              {f}
            </span>
          ))}
        </div>
      )}

      {d.adReturned && (
        <div className="space-y-1 rounded-md border border-border bg-muted p-3">
          <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Ad served
          </div>
          <div className="text-sm font-medium">{d.adReturned.headline}</div>
          {d.adReturned.description && (
            <div className="text-xs text-muted-foreground">{d.adReturned.description}</div>
          )}
          <div className="mt-1 flex gap-3 font-mono text-xs text-muted-foreground">
            <span>{d.adReturned.advertiser}</span>
            <span>·</span>
            <span>CPM ${d.adReturned.price.toFixed(2)}</span>
            <span>·</span>
            <span>{d.adReturned.ctaText}</span>
          </div>
        </div>
      )}

      {d.humanAction && (
        <>
          <div className="rounded-md bg-muted p-2 font-mono text-xs text-muted-foreground">
            operator: <span className="text-foreground">{d.humanAction}</span>
            {d.humanNote && <> — &quot;{d.humanNote}&quot;</>}
          </div>
          <Link
            href={detailHref}
            className="block text-center font-mono text-[10px] text-muted-foreground transition-colors hover:text-accent"
          >
            View full audit trail →
          </Link>
        </>
      )}

      {!d.humanAction && (
        <div className="space-y-2">
          <div className="flex gap-2">
            {(["approved", "vetoed", "flagged"] as const).map((action) => {
              const styles = {
                approved: {
                  className: "text-indigo-500 border-indigo-500/30 hover:bg-indigo-500/10",
                  label: "Approve",
                  Icon: Check,
                },
                vetoed: {
                  className: "text-orange-500 border-orange-500/30 hover:bg-orange-500/10",
                  label: "Veto",
                  Icon: X,
                },
                flagged: {
                  className: "text-amber-500 border-amber-500/30 hover:bg-amber-500/10",
                  label: "Flag",
                  Icon: Flag,
                },
              }[action];
              const { className, label, Icon } = styles;
              return (
                <button
                  key={action}
                  type="button"
                  onClick={() => act(action)}
                  disabled={acting}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border py-1.5 text-xs font-medium transition-colors duration-150 disabled:opacity-40 ${className}`}
                >
                  <Icon className={iconSm} aria-hidden />
                  {label}
                </button>
              );
            })}
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note (optional)..."
            className="input font-mono text-xs"
          />
          <Link
            href={detailHref}
            className="block text-center font-mono text-[10px] text-muted-foreground transition-colors hover:text-accent"
          >
            View full audit trail →
          </Link>
        </div>
      )}
      </div>
    </div>
  );
}

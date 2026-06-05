"use client";

import { useState } from "react";
import {
  Bot,
  ChevronRight,
  CircleDot,
  Search,
  Server,
  Sparkles,
  User,
  Zap,
} from "lucide-react";
import type { DecisionAuditEvent } from "@/lib/store";
import { formatRelativeTime } from "@/lib/decision-audit";

const iconSm = "h-3.5 w-3.5 shrink-0";

function serviceIcon(service: DecisionAuditEvent["service"]) {
  switch (service) {
    case "tavily":
      return <Search className={iconSm} aria-hidden />;
    case "openai":
      return <Sparkles className={iconSm} aria-hidden />;
    case "thrad":
      return <Zap className={iconSm} aria-hidden />;
    case "overmind":
      return <Server className={iconSm} aria-hidden />;
    default:
      return <Bot className={iconSm} aria-hidden />;
  }
}

function actorLabel(actor: DecisionAuditEvent["actor"]) {
  switch (actor) {
    case "operator":
      return "Operator";
    case "system":
      return "Sentinel";
    default:
      return "Agent";
  }
}

function statusDotClass(status: DecisionAuditEvent["status"]) {
  switch (status) {
    case "error":
      return "bg-red-500";
    case "warning":
      return "bg-amber-500";
    case "skipped":
      return "bg-muted-foreground/50";
    default:
      return "bg-accent";
  }
}

function TimelineEvent({ event }: { event: DecisionAuditEvent }) {
  const [open, setOpen] = useState(false);
  const hasDetails = event.details && Object.keys(event.details).length > 0;
  const ActorIcon = event.actor === "operator" ? User : event.actor === "system" ? CircleDot : Bot;

  return (
    <li className="relative flex gap-3 pb-6 last:pb-0">
      <div className="flex flex-col items-center">
        <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-card">
          <span
            className={`absolute -left-px top-1/2 h-2 w-2 -translate-y-1/2 rounded-full ${statusDotClass(event.status)}`}
            aria-hidden
          />
          <span className="text-muted-foreground">{serviceIcon(event.service)}</span>
        </div>
        <div className="mt-1 w-px flex-1 bg-border" aria-hidden />
      </div>

      <div className="min-w-0 flex-1 pt-0.5">
        <button
          type="button"
          onClick={() => hasDetails && setOpen((v) => !v)}
          disabled={!hasDetails}
          className={`group w-full text-left ${hasDetails ? "cursor-pointer" : "cursor-default"}`}
        >
          <div className="flex items-start gap-1.5">
            {hasDetails && (
              <ChevronRight
                className={`mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150 ${open ? "rotate-90" : ""}`}
                aria-hidden
              />
            )}
            <p className="text-sm leading-snug text-foreground">
              <span className="inline-flex items-center gap-1 font-medium">
                <ActorIcon className="h-3 w-3 text-muted-foreground" aria-hidden />
                {actorLabel(event.actor)}
              </span>{" "}
              <span className="text-muted-foreground">{event.summary}</span>
              <span className="text-muted-foreground"> · </span>
              <span className="font-mono text-xs text-muted-foreground">
                {formatRelativeTime(event.timestamp)}
              </span>
            </p>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 pl-5">
            <span className="rounded border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              {event.service}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">{event.action}</span>
          </div>
        </button>

        {open && hasDetails && (
          <div className="mt-2 ml-5 overflow-hidden rounded-md border border-border bg-muted/30">
            <pre className="max-h-80 overflow-auto p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
              {JSON.stringify(event.details, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </li>
  );
}

export function DecisionTimeline({ events }: { events: DecisionAuditEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="py-8 text-center font-mono text-xs text-muted-foreground">
        No activity recorded for this decision
      </p>
    );
  }

  return (
    <ol className="relative" aria-label="Decision activity">
      {events.map((event) => (
        <TimelineEvent key={event.id} event={event} />
      ))}
    </ol>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { ListFilter } from "lucide-react";
import { Decision } from "@/lib/store";
import { cn } from "@/lib/utils";

export type DecisionFilterStatus =
  | "bid"
  | "skip"
  | "flagged"
  | "approved"
  | "vetoed";

const FILTER_OPTIONS: { value: DecisionFilterStatus; label: string }[] = [
  { value: "bid", label: "Bid" },
  { value: "skip", label: "Skip" },
  { value: "flagged", label: "Flagged" },
  { value: "approved", label: "Approved" },
  { value: "vetoed", label: "Vetoed" },
];

export function decisionDisplayStatus(d: Decision): DecisionFilterStatus {
  if (d.humanAction === "vetoed") return "vetoed";
  if (d.humanAction === "approved") return "approved";
  return d.decision;
}

export function filterDecisions(
  decisions: Decision[],
  active: Set<DecisionFilterStatus>
): Decision[] {
  if (active.size === 0) return decisions;
  return decisions.filter((d) => active.has(decisionDisplayStatus(d)));
}

type Props = {
  active: Set<DecisionFilterStatus>;
  onChange: (next: Set<DecisionFilterStatus>) => void;
};

export function DecisionLogFilter({ active, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hasFilters = active.size > 0;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function toggle(value: DecisionFilterStatus) {
    const next = new Set(active);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(next);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Filter decisions"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-transparent px-2.5 py-1 text-xs font-medium transition-opacity duration-150 hover:opacity-90",
          "bg-foreground text-background dark:bg-black dark:text-white",
          hasFilters && "ring-2 ring-accent ring-offset-2 ring-offset-background"
        )}
      >
        <ListFilter className="h-3 w-3" aria-hidden />
        filter
        {hasFilters && (
          <span className="font-mono text-[10px] opacity-80">({active.size})</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[9.5rem] rounded-lg border border-border bg-popover py-1 shadow-lg">
          {FILTER_OPTIONS.map(({ value, label }) => {
            const checked = active.has(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => toggle(value)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-popover-foreground hover:bg-secondary"
              >
                <span
                  className={cn(
                    "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border",
                    checked
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border bg-background"
                  )}
                  aria-hidden
                >
                  {checked && (
                    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none">
                      <path
                        d="M2.5 6l2.5 2.5 5-5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                {label}
              </button>
            );
          })}
          {hasFilters && (
            <>
              <div className="my-1 border-t border-border" />
              <button
                type="button"
                onClick={() => onChange(new Set())}
                className="w-full px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                Clear filters
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

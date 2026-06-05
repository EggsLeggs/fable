"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Props = {
  campaignId: string;
  archived: boolean;
  onArchivedChange?: (archived: boolean) => void;
  className?: string;
};

export function CampaignActionsMenu({
  campaignId,
  archived,
  onArchivedChange,
  className,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function setArchived(next: boolean) {
    const label = next ? "archive" : "unarchive";

    setBusy(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? `Failed to ${label} campaign`);
        return;
      }
      onArchivedChange?.(next);
      setOpen(false);
      toast.success(next ? "Campaign archived" : "Campaign unarchived");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      "Delete this campaign permanently? All scenarios and decision history will be removed. This cannot be undone."
    );
    if (!confirmed) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data.error ?? "Failed to delete campaign");
        return;
      }
      setOpen(false);
      router.push("/campaigns");
      router.refresh();
    } catch {
      window.alert("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("relative", className)} ref={ref}>
      <button
        type="button"
        aria-label="Campaign actions"
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[10rem] rounded-lg border border-border bg-popover py-1 shadow-lg">
          <button
            type="button"
            disabled={busy}
            onClick={() => void setArchived(!archived)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-popover-foreground hover:bg-secondary disabled:opacity-50"
          >
            {archived ? (
              <>
                <ArchiveRestore className="h-4 w-4 shrink-0" />
                Unarchive
              </>
            ) : (
              <>
                <Archive className="h-4 w-4 shrink-0" />
                Archive
              </>
            )}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleDelete()}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4 shrink-0" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

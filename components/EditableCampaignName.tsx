"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  campaignId: string;
  advertiser: string;
  value: string;
  onSaved: (name: string) => void;
  onAdvertiserSaved: (advertiser: string) => void;
  className?: string;
  resourceKind?: "campaign" | "template";
  nameLabel?: string;
};

export function EditableCampaignName({
  campaignId,
  advertiser,
  value,
  onSaved,
  onAdvertiserSaved,
  className,
  resourceKind = "campaign",
  nameLabel = "Campaign name",
}: Props) {
  const apiBase =
    resourceKind === "template" ? "/api/templates" : "/api/campaigns";
  const [editingName, setEditingName] = useState(false);
  const [editingAdvertiser, setEditingAdvertiser] = useState(false);
  const [nameDraft, setNameDraft] = useState(value);
  const [advertiserDraft, setAdvertiserDraft] = useState(advertiser);
  const [savingName, setSavingName] = useState(false);
  const [savingAdvertiser, setSavingAdvertiser] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const advertiserInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editingName) setNameDraft(value);
  }, [value, editingName]);

  useEffect(() => {
    if (!editingAdvertiser) setAdvertiserDraft(advertiser);
  }, [advertiser, editingAdvertiser]);

  const startEditingName = useCallback(() => {
    setNameDraft(value);
    setError(null);
    setEditingName(true);
  }, [value]);

  const startEditingAdvertiser = useCallback(() => {
    setAdvertiserDraft(advertiser);
    setError(null);
    setEditingAdvertiser(true);
  }, [advertiser]);

  useEffect(() => {
    if (editingName) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [editingName]);

  useEffect(() => {
    if (editingAdvertiser) {
      advertiserInputRef.current?.focus();
      advertiserInputRef.current?.select();
    }
  }, [editingAdvertiser]);

  const cancelName = useCallback(() => {
    setNameDraft(value);
    setError(null);
    setEditingName(false);
  }, [value]);

  const cancelAdvertiser = useCallback(() => {
    setAdvertiserDraft(advertiser);
    setError(null);
    setEditingAdvertiser(false);
  }, [advertiser]);

  const saveName = useCallback(async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      setError("Name is required");
      setNameDraft(value);
      setEditingName(false);
      return;
    }
    if (trimmed === value) {
      setEditingName(false);
      return;
    }

    setSavingName(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save");
        setNameDraft(value);
        setEditingName(false);
        return;
      }
      onSaved(
        (data.campaign?.name ?? data.template?.name ?? trimmed) as string
      );
      setEditingName(false);
    } catch {
      setError("Failed to save");
      setNameDraft(value);
      setEditingName(false);
    } finally {
      setSavingName(false);
    }
  }, [apiBase, campaignId, nameDraft, onSaved, value]);

  const saveAdvertiser = useCallback(async () => {
    const trimmed = advertiserDraft.trim();
    if (!trimmed) {
      setError("Advertiser is required");
      setAdvertiserDraft(advertiser);
      setEditingAdvertiser(false);
      return;
    }
    if (trimmed === advertiser) {
      setEditingAdvertiser(false);
      return;
    }

    setSavingAdvertiser(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ advertiser: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save");
        setAdvertiserDraft(advertiser);
        setEditingAdvertiser(false);
        return;
      }
      onAdvertiserSaved(
        (data.campaign?.advertiser ?? data.template?.advertiser ?? trimmed) as string
      );
      setEditingAdvertiser(false);
    } catch {
      setError("Failed to save");
      setAdvertiserDraft(advertiser);
      setEditingAdvertiser(false);
    } finally {
      setSavingAdvertiser(false);
    }
  }, [advertiser, advertiserDraft, apiBase, campaignId, onAdvertiserSaved]);

  const separator = (
    <span className="shrink-0 px-1.5 text-muted-foreground" aria-hidden>
      &gt;
    </span>
  );

  const advertiserSegment = editingAdvertiser ? (
    <input
      ref={advertiserInputRef}
      type="text"
      value={advertiserDraft}
      disabled={savingAdvertiser}
      maxLength={200}
      aria-label="Advertiser"
      className="max-w-[12rem] shrink-0 rounded-md border border-border bg-background px-1.5 py-0.5 text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/30 sm:max-w-xs"
      onChange={(e) => setAdvertiserDraft(e.target.value)}
      onBlur={() => void saveAdvertiser()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          advertiserInputRef.current?.blur();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          cancelAdvertiser();
        }
      }}
    />
  ) : (
    <button
      type="button"
      onClick={startEditingAdvertiser}
      disabled={savingAdvertiser}
      title={advertiser}
      className="max-w-[12rem] shrink-0 truncate rounded-md px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 sm:max-w-xs"
    >
      {advertiser}
    </button>
  );

  if (editingName) {
    return (
      <div className="min-w-0 max-w-3xl">
        <div className="flex min-w-0 items-center text-sm">
          {advertiserSegment}
          {separator}
          <input
            ref={nameInputRef}
            type="text"
            value={nameDraft}
            disabled={savingName}
            maxLength={200}
            aria-label={nameLabel}
            className={cn(
              "min-w-0 flex-1 rounded-md border border-border bg-background px-1.5 py-0.5 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
              className
            )}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => void saveName()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                nameInputRef.current?.blur();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                cancelName();
              }
            }}
          />
        </div>
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-3xl">
      <div className="flex min-w-0 items-center text-sm">
        {advertiserSegment}
        {separator}
        <button
          type="button"
          onClick={startEditingName}
          disabled={savingName}
          title={value}
          className={cn(
            "min-w-0 truncate rounded-md px-1.5 py-0.5 font-semibold transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
            className
          )}
        >
          {value}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

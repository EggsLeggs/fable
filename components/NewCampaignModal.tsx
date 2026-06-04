"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import type { DbTemplate } from "@/lib/db/schema";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
};

type CreateMode = "blank" | "template";

export function NewCampaignModal({ open, onClose, onCreated }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<CreateMode>("blank");
  const [templates, setTemplates] = useState<DbTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [name, setName] = useState("");
  const [advertiser, setAdvertiser] = useState("");
  const [goal, setGoal] = useState("");
  const [maxCPM, setMaxCPM] = useState("8");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTemplatesLoading(true);
    fetch("/api/templates")
      .then((res) => res.json())
      .then((data) => {
        const list: DbTemplate[] = data.templates ?? [];
        setTemplates(list);
        if (list.length > 0) {
          setTemplateId(list[0].id);
        }
      })
      .finally(() => setTemplatesLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open || mode !== "template" || !templateId) return;
    const selected = templates.find((t) => t.id === templateId);
    if (!selected) return;
    setName(selected.name);
    setAdvertiser(selected.advertiser);
    setGoal(selected.goal);
    setMaxCPM(String(selected.maxCPM));
  }, [open, mode, templateId, templates]);

  function resetForm() {
    setMode("blank");
    setTemplateId("");
    setName("");
    setAdvertiser("");
    setGoal("");
    setMaxCPM("8");
    setError(null);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const body: Record<string, unknown> = {
      name,
      advertiser,
      goal,
      maxCPM: parseFloat(maxCPM) || 8,
    };
    if (mode === "template" && templateId) {
      body.templateId = templateId;
    }

    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to create campaign");
      return;
    }

    resetForm();
    onCreated?.();
    onClose();
    router.push(`/campaigns/${data.campaign.id}`);
  }

  function handleTemplateChange(id: string) {
    setTemplateId(id);
    const selected = templates.find((t) => t.id === id);
    if (selected) {
      setName(selected.name);
      setAdvertiser(selected.advertiser);
      setGoal(selected.goal);
      setMaxCPM(String(selected.maxCPM));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={handleClose}
        aria-label="Close"
      />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-6 text-card-foreground shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">New campaign</h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded p-1 text-muted-foreground hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 flex gap-2 rounded-lg border border-border p-1">
          <button
            type="button"
            onClick={() => setMode("blank")}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === "blank"
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Blank
          </button>
          <button
            type="button"
            onClick={() => setMode("template")}
            disabled={templatesLoading || templates.length === 0}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${
              mode === "template"
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            From template
          </button>
        </div>

        {mode === "template" && (
          <div className="mb-3">
            {templates.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No templates yet.{" "}
                <a href="/templates" className="text-accent underline-offset-2 hover:underline">
                  Create one
                </a>{" "}
                to reuse configs.
              </p>
            ) : (
              <>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Template
                </label>
                <select
                  value={templateId}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  className="input"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.advertiser})
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Scenarios and settings copy from the template. You can override fields below.
                </p>
              </>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Campaign name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="input"
              placeholder="Nike UK — Running Q3"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Advertiser
            </label>
            <input
              value={advertiser}
              onChange={(e) => setAdvertiser(e.target.value)}
              required
              className="input"
              placeholder="Nike"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Goal</label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={2}
              className="input resize-none"
              placeholder="Campaign objective…"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Max CPM ($)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={maxCPM}
              onChange={(e) => setMaxCPM(e.target.value)}
              className="input"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={handleClose} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (mode === "template" && !templateId)}
              className="btn-primary"
            >
              {loading ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

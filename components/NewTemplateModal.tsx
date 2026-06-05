"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
};

export function NewTemplateModal({ open, onClose, onCreated }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [advertiser, setAdvertiser] = useState("");
  const [goal, setGoal] = useState("");
  const [maxCPM, setMaxCPM] = useState("8");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        advertiser,
        goal,
        maxCPM: parseFloat(maxCPM) || 8,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to create template");
      return;
    }

    setName("");
    setAdvertiser("");
    setGoal("");
    setMaxCPM("8");
    onCreated?.();
    onClose();
    router.push(`/templates/${data.template.id}`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-6 text-card-foreground shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">New template</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Template name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="input"
              placeholder="Nike UK — Brand safety baseline"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Default advertiser
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
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Default goal
            </label>
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
              Default max CPM ($)
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
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

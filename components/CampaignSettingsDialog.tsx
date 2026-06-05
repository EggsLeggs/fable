"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Sparkles, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { Campaign } from "@/lib/store";

export type CampaignSettings = Pick<Campaign, "goal" | "maxCPM" | "blockedTopics">;

type Props = {
  campaignId: string;
  settings: CampaignSettings;
  campaignName?: string;
  advertiser?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (settings: CampaignSettings) => void;
  resourceKind?: "campaign" | "template";
};

function normalizeTopic(value: string) {
  return value.trim().toLowerCase();
}

function parseManualInput(value: string): string[] {
  return value
    .split(/[,;\n]+/)
    .map(normalizeTopic)
    .filter(Boolean);
}

export function CampaignSettingsDialog({
  campaignId,
  settings,
  campaignName,
  advertiser,
  open,
  onOpenChange,
  onSaved,
  resourceKind = "campaign",
}: Props) {
  const apiBase =
    resourceKind === "template" ? "/api/templates" : "/api/campaigns";
  const [goal, setGoal] = useState(settings.goal);
  const [maxCPM, setMaxCPM] = useState(String(settings.maxCPM));
  const [selected, setSelected] = useState<string[]>(settings.blockedTopics);
  const [manualInput, setManualInput] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiGeneratedKeys, setAiGeneratedKeys] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"manual" | "ai">("manual");

  useEffect(() => {
    if (open) {
      setGoal(settings.goal);
      setMaxCPM(String(settings.maxCPM));
      setSelected(settings.blockedTopics);
      setManualInput("");
      setAiPrompt("");
      setAiSuggestions([]);
      setAiGeneratedKeys(new Set());
      setError(null);
      setTab("manual");
    }
  }, [open, settings]);

  const addTopics = useCallback((incoming: string[], fromAi = false) => {
    setSelected((prev) => {
      const seen = new Set(prev.map(normalizeTopic));
      const next = [...prev];
      for (const raw of incoming) {
        const t = normalizeTopic(raw);
        if (!t || seen.has(t)) continue;
        seen.add(t);
        next.push(t);
      }
      return next;
    });
    if (fromAi) {
      setAiGeneratedKeys((prev) => {
        const next = new Set(prev);
        for (const raw of incoming) {
          const t = normalizeTopic(raw);
          if (t) next.add(t);
        }
        return next;
      });
    }
  }, []);

  function removeTopic(topic: string) {
    const key = normalizeTopic(topic);
    setSelected((prev) => prev.filter((t) => normalizeTopic(t) !== key));
    setAiGeneratedKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  function handleManualAdd() {
    const parsed = parseManualInput(manualInput);
    if (parsed.length === 0) return;
    addTopics(parsed, false);
    setManualInput("");
  }

  async function handleGenerate() {
    if (!aiPrompt.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/${campaignId}/topics/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Generation failed");
        return;
      }
      setAiSuggestions(data.topics ?? []);
      setTab("ai");
    } catch {
      setError("Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  function addSuggestion(topic: string) {
    addTopics([topic], true);
    setAiSuggestions((prev) =>
      prev.filter((t) => normalizeTopic(t) !== normalizeTopic(topic))
    );
  }

  function addAllSuggestions() {
    addTopics(aiSuggestions, true);
    setAiSuggestions([]);
  }

  async function handleSave() {
    const parsedMax = parseFloat(maxCPM);
    if (!Number.isFinite(parsedMax) || parsedMax <= 0) {
      setError("Max CPM must be a positive number");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: goal.trim(),
          maxCPM: parsedMax,
          blockedTopics: selected,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save");
        return;
      }
      const saved: CampaignSettings = {
        goal: data.agentCampaign?.goal ?? goal.trim(),
        maxCPM: data.agentCampaign?.maxCPM ?? parsedMax,
        blockedTopics: data.agentCampaign?.blockedTopics ?? selected,
      };
      onSaved(saved);
      onOpenChange(false);
    } catch {
      setError("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const defaultAiPrompt =
    campaignName && advertiser
      ? `Suggest blocked topics for ${advertiser}'s "${campaignName}" campaign — controversies, sensitive news, and contexts where ads should not appear.`
      : "Suggest brand-safety topics to block for this campaign.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit campaign</DialogTitle>
          <DialogDescription>
            Update description, bid cap, and blocked topics for the agent.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="campaign-goal">Description</Label>
              <Textarea
                id="campaign-goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Campaign objective and context for the agent…"
                className="resize-none text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaign-max-cpm">Max CPM ($)</Label>
              <Input
                id="campaign-max-cpm"
                type="number"
                step="0.01"
                min="0.01"
                value={maxCPM}
                onChange={(e) => setMaxCPM(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </div>

          <Separator />

          <div>
            <Label className="mb-2 block">Blocked topics ({selected.length})</Label>
            {selected.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                No topics yet — add some below
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {selected.map((topic) => {
                  const isAi = aiGeneratedKeys.has(normalizeTopic(topic));
                  return (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => removeTopic(topic)}
                      className={cn(
                        "group inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-xs transition-colors",
                        isAi
                          ? "border-accent/50 bg-accent/15 text-accent hover:bg-accent/25"
                          : "border-red-500/30 bg-red-500/10 text-red-500 hover:bg-red-500/20"
                      )}
                      title="Click to remove"
                    >
                      {isAi && (
                        <Sparkles className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
                      )}
                      {topic}
                      <X className="h-3 w-3 opacity-50 group-hover:opacity-100" aria-hidden />
                    </button>
                  );
                })}
              </div>
            )}
            {aiGeneratedKeys.size > 0 && (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Sparkles className="h-3 w-3 text-accent" aria-hidden />
                <span>
                  <span className="text-accent">Teal chips</span> were added via AI this session
                </span>
              </p>
            )}
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as "manual" | "ai")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="manual">Add manually</TabsTrigger>
              <TabsTrigger value="ai" className="gap-1.5">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Generate with AI
              </TabsTrigger>
            </TabsList>

            <TabsContent value="manual" className="space-y-2">
              <Label htmlFor="topic-input">Type topics</Label>
              <div className="flex gap-2">
                <Input
                  id="topic-input"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleManualAdd();
                    }
                  }}
                  placeholder="controversy, protest, lawsuit…"
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  onClick={handleManualAdd}
                  aria-label="Add topics"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Press Enter or + to add. Separate multiple with commas.
              </p>
            </TabsContent>

            <TabsContent value="ai" className="space-y-3">
              <div className="rounded-lg border border-accent/25 bg-accent/5 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Badge variant="ai" className="font-normal">
                    <Sparkles className="h-3 w-3" aria-hidden />
                    AI suggestions
                  </Badge>
                </div>
                <Label htmlFor="ai-prompt" className="sr-only">
                  Prompt for AI
                </Label>
                <Textarea
                  id="ai-prompt"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder={defaultAiPrompt}
                  rows={3}
                  className="resize-none border-accent/20 bg-background text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full border-accent/30 text-accent hover:bg-accent/10"
                  onClick={handleGenerate}
                  disabled={generating || !aiPrompt.trim()}
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate topics
                    </>
                  )}
                </Button>
              </div>

              {aiSuggestions.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Suggested — click to add
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-accent"
                      onClick={addAllSuggestions}
                    >
                      Add all
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {aiSuggestions.map((topic) => (
                      <button
                        key={topic}
                        type="button"
                        onClick={() => addSuggestion(topic)}
                        className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 font-mono text-xs text-accent transition-colors hover:bg-accent/20"
                      >
                        <Sparkles className="h-3 w-3 opacity-70" aria-hidden />
                        {topic}
                        <Plus className="h-3 w-3 opacity-60" aria-hidden />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type EditTriggerProps = {
  onClick: () => void;
};

export function EditCampaignTrigger({ onClick }: EditTriggerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-2 rounded-md border border-dashed border-border px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-secondary hover:text-foreground"
    >
      <span>Edit campaign</span>
      <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
    </button>
  );
}

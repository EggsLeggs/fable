"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Sparkles, X } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  SCENARIO_CATEGORIES,
  scenarioCategoryConfig,
  type ScenarioCategory,
} from "@/lib/scenario-categories";
import type { CampaignScenario } from "@/lib/scenarios-db";
import type { Message } from "@/lib/store";

type ScenarioLike = Pick<
  CampaignScenario,
  "id" | "label" | "category" | "messages"
>;

type Props = {
  campaignId: string;
  campaignName?: string;
  advertiser?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: ScenarioLike | null;
  onSaved: () => void;
  resourceKind?: "campaign" | "template";
};

const emptyMessages: Message[] = [
  { role: "user", content: "" },
  { role: "assistant", content: "" },
];

export function ScenarioManagerDialog({
  campaignId,
  campaignName,
  advertiser,
  open,
  onOpenChange,
  editing,
  onSaved,
  resourceKind = "campaign",
}: Props) {
  const apiBase =
    resourceKind === "template" ? "/api/templates" : "/api/campaigns";
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<ScenarioCategory>("success");
  const [messages, setMessages] = useState<Message[]>(emptyMessages);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiCount, setAiCount] = useState("3");
  const [tab, setTab] = useState<"manual" | "ai">("manual");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = Boolean(editing);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setLabel(editing.label);
      setCategory(editing.category);
      setMessages(editing.messages.length > 0 ? editing.messages : emptyMessages);
      setTab("manual");
    } else {
      setLabel("");
      setCategory("success");
      setMessages([...emptyMessages]);
      setTab("manual");
    }
    setAiPrompt("");
    setAiCount("3");
    setError(null);
  }, [open, editing]);

  const updateMessage = useCallback((index: number, content: string) => {
    setMessages((prev) =>
      prev.map((m, i) => (i === index ? { ...m, content } : m))
    );
  }, []);

  function addMessage() {
    setMessages((prev) => {
      const nextRole = prev.length % 2 === 0 ? "assistant" : "user";
      return [...prev, { role: nextRole, content: "" }];
    });
  }

  function removeMessage(index: number) {
    setMessages((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function handleSaveManual() {
    const trimmedLabel = label.trim();
    const validMessages = messages
      .map((m) => ({ ...m, content: m.content.trim() }))
      .filter((m) => m.content.length > 0);
    if (!trimmedLabel) {
      setError("Label is required");
      return;
    }
    if (validMessages.length === 0) {
      setError("Add at least one message");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const url = isEdit
        ? `${apiBase}/${campaignId}/scenarios/${editing!.id}`
        : `${apiBase}/${campaignId}/scenarios`;
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: trimmedLabel,
          category,
          messages: validMessages,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save");
        return;
      }
      onSaved();
      onOpenChange(false);
    } catch {
      setError("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerate() {
    if (!aiPrompt.trim()) return;
    const count = Math.min(8, Math.max(1, parseInt(aiCount, 10) || 1));
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/${campaignId}/scenarios/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt.trim(), count }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Generation failed");
        return;
      }
      onSaved();
      onOpenChange(false);
    } catch {
      setError("Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  const defaultAiPrompt =
    campaignName && advertiser
      ? `Create diverse test conversations for ${advertiser}'s "${campaignName}" — mix high intent, brand safety risks, and blocked topics.`
      : "Create realistic chat scenarios to test the ad agent.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit scenario" : "Add scenario"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the label, category, or conversation turns."
              : "Add manually or generate one or more scenarios with AI."}
          </DialogDescription>
        </DialogHeader>

        {isEdit ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="scenario-label">Label</Label>
              <Input
                id="scenario-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="text-xs"
              />
            </div>
            <CategoryPicker category={category} onChange={setCategory} />
            <MessageEditor
              messages={messages}
              onUpdate={updateMessage}
              onAdd={addMessage}
              onRemove={removeMessage}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSaveManual} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as "manual" | "ai")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="manual">Manual</TabsTrigger>
              <TabsTrigger value="ai" className="gap-1.5">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Generate with AI
              </TabsTrigger>
            </TabsList>

            <TabsContent value="manual" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="scenario-label-new">Label</Label>
                <Input
                  id="scenario-label-new"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="High intent — marathon training"
                  className="text-xs"
                />
              </div>
              <CategoryPicker category={category} onChange={setCategory} />
              <MessageEditor
                messages={messages}
                onUpdate={updateMessage}
                onAdd={addMessage}
                onRemove={removeMessage}
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleSaveManual} disabled={saving}>
                  {saving ? "Adding…" : "Add scenario"}
                </Button>
              </DialogFooter>
            </TabsContent>

            <TabsContent value="ai" className="space-y-4">
              <div className="rounded-lg border border-accent/25 bg-accent/5 p-3">
                <Label htmlFor="scenario-ai-prompt" className="mb-2 block text-xs">
                  Describe the scenarios you want
                </Label>
                <Textarea
                  id="scenario-ai-prompt"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder={defaultAiPrompt}
                  rows={4}
                  className="resize-none border-accent/20 bg-background text-xs"
                />
                <div className="mt-3 flex items-center gap-2">
                  <Label htmlFor="scenario-count" className="shrink-0 text-xs text-muted-foreground">
                    Count
                  </Label>
                  <Input
                    id="scenario-count"
                    type="number"
                    min={1}
                    max={8}
                    value={aiCount}
                    onChange={(e) => setAiCount(e.target.value)}
                    className="h-8 w-16 font-mono text-xs"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full border-accent/30 text-accent hover:bg-accent/10"
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
                      Generate scenario{parseInt(aiCount, 10) !== 1 ? "s" : ""}
                    </>
                  )}
                </Button>
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CategoryPicker({
  category,
  onChange,
}: {
  category: ScenarioCategory;
  onChange: (c: ScenarioCategory) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>Category</Label>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {SCENARIO_CATEGORIES.map((cat) => {
          const { label, icon: Icon, className } = scenarioCategoryConfig[cat];
          const selected = category === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onChange(cat)}
              className={cn(
                "flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors",
                selected
                  ? "border-foreground/40 bg-secondary"
                  : "border-border hover:bg-secondary/60"
              )}
            >
              <Icon className={cn("h-3.5 w-3.5 shrink-0", className)} aria-hidden />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MessageEditor({
  messages,
  onUpdate,
  onAdd,
  onRemove,
}: {
  messages: Message[];
  onUpdate: (index: number, content: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Conversation</Label>
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5" />
          Add turn
        </Button>
      </div>
      <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
        {messages.map((m, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase text-muted-foreground">
                {m.role}
              </span>
              {messages.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Remove message"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <Textarea
              value={m.content}
              onChange={(e) => onUpdate(i, e.target.value)}
              rows={2}
              className="resize-none text-xs"
              placeholder={m.role === "user" ? "User message…" : "Assistant reply…"}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

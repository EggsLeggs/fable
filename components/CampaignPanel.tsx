"use client";

import { useCallback, useEffect, useState } from "react";
import { Campaign } from "@/lib/store";
import {
  CampaignSettingsDialog,
  type CampaignSettings,
} from "@/components/CampaignSettingsDialog";
import { ScenarioManagerDialog } from "@/components/ScenarioManagerDialog";
import { Separator } from "@/components/ui/separator";
import { scenarioCategoryConfig } from "@/lib/scenario-categories";
import type { CampaignScenario } from "@/lib/scenarios-db";
import {
  ExternalLink,
  Pencil,
  Play,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";

const iconSm = "h-3.5 w-3.5 shrink-0";

type Stats = {
  total: number;
  bids: number;
  skips: number;
  flagged: number;
  vetoed: number;
  humanReviewed: number;
};

type Props = {
  campaignId: string;
  campaign: Campaign;
  stats: Stats;
  running: boolean;
  onRunScenario: (scenarioId: string) => void;
  onRunAll: (scenarioIds: string[]) => void;
  onCampaignSaved?: (settings: CampaignSettings) => void;
};

const sectionLabelClass =
  "text-[11px] font-medium uppercase tracking-wider text-muted-foreground";

function SectionHeader({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex min-w-0 items-center justify-between gap-2">
      <h2 className={`min-w-0 truncate ${sectionLabelClass}`}>{children}</h2>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CampaignPanel({
  campaignId,
  campaign,
  stats,
  running,
  onRunScenario,
  onRunAll,
  onCampaignSaved,
}: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scenarioDialogOpen, setScenarioDialogOpen] = useState(false);
  const [editingScenario, setEditingScenario] = useState<CampaignScenario | null>(null);
  const [scenarios, setScenarios] = useState<CampaignScenario[]>([]);
  const [scenariosLoading, setScenariosLoading] = useState(true);
  const [goal, setGoal] = useState(campaign.goal);
  const [maxCPM, setMaxCPM] = useState(campaign.maxCPM);
  const [blockedTopics, setBlockedTopics] = useState(campaign.blockedTopics);

  const fetchScenarios = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/scenarios`);
      if (res.ok) {
        const data = await res.json();
        setScenarios(data.scenarios ?? []);
      }
    } finally {
      setScenariosLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchScenarios();
  }, [fetchScenarios]);

  useEffect(() => {
    setGoal(campaign.goal);
    setMaxCPM(campaign.maxCPM);
    setBlockedTopics(campaign.blockedTopics);
  }, [campaign.goal, campaign.maxCPM, campaign.blockedTopics]);

  async function handleDeleteScenario(scenarioId: string) {
    const res = await fetch(
      `/api/campaigns/${campaignId}/scenarios/${scenarioId}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setScenarios((prev) => prev.filter((s) => s.id !== scenarioId));
    }
  }

  function openAddScenario() {
    setEditingScenario(null);
    setScenarioDialogOpen(true);
  }

  function openEditScenario(scenario: CampaignScenario) {
    setEditingScenario(scenario);
    setScenarioDialogOpen(true);
  }

  const statItems = [
    { label: "Total", value: stats.total, color: "text-foreground" },
    { label: "Bids", value: stats.bids, color: "text-emerald-500" },
    { label: "Skips", value: stats.skips, color: "text-muted-foreground" },
    { label: "Flagged", value: stats.flagged, color: "text-red-500" },
    { label: "Vetoed", value: stats.vetoed, color: "text-orange-500" },
    { label: "Reviewed", value: stats.humanReviewed, color: "text-indigo-500" },
  ];

  const ghostActionClass =
    "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40";

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden">
      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
      <section className="min-w-0 pb-5">
        <SectionHeader
          action={
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Settings2 className={iconSm} aria-hidden />
              Edit
            </button>
          }
        >
          Campaign
        </SectionHeader>

        <p className="break-words text-sm leading-relaxed text-foreground/90">
          {goal || <span className="italic text-muted-foreground">No description</span>}
        </p>

        <dl className="mt-4 space-y-2 text-xs">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground">Max CPM</dt>
            <dd className="font-medium tabular-nums text-foreground">
              ${maxCPM.toFixed(2)}
            </dd>
          </div>
        </dl>

        <div className="mt-4">
          <p className="mb-2 text-xs text-muted-foreground">Blocked topics</p>
          {blockedTopics.length === 0 ? (
            <p className="text-xs text-muted-foreground/80">None configured</p>
          ) : (
            <ul className="flex min-w-0 flex-wrap gap-1.5" role="list">
              {blockedTopics.map((t) => (
                <li key={t} className="max-w-full min-w-0">
                  <span className="inline-block max-w-full break-all rounded-md bg-red-500/10 px-2 py-0.5 font-mono text-[11px] text-red-500">
                    {t}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <CampaignSettingsDialog
          campaignId={campaignId}
          settings={{ goal, maxCPM, blockedTopics }}
          campaignName={campaign.name}
          advertiser={campaign.advertiser}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          onSaved={(saved) => {
            setGoal(saved.goal);
            setMaxCPM(saved.maxCPM);
            setBlockedTopics(saved.blockedTopics);
            onCampaignSaved?.(saved);
          }}
        />
      </section>

      <Separator />

      <section className="min-w-0 shrink-0 py-5">
        <SectionHeader>Session</SectionHeader>
        <dl className="grid min-w-0 grid-cols-3 gap-x-1 gap-y-3">
          {statItems.map(({ label, value, color }) => (
            <div key={label} className="min-w-0">
              <dd className={`font-mono text-base font-medium tabular-nums leading-none ${color}`}>
                {value}
              </dd>
              <dt className="mt-1 truncate text-[10px] text-muted-foreground">{label}</dt>
            </div>
          ))}
        </dl>
      </section>

      <Separator />

      <section className="min-w-0 py-5">
        <SectionHeader
          action={
            <button
              type="button"
              onClick={openAddScenario}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Plus className={iconSm} aria-hidden />
              Add
            </button>
          }
        >
          Scenarios
        </SectionHeader>

        {scenariosLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : scenarios.length === 0 ? (
          <p className="text-xs text-muted-foreground">No scenarios yet.</p>
        ) : (
          <ul className="min-w-0 space-y-0.5" role="list">
            {scenarios.map((s) => {
              const { icon: Icon, className } = scenarioCategoryConfig[s.category];
              return (
                <li key={s.id} className="group relative min-w-0 rounded-md">
                  <button
                    type="button"
                    onClick={() => onRunScenario(s.id)}
                    disabled={running}
                    title={s.label}
                    className="flex w-full min-w-0 items-center gap-2 rounded-md py-2 pl-2 pr-16 text-left text-xs transition-colors hover:bg-secondary disabled:opacity-40"
                  >
                    <Icon className={`${iconSm} ${className}`} aria-hidden />
                    <span className="min-w-0 truncate font-medium text-foreground">{s.label}</span>
                  </button>
                  <div
                    className="absolute inset-y-0 right-0 flex items-center rounded-r-md bg-gradient-to-l from-background from-40% to-transparent pl-6 pr-0.5 opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
                    role="group"
                    aria-label={`Actions for ${s.label}`}
                  >
                    <button
                      type="button"
                      onClick={() => openEditScenario(s)}
                      className={ghostActionClass}
                      aria-label={`Edit ${s.label}`}
                    >
                      <Pencil className={iconSm} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteScenario(s.id)}
                      disabled={running}
                      className={`${ghostActionClass} hover:bg-destructive/10 hover:text-destructive`}
                      aria-label={`Remove ${s.label}`}
                    >
                      <Trash2 className={iconSm} aria-hidden />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <button
          type="button"
          onClick={() => onRunAll(scenarios.map((s) => s.id))}
          disabled={running || scenarios.length === 0}
          className="btn-primary mt-4 flex w-full max-w-full shrink-0 items-center justify-center gap-2 disabled:opacity-40"
        >
          <Play className={iconSm} aria-hidden />
          <span className="truncate">{running ? "Running…" : "Run all"}</span>
        </button>
      </section>
      </div>

      <ScenarioManagerDialog
        campaignId={campaignId}
        campaignName={campaign.name}
        advertiser={campaign.advertiser}
        open={scenarioDialogOpen}
        onOpenChange={setScenarioDialogOpen}
        editing={editingScenario}
        onSaved={fetchScenarios}
      />

      <div className="mt-auto min-w-0 shrink-0 border-t border-border pt-4">
        <a
          href="https://console.overmindlab.ai/agents"
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <span className="min-w-0 truncate">View Overmind traces</span>
          <ExternalLink className={`${iconSm} shrink-0`} aria-hidden />
        </a>
      </div>
    </div>
  );
}

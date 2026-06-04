"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Decision, Campaign } from "@/lib/store";
import { DecisionFeed } from "@/components/DecisionFeed";
import {
  DecisionFilterStatus,
  DecisionLogFilter,
  filterDecisions,
} from "@/components/DecisionLogFilter";
import { CampaignPanel } from "@/components/CampaignPanel";
import { EditableCampaignName } from "@/components/EditableCampaignName";
import { CampaignActionsMenu } from "@/components/CampaignActionsMenu";
import { Badge } from "@/components/ui/badge";
import { PatternedBackground } from "@/components/PatternedBackground";

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
};

export function CampaignConsole({ campaignId }: Props) {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [decisionsLoading, setDecisionsLoading] = useState(true);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    bids: 0,
    skips: 0,
    flagged: 0,
    vetoed: 0,
    humanReviewed: 0,
  });
  const [running, setRunning] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [archived, setArchived] = useState(false);
  const [decisionFilters, setDecisionFilters] = useState<Set<DecisionFilterStatus>>(
    () => new Set()
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const filteredDecisions = filterDecisions(decisions, decisionFilters);
  const filtersActive = decisionFilters.size > 0;

  const fetchCampaignMeta = useCallback(async () => {
    const res = await fetch(`/api/campaigns/${campaignId}`);
    if (!res.ok) return;
    const data = await res.json();
    setArchived(Boolean(data.campaign?.archived));
  }, [campaignId]);

  const fetchDecisions = useCallback(async () => {
    const res = await fetch(`/api/decisions?campaignId=${encodeURIComponent(campaignId)}`);
    if (res.status === 404) {
      setNotFound(true);
      setDecisionsLoading(false);
      return;
    }
    const data = await res.json();
    setDecisions(data.decisions);
    setCampaign(data.campaign);
    setStats(data.stats);
    setNotFound(false);
    setDecisionsLoading(false);
  }, [campaignId]);

  useEffect(() => {
    void fetchCampaignMeta();
  }, [fetchCampaignMeta]);

  useEffect(() => {
    setDecisionsLoading(true);
    fetchDecisions();
    intervalRef.current = setInterval(fetchDecisions, 2000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchDecisions]);

  async function runScenario(scenarioId: string) {
    setRunning(true);
    await fetch("/api/run-agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, scenarioId }),
    });
    setTimeout(() => setRunning(false), 3500);
  }

  async function clearHistory() {
    await fetch(`/api/decisions?campaignId=${encodeURIComponent(campaignId)}`, {
      method: "DELETE",
    });
    await fetchDecisions();
  }

  async function runAll(scenarioIds: string[]) {
    setRunning(true);
    for (const scenarioId of scenarioIds) {
      await fetch("/api/run-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, scenarioId }),
      });
      await new Promise((r) => setTimeout(r, 1000));
    }
    setTimeout(() => setRunning(false), 4000);
  }

  if (notFound) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <p className="mb-4 text-sm text-muted-foreground">Campaign not found</p>
        <Link href="/campaigns" className="btn-primary">
          Back to campaigns
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 text-foreground">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-6 py-3">
          <div className="min-w-0 flex-1">
            {campaign && (
              <EditableCampaignName
                campaignId={campaignId}
                advertiser={campaign.advertiser}
                value={campaign.name}
                onSaved={(name) => setCampaign((c) => (c ? { ...c, name } : c))}
                onAdvertiserSaved={(advertiser) =>
                  setCampaign((c) => (c ? { ...c, advertiser } : c))
                }
              />
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {archived && (
              <Badge variant="secondary" className="font-normal">
                Archived
              </Badge>
            )}
            {running && (
              <span className="text-xs text-muted-foreground">Agent running…</span>
            )}
            <CampaignActionsMenu
              campaignId={campaignId}
              archived={archived}
              onArchivedChange={setArchived}
            />
          </div>
        </header>

        <main className="relative min-h-0 flex-1 overflow-y-auto">
          <PatternedBackground />
          <div className="relative z-10 bg-background px-6 py-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">
                Decision log
                {decisions.length > 0 && (
                  <span className="ml-2 font-normal text-muted-foreground">
                    {filtersActive
                      ? `(${filteredDecisions.length} of ${decisions.length})`
                      : `(${decisions.length})`}
                  </span>
                )}
              </span>
              {decisions.length > 0 && (
                <div className="flex items-center gap-2">
                  <DecisionLogFilter
                    active={decisionFilters}
                    onChange={setDecisionFilters}
                  />
                  <button
                    type="button"
                    onClick={clearHistory}
                    className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground transition-colors duration-150 hover:bg-secondary"
                  >
                    clear
                  </button>
                </div>
              )}
            </div>
            <DecisionFeed
              decisions={filteredDecisions}
              campaignId={campaignId}
              onAction={fetchDecisions}
              loading={decisionsLoading}
              emptyMessage={
                filtersActive
                  ? "No decisions match these filters"
                  : undefined
              }
            />
          </div>
        </main>
      </div>

      <aside className="flex w-80 min-h-0 max-w-80 shrink-0 flex-col overflow-x-hidden overflow-y-hidden border-l border-border px-5 py-5">
        {campaign && (
          <CampaignPanel
            campaignId={campaignId}
            campaign={campaign}
            stats={stats}
            running={running}
            onRunScenario={runScenario}
            onRunAll={runAll}
            onCampaignSaved={(saved) =>
              setCampaign((c) => (c ? { ...c, ...saved } : c))
            }
          />
        )}
      </aside>
    </div>
  );
}

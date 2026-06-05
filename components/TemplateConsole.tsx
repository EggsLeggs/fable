"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Campaign } from "@/lib/store";
import { EditableCampaignName } from "@/components/EditableCampaignName";
import { TemplateActionsMenu } from "@/components/TemplateActionsMenu";
import { TemplatePanel } from "@/components/TemplatePanel";
import { PatternedBackground } from "@/components/PatternedBackground";
import { scenarioCategoryConfig } from "@/lib/scenario-categories";
import type { TemplateScenario } from "@/lib/template-scenarios-db";

type Props = {
  templateId: string;
};

export function TemplateConsole({ templateId }: Props) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [scenarios, setScenarios] = useState<TemplateScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const fetchTemplate = useCallback(async () => {
    const res = await fetch(`/api/templates/${templateId}`);
    if (res.status === 404) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    if (!res.ok) return;
    const data = await res.json();
    setCampaign(data.agentCampaign ?? null);
    setNotFound(false);
    setLoading(false);
  }, [templateId]);

  const fetchScenarios = useCallback(async () => {
    const res = await fetch(`/api/templates/${templateId}/scenarios`);
    if (res.ok) {
      const data = await res.json();
      setScenarios(data.scenarios ?? []);
    }
  }, [templateId]);

  useEffect(() => {
    void fetchTemplate();
    void fetchScenarios();
  }, [fetchTemplate, fetchScenarios]);

  if (notFound) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <p className="mb-4 text-sm text-muted-foreground">Template not found</p>
        <Link href="/templates" className="btn-primary">
          Back to templates
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
                campaignId={templateId}
                advertiser={campaign.advertiser}
                value={campaign.name}
                resourceKind="template"
                nameLabel="Template name"
                onSaved={(name) => setCampaign((c) => (c ? { ...c, name } : c))}
                onAdvertiserSaved={(advertiser) =>
                  setCampaign((c) => (c ? { ...c, advertiser } : c))
                }
              />
            )}
          </div>
          <TemplateActionsMenu templateId={templateId} />
        </header>

        <main className="relative min-h-0 flex-1 overflow-y-auto">
          <PatternedBackground />
          <div className="relative z-10 px-6 py-6">
            <div className="mb-6 max-w-2xl">
              <h2 className="text-sm font-medium text-foreground">Reusable template</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Configure campaign defaults and test scenarios here. When you create a new
                campaign, you can start from this template and override the name, advertiser,
                and other fields as needed.
              </p>
            </div>

            {loading ? (
              <p className="text-xs text-muted-foreground">Loading scenarios…</p>
            ) : scenarios.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No scenarios yet. Add scenarios in the panel on the right.
              </p>
            ) : (
              <div>
                <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Scenarios ({scenarios.length})
                </h3>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {scenarios.map((s) => {
                    const { icon: Icon, className } = scenarioCategoryConfig[s.category];
                    return (
                      <li
                        key={s.id}
                        className="rounded-lg border border-border bg-card/80 p-4 backdrop-blur-sm"
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <Icon className={`h-3.5 w-3.5 ${className}`} aria-hidden />
                          <span className="text-sm font-medium">{s.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {s.messages.length} message{s.messages.length !== 1 ? "s" : ""}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </main>
      </div>

      <aside className="flex w-80 min-h-0 max-w-80 shrink-0 flex-col overflow-x-hidden overflow-y-hidden border-l border-border px-5 py-5">
        {campaign && (
          <TemplatePanel
            templateId={templateId}
            campaign={campaign}
            onCampaignSaved={(saved) =>
              setCampaign((c) => (c ? { ...c, ...saved } : c))
            }
          />
        )}
      </aside>
    </div>
  );
}

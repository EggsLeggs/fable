"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import type { DbCampaign } from "@/lib/db/schema";
import { NewCampaignModal } from "@/components/NewCampaignModal";
import { PatternedBackground } from "@/components/PatternedBackground";

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<DbCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [tab, setTab] = useState<"active" | "archived">("active");

  const load = useCallback(async () => {
    const res = await fetch("/api/campaigns");
    const data = await res.json();
    setCampaigns(data.campaigns ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible =
    tab === "active"
      ? campaigns.filter((c) => !c.archived)
      : campaigns.filter((c) => c.archived);

  return (
    <div className="flex w-full flex-1 flex-col">
      <header className="mb-6 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Campaigns</h1>
        <div className="flex gap-2">
          <button type="button" onClick={() => setModalOpen(true)} className="btn-primary">
            + New
          </button>
        </div>
      </header>

      <div className="mb-6 flex w-full gap-6">
        {(["active", "archived"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`border-0 bg-transparent p-0 text-sm capitalize shadow-none transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/30 ${
              tab === t
                ? "font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="aspect-[16/9] animate-pulse rounded-lg border border-border bg-muted/40"
              aria-hidden
            />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
          <p className="mb-4 text-sm text-muted-foreground">
            {tab === "active" ? "No active campaigns yet." : "No archived campaigns."}
          </p>
          {tab === "active" && (
            <button type="button" onClick={() => setModalOpen(true)} className="btn-primary">
              Create your first campaign
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      )}

      <NewCampaignModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={load}
      />
    </div>
  );
}

function CampaignCard({ campaign }: { campaign: DbCampaign }) {
  return (
    <Link
      href={`/campaigns/${campaign.id}`}
      className="group relative flex aspect-[16/9] flex-col items-center justify-center overflow-hidden rounded-lg border border-border bg-card p-4 text-card-foreground transition-colors hover:bg-muted dark:hover:bg-[hsl(var(--background))]"
    >
      <PatternedBackground />
      {campaign.starred && (
        <Star className="absolute right-3 top-3 z-10 h-4 w-4 fill-foreground text-foreground" />
      )}
      <h2 className="relative z-10 text-center text-sm font-semibold">{campaign.name}</h2>
      <p className="relative z-10 mt-1.5 text-center text-[11px] font-medium tracking-wide text-foreground/60 [text-shadow:0_0_10px_hsl(var(--background)),0_0_20px_hsl(var(--background))] dark:[text-shadow:0_0_10px_hsl(var(--card)),0_0_20px_hsl(var(--card))]">
        {campaign.advertiser}
      </p>
    </Link>
  );
}

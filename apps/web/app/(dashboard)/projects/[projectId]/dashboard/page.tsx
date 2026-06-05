"use client";

import { use } from "react";
import Link from "next/link";
import {
  Globe,
  Lock,
  Hash,
  Calendar,
  Users,
  Loader2,
  ArrowRight,
  Languages,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { getLanguageName } from "@/lib/language-constants";

type Props = { params: Promise<{ projectId: string }> };

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 py-2.5">
      <span className="w-36 shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 text-sm">{children}</span>
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function ProjectDashboardPage({ params }: Props) {
  const { projectId } = use(params);
  const { data, isPending, isError } = trpc.project.dashboardStats.useQuery({ id: projectId });

  if (isPending) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
        Failed to load project dashboard.
      </div>
    );
  }

  const { project, keyCount, localeStats } = data;

  const overallPct =
    localeStats.length === 0
      ? 0
      : Math.round(
          localeStats.reduce((sum, l) => sum + l.pct, 0) / localeStats.length
        );

  const createdAt = new Date(project.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const sourceLocaleName =
    getLanguageName(project.sourceLocale) || project.sourceLocale;

  return (
    <div className="flex w-full flex-1 flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          An overview of this project&apos;s translation progress and activity.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Translation keys" value={keyCount} />
        <StatCard label="Target languages" value={localeStats.length} />
        <StatCard label="Overall completion" value={`${overallPct}%`} />
        <StatCard
          label="Visibility"
          value={project.visibility === "public" ? "Public" : "Private"}
        />
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">Project info</h2>
        </div>
        <div className="divide-y divide-border px-5">
          <InfoRow label="ID">
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
              {project.id}
            </code>
          </InfoRow>
          <InfoRow label="Slug">
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
              {project.slug}
            </code>
          </InfoRow>
          {project.description && (
            <InfoRow label="Description">
              <span className="text-muted-foreground">{project.description}</span>
            </InfoRow>
          )}
          <InfoRow label="Source language">
            <span className="flex items-center gap-1.5">
              <Languages className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              {sourceLocaleName}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                {project.sourceLocale}
              </code>
            </span>
          </InfoRow>
          <InfoRow label="Visibility">
            <span className="flex items-center gap-1.5">
              {project.visibility === "public" ? (
                <>
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  Public
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  Private
                </>
              )}
            </span>
          </InfoRow>
          <InfoRow label="Contributions">
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              {project.allowContributions ? "Open to contributors" : "Closed"}
            </span>
          </InfoRow>
          <InfoRow label="Created">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              {createdAt}
            </span>
          </InfoRow>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">Language progress</h2>
          <Link
            href={`/projects/${projectId}/settings/languages`}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Manage
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {localeStats.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-5 py-10 text-center">
            <Hash className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No target languages added yet.</p>
            <Link
              href={`/projects/${projectId}/settings/languages`}
              className="mt-1 text-xs text-primary hover:underline"
            >
              Add a language
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {localeStats.map((stat) => {
              const name = getLanguageName(stat.locale) || stat.locale;
              return (
                <div key={stat.localeId} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="w-40 shrink-0">
                    <p className="text-sm font-medium">{name}</p>
                    <code className="font-mono text-xs text-muted-foreground">
                      {stat.locale}
                    </code>
                  </div>
                  <div className="flex flex-1 flex-col gap-1">
                    <ProgressBar pct={stat.pct} />
                    <p className="text-xs text-muted-foreground">
                      {stat.approved} of {keyCount} approved
                      {stat.translated > stat.approved && (
                        <span className="ml-2">
                          ({stat.translated - stat.approved} awaiting review)
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="w-12 shrink-0 text-right">
                    <span className="text-sm font-semibold tabular-nums">{stat.pct}%</span>
                  </div>
                  <Link
                    href={`/projects/${projectId}/strings`}
                    className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
                    title={`Translate ${name}`}
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  GitPullRequest,
  Languages,
  Loader2,
  XCircle,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { getLanguageName } from "@/lib/language-constants";
import { ExportModal } from "../sources/_components/export-modal";
import { PushModal } from "../sources/_components/push-modal";

type Props = { params: Promise<{ projectId: string }> };

function SegmentedProgressBar({
  approved,
  needsReview,
  total,
}: {
  approved: number;
  needsReview: number;
  total: number;
}) {
  if (total === 0) {
    return <div className="h-2 w-full overflow-hidden rounded-full bg-muted" />;
  }
  const approvedPct = Math.round((approved / total) * 100);
  const reviewPct = Math.round((needsReview / total) * 100);
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full bg-green-500 transition-all"
        style={{ width: `${approvedPct}%` }}
        title={`${approvedPct}% approved`}
      />
      <div
        className="h-full bg-amber-400 transition-all"
        style={{ width: `${reviewPct}%` }}
        title={`${reviewPct}% needs review`}
      />
    </div>
  );
}

function PushStatusChip({
  hasUnpushedChanges,
  lastPushedAt,
}: {
  hasUnpushedChanges: boolean;
  lastPushedAt: Date | null;
}) {
  if (!lastPushedAt) {
    // Never pushed — only show a chip if there are translations to push
    if (!hasUnpushedChanges) return null;
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        Never pushed
      </span>
    );
  }

  if (hasUnpushedChanges) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400"
        title={`Last pushed ${lastPushedAt.toLocaleString()}`}
      >
        <GitPullRequest className="h-3 w-3" />
        Unpushed changes
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400"
      title={lastPushedAt.toLocaleString()}
    >
      <CheckCircle2 className="h-3 w-3" />
      Pushed
    </span>
  );
}

function PushJobStatusBadge({ status }: { status: string }) {
  if (status === "done") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
        <CheckCircle2 className="h-3 w-3" />
        Done
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
        <XCircle className="h-3 w-3" />
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      <Loader2 className="h-3 w-3 animate-spin" />
      {status === "queued" ? "Queued" : "Processing"}
    </span>
  );
}

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function TranslationsPage({ params }: Props) {
  const { projectId } = use(params);
  const [showExport, setShowExport] = useState(false);
  const [showPush, setShowPush] = useState(false);

  const statsQuery = trpc.project.dashboardStats.useQuery({ id: projectId });
  const pushJobsQuery = trpc.export.listPushJobs.useQuery({ projectId });
  const pushStatusQuery = trpc.export.getLocalePushStatus.useQuery({ projectId });

  const stats = statsQuery.data;
  const pushJobs = pushJobsQuery.data ?? [];
  const pushStatus = pushStatusQuery.data ?? [];
  const keyCount = stats?.keyCount ?? 0;
  const localeStats = stats?.localeStats ?? [];

  const pushStatusByLocale = new Map(pushStatus.map((s) => [s.locale, s]));

  const isLoading = statsQuery.isPending;

  // Refetch push status after the push modal closes (in case a push just completed)
  function handlePushClose() {
    setShowPush(false);
    void pushStatusQuery.refetch();
    void pushJobsQuery.refetch();
  }

  return (
    <div className="flex w-full flex-1 flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Translations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Translation progress across all target languages.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPush(true)}
            className="btn-secondary flex items-center gap-1.5"
          >
            <GitPullRequest className="h-4 w-4" />
            Push to git
          </button>
          <button
            type="button"
            onClick={() => setShowExport(true)}
            className="btn-secondary flex items-center gap-1.5"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </header>

      {/* Locale progress table */}
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

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && localeStats.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 px-5 py-12 text-center">
            <Languages className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No target languages added yet.</p>
            <Link
              href={`/projects/${projectId}/settings/languages`}
              className="mt-1 text-xs text-primary underline-offset-2 hover:underline"
            >
              Add a language
            </Link>
          </div>
        )}

        {!isLoading && localeStats.length > 0 && (
          <div className="divide-y divide-border">
            {localeStats.map((stat) => {
              const name = getLanguageName(stat.locale) || stat.locale;
              const needsReview = stat.translated - stat.approved;
              const untranslated = keyCount - stat.translated;
              const ps = pushStatusByLocale.get(stat.locale);

              return (
                <div key={stat.localeId} className="flex items-center gap-4 px-5 py-4">
                  {/* Locale name */}
                  <div className="w-36 shrink-0">
                    <p className="text-sm font-medium">{name}</p>
                    <code className="font-mono text-xs text-muted-foreground">
                      {stat.locale}
                    </code>
                  </div>

                  {/* Progress bar + counts */}
                  <div className="flex flex-1 flex-col gap-1.5">
                    <SegmentedProgressBar
                      approved={stat.approved}
                      needsReview={needsReview}
                      total={keyCount}
                    />
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                        {stat.approved} approved
                      </span>
                      {needsReview > 0 && (
                        <span className="flex items-center gap-1">
                          <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
                          {needsReview} to review
                        </span>
                      )}
                      {untranslated > 0 && (
                        <span className="flex items-center gap-1">
                          <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/30" />
                          {untranslated} untranslated
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Percentage */}
                  <div className="w-10 shrink-0 text-right">
                    <span className="text-sm font-semibold tabular-nums">
                      {stat.pct}%
                    </span>
                  </div>

                  {/* Push status */}
                  {ps && stat.approved > 0 && (
                    <div className="w-36 shrink-0">
                      <PushStatusChip
                        hasUnpushedChanges={ps.hasUnpushedChanges}
                        lastPushedAt={ps.lastPushedAt ? new Date(ps.lastPushedAt) : null}
                      />
                    </div>
                  )}
                  {(!ps || stat.approved === 0) && (
                    <div className="w-36 shrink-0" />
                  )}

                  {/* Translate link */}
                  <Link
                    href={`/projects/${projectId}/strings/${stat.locale}`}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
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

      {/* Recent push jobs */}
      {pushJobs.length > 0 && (
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold">Recent pushes</h2>
          </div>
          <div className="divide-y divide-border">
            {pushJobs.map((job) => {
              const repo = job.vcsIntegration
                ? `${job.vcsIntegration.repoOwner}/${job.vcsIntegration.repoName}`
                : "repository";
              return (
                <div key={job.id} className="flex items-center gap-3 px-5 py-3">
                  <GitPullRequest className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{repo}</p>
                    <p className="text-xs text-muted-foreground">
                      {job.locales.join(", ")}
                    </p>
                  </div>
                  <PushJobStatusBadge status={job.status} />
                  {job.prUrl && (
                    <a
                      href={job.prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      PR
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatRelativeTime(new Date(job.createdAt))}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showExport && (
        <ExportModal projectId={projectId} onClose={() => setShowExport(false)} />
      )}

      {showPush && (
        <PushModal projectId={projectId} onClose={handlePushClose} />
      )}
    </div>
  );
}

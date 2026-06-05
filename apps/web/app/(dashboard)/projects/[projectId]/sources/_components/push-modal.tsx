"use client";

import { useState, useEffect, useRef } from "react";
import {
  GitPullRequest,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  GitBranch,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";

function ProgressBadge({ progress }: { progress: number }) {
  const color =
    progress >= 80
      ? "text-green-600 bg-green-500/10 dark:text-green-400"
      : progress >= 40
        ? "text-yellow-600 bg-yellow-500/10 dark:text-yellow-400"
        : "text-muted-foreground bg-muted";
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums ${color}`}>
      {progress}%
    </span>
  );
}

type PushState =
  | { type: "idle" }
  | { type: "pending"; jobId: string }
  | { type: "done"; prUrl: string | null }
  | { type: "failed"; error: string };

function IntegrationPushRow({
  projectId,
  integrationId,
  repoOwner,
  repoName,
  branch,
  files,
  locales,
}: {
  projectId: string;
  integrationId: string;
  repoOwner: string;
  repoName: string;
  branch: string;
  files: Array<{ outputPath: string; locale: string }>;
  locales: string[];
}) {
  const [state, setState] = useState<PushState>({ type: "idle" });

  const triggerPush = trpc.export.triggerPush.useMutation({
    onSuccess: (data) => setState({ type: "pending", jobId: data.jobId }),
    onError: (err) => {
      toast.error(err.message);
      setState({ type: "idle" });
    },
  });

  const jobId = state.type === "pending" ? state.jobId : "";
  const pollQuery = trpc.export.getPushJob.useQuery(
    { jobId },
    {
      enabled: state.type === "pending",
      refetchInterval: state.type === "pending" ? 2000 : false,
    }
  );

  useEffect(() => {
    if (state.type !== "pending") return;
    const status = pollQuery.data?.status;
    if (status === "done") {
      setState({ type: "done", prUrl: pollQuery.data?.prUrl ?? null });
    } else if (status === "failed") {
      setState({ type: "failed", error: pollQuery.data?.error ?? "Push failed" });
    }
  }, [pollQuery.data?.status, pollQuery.data?.prUrl, pollQuery.data?.error, state.type]);

  const isPending = state.type === "pending" || triggerPush.isPending;
  const noFiles = files.length === 0;

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">
            {repoOwner}/{repoName}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <GitBranch className="h-3 w-3" />
            {branch}
          </p>
        </div>

        {state.type === "done" ? (
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
            <span className="text-muted-foreground">Pushed</span>
            {state.prUrl && (
              <a
                href={state.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-2 hover:underline"
              >
                View PR
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        ) : state.type === "failed" ? (
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs text-destructive">{state.error}</span>
            <button
              type="button"
              onClick={() => setState({ type: "idle" })}
              className="text-xs underline-offset-2 hover:underline"
            >
              Retry
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={isPending || noFiles || locales.length === 0}
            onClick={() =>
              triggerPush.mutate({ projectId, vcsIntegrationId: integrationId, locales })
            }
            className="btn-primary inline-flex shrink-0 items-center gap-1.5 text-sm"
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <GitPullRequest className="h-3.5 w-3.5" />
            )}
            Push
          </button>
        )}
      </div>

      {/* File list preview */}
      {files.length > 0 ? (
        <div className="max-h-32 overflow-y-auto rounded border border-border bg-muted/30 p-2 font-mono text-xs text-muted-foreground">
          {files.map((f, i) => (
            <p key={i}>{f.outputPath}</p>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          No output paths resolved for the selected languages. Check that source file paths contain the source locale code as a directory segment.
        </p>
      )}
    </div>
  );
}

type Props = {
  projectId: string;
  onClose: () => void;
};

export function PushModal({ projectId, onClose }: Props) {
  const [selectedLocales, setSelectedLocales] = useState<Set<string>>(new Set());
  const initialized = useRef(false);

  const localesQuery = trpc.export.getLocalesWithProgress.useQuery({ projectId });
  const localesData = localesQuery.data;

  const previewQuery = trpc.export.preview.useQuery(
    { projectId, locales: Array.from(selectedLocales) },
    { enabled: selectedLocales.size > 0 }
  );

  const preview = previewQuery.data;

  useEffect(() => {
    if (localesData && !initialized.current) {
      initialized.current = true;
      setSelectedLocales(new Set(localesData.locales.map((l) => l.locale)));
    }
  }, [localesData]);

  function toggleLocale(locale: string) {
    setSelectedLocales((prev) => {
      const next = new Set(prev);
      if (next.has(locale)) next.delete(locale);
      else next.add(locale);
      return next;
    });
  }

  const localeList = Array.from(selectedLocales);
  const hasVcs = (preview?.vcsTargets.length ?? 0) > 0 || (preview?.hasVcsIntegrations ?? false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-lg flex-col gap-5 rounded-xl border border-border bg-background p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Push to git</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>

        {/* Language selector */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Languages</p>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() =>
                  setSelectedLocales(new Set((localesData?.locales ?? []).map((l) => l.locale)))
                }
                className="text-muted-foreground underline-offset-2 hover:underline"
              >
                All
              </button>
              <span className="text-border">|</span>
              <button
                type="button"
                onClick={() => setSelectedLocales(new Set())}
                className="text-muted-foreground underline-offset-2 hover:underline"
              >
                None
              </button>
            </div>
          </div>

          {localesQuery.isPending && (
            <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading locales...
            </div>
          )}

          {!localesQuery.isPending && (!localesData || localesData.locales.length === 0) && (
            <p className="text-sm text-muted-foreground">
              No target locales configured for this project.
            </p>
          )}

          {localesData && localesData.locales.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {localesData.locales.map((loc) => (
                <label
                  key={loc.locale}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    selectedLocales.has(loc.locale)
                      ? "border-ring bg-muted/50"
                      : "border-border hover:border-ring/50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedLocales.has(loc.locale)}
                    onChange={() => toggleLocale(loc.locale)}
                    className="h-3.5 w-3.5 rounded"
                  />
                  <span className="truncate font-medium">{loc.locale}</span>
                  <ProgressBadge progress={loc.progress} />
                </label>
              ))}
            </div>
          )}
        </div>

        {/* VCS integrations */}
        {selectedLocales.size > 0 && (
          <div className="flex flex-col gap-2">
            {previewQuery.isFetching ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading integrations...
              </div>
            ) : !hasVcs ? (
              <div className="rounded-lg border border-border bg-muted/30 p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  No GitHub integrations connected to this project.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add a repository on the Integrations page to enable pushing.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {preview?.vcsTargets.map((target) => (
                  <IntegrationPushRow
                    key={target.integrationId}
                    projectId={projectId}
                    integrationId={target.integrationId}
                    repoOwner={target.repoOwner}
                    repoName={target.repoName}
                    branch={target.branch}
                    files={target.files}
                    locales={localeList}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end border-t border-border pt-4">
          <button type="button" onClick={onClose} className="btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { Download, Loader2, XCircle } from "lucide-react";
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

type Props = {
  projectId: string;
  onClose: () => void;
};

export function ExportModal({ projectId, onClose }: Props) {
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
  const downloadUrl = `/api/projects/${projectId}/export?locales=${encodeURIComponent(localeList.join(","))}`;

  // Combine all output paths from both VCS and upload sources for the preview
  const allPreviewPaths = preview
    ? [
        ...preview.vcsTargets.flatMap((t) => t.files.map((f) => f.outputPath)),
        ...preview.downloadTargets.map((f) => f.outputPath),
      ]
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-lg flex-col gap-5 rounded-xl border border-border bg-background p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Download translations</h2>
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

        {/* File preview */}
        {selectedLocales.size > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Files in ZIP</p>
            {previewQuery.isFetching ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Computing paths...
              </div>
            ) : allPreviewPaths.length > 0 ? (
              <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-muted/30 p-3 font-mono text-xs text-muted-foreground">
                {allPreviewPaths.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            ) : preview ? (
              <p className="text-xs text-muted-foreground">
                No output paths could be resolved. Check that source file paths contain the source locale code as a directory segment.
              </p>
            ) : null}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-border pt-4">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <a
            href={downloadUrl}
            className={`btn-primary inline-flex items-center gap-1.5 ${
              selectedLocales.size === 0 ? "pointer-events-none opacity-50" : ""
            }`}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={selectedLocales.size === 0}
          >
            <Download className="h-3.5 w-3.5" />
            Download ZIP
          </a>
        </div>
      </div>
    </div>
  );
}

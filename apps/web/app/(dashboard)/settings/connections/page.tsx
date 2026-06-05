"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, ExternalLink, Loader2, Unlink } from "lucide-react";
import { toast } from "sonner";
import { t } from "@lingui/core/macro";
import { trpc } from "@/lib/trpc/client";

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

export default function ConnectionsPage() {
  const searchParams = useSearchParams();
  const utils = trpc.useUtils();
  const availabilityQuery = trpc.user.getIntegrationAvailability.useQuery();
  const installationQuery = trpc.user.getGitHubInstallation.useQuery();

  const disconnect = trpc.user.disconnectGitHub.useMutation({
    onSuccess: () => {
      toast.success(t`GitHub disconnected`);
      utils.user.getGitHubInstallation.invalidate();
      utils.user.listGitHubRepos.invalidate();
    },
    onError: () => toast.error(t`Failed to disconnect`),
  });

  useEffect(() => {
    if (searchParams.get("error") === "github_not_configured") {
      toast.error(t`GitHub integration is not configured on this server.`);
    }
  }, [searchParams]);

  const githubAvailable = availabilityQuery.data?.github.available ?? false;
  const appSlug = availabilityQuery.data?.github.appSlug;
  const connectUrl =
    githubAvailable && appSlug
      ? `https://github.com/apps/${appSlug}/installations/new`
      : null;

  const installation = installationQuery.data;
  const isLoading = availabilityQuery.isPending || installationQuery.isPending;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">{t`Connected accounts`}</h2>

        <div className="rounded-lg border border-border p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <GitHubIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">GitHub</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t`Allows projects to sync source files and push translations back as pull requests.`}
                </p>
              </div>
            </div>

            <div className="shrink-0">
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : installation ? (
                <div className="flex items-center gap-2">
                  <a
                    href={`https://github.com/settings/installations/${installation.installationId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary inline-flex items-center gap-1.5 text-sm"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {t`Manage`}
                  </a>
                  <button
                    type="button"
                    onClick={() => disconnect.mutate()}
                    disabled={disconnect.isPending}
                    className="btn-secondary inline-flex items-center gap-1.5 text-sm"
                  >
                    {disconnect.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Unlink className="h-3.5 w-3.5" />
                    )}
                    {t`Disconnect`}
                  </button>
                </div>
              ) : connectUrl ? (
                <a href={connectUrl} className="btn-primary text-sm">
                  {t`Connect`}
                </a>
              ) : (
                <p className="max-w-[220px] text-right text-xs text-muted-foreground">
                  {t`Not available on this server.`}
                </p>
              )}
            </div>
          </div>

          {!isLoading && !githubAvailable && (
            <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
              {t`GitHub integration requires server configuration. Set GITHUB_APP_ID, GITHUB_PRIVATE_KEY, GITHUB_WEBHOOK_SECRET, and GITHUB_APP_SLUG to enable it.`}
            </p>
          )}

          {installation && (
            <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
              <p className="text-xs text-muted-foreground">
                {t`Connected`}{" - "}{t`installation`}{" "}
                <span className="font-mono">{installation.installationId}</span>
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

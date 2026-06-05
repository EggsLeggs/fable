"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle2, ExternalLink, Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";

type Props = { params: Promise<{ projectId: string }> };

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

type VcsIntegration = {
  id: string;
  repoOwner: string;
  repoName: string;
  defaultBranch: string;
  filePatterns: string[];
};

function ConnectedRepo({
  integration,
  onUpdated,
}: {
  integration: VcsIntegration;
  onUpdated: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [branch, setBranch] = useState(integration.defaultBranch);
  const [patterns, setPatterns] = useState(integration.filePatterns.join("\n"));

  const update = trpc.sourceFile.updateVcsIntegration.useMutation({
    onSuccess: () => {
      toast.success("Saved");
      setEditing(false);
      onUpdated();
    },
    onError: (err) => toast.error(err.message),
  });

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    update.mutate({
      integrationId: integration.id,
      defaultBranch: branch || integration.defaultBranch,
      filePatterns: patterns
        .split("\n")
        .map((p) => p.trim())
        .filter(Boolean),
    });
  }

  function handleCancel() {
    setBranch(integration.defaultBranch);
    setPatterns(integration.filePatterns.join("\n"));
    setEditing(false);
  }

  return (
    <li className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
          <div>
            <p className="text-sm font-medium">
              {integration.repoOwner}/{integration.repoName}
            </p>
            <p className="text-xs text-muted-foreground">
              Branch: {integration.defaultBranch}
              {integration.filePatterns.length > 0 &&
                ` · ${integration.filePatterns.length} pattern${
                  integration.filePatterns.length !== 1 ? "s" : ""
                }`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted"
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <a
            href={`https://github.com/${integration.repoOwner}/${integration.repoName}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted"
            title="Open on GitHub"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {editing && (
        <form
          onSubmit={handleSave}
          className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3"
        >
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Source branch
            </label>
            <input
              className="input"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              File patterns (one per line)
            </label>
            <textarea
              className="input min-h-[72px] resize-y font-mono text-xs"
              placeholder={"src/locales/en/**\npublic/i18n/en.json"}
              value={patterns}
              onChange={(e) => setPatterns(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={update.isPending}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={update.isPending}
              className="btn-primary inline-flex items-center gap-1.5"
            >
              {update.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Save"
              )}
            </button>
          </div>
        </form>
      )}
    </li>
  );
}

function AddRepoForm({ projectId, onAdded }: { projectId: string; onAdded: () => void }) {
  const reposQuery = trpc.user.listGitHubRepos.useQuery();
  const [selectedRepo, setSelectedRepo] = useState("");
  const [branch, setBranch] = useState("");
  const [patterns, setPatterns] = useState("");
  const [showForm, setShowForm] = useState(false);

  const create = trpc.sourceFile.createVcsIntegration.useMutation({
    onSuccess: () => {
      toast.success("Repository connected");
      setShowForm(false);
      setSelectedRepo("");
      setBranch("");
      setPatterns("");
      onAdded();
    },
    onError: (err) => toast.error(err.message),
  });

  const repos = reposQuery.data ?? [];
  const selected = repos.find((r) => r.fullName === selectedRepo);

  function handleRepoChange(fullName: string) {
    setSelectedRepo(fullName);
    const repo = repos.find((r) => r.fullName === fullName);
    if (repo) setBranch(repo.defaultBranch);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const [owner, name] = selected.fullName.split("/") as [string, string];
    create.mutate({
      projectId,
      repoOwner: owner,
      repoName: name,
      defaultBranch: branch || selected.defaultBranch,
      filePatterns: patterns
        .split("\n")
        .map((p) => p.trim())
        .filter(Boolean),
    });
  }

  if (!showForm) {
    return (
      <button
        type="button"
        onClick={() => setShowForm(true)}
        className="btn-secondary inline-flex items-center gap-1.5 text-sm"
      >
        <Plus className="h-3.5 w-3.5" />
        Add repository
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 flex flex-col gap-3 rounded-lg border border-border p-4"
    >
      <p className="text-sm font-medium">Add repository</p>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">Repository</label>
        {reposQuery.isPending ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading repositories...
          </div>
        ) : (
          <select
            className="input"
            value={selectedRepo}
            onChange={(e) => handleRepoChange(e.target.value)}
            required
          >
            <option value="">Select a repository</option>
            {repos.map((repo) => (
              <option key={repo.id} value={repo.fullName}>
                {repo.fullName}{repo.private ? " (private)" : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">Source branch</label>
        <input
          className="input"
          placeholder="main"
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          File patterns (one per line)
        </label>
        <textarea
          className="input min-h-[72px] resize-y font-mono text-xs"
          placeholder={"src/locales/en/**\npublic/i18n/en.json"}
          value={patterns}
          onChange={(e) => setPatterns(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Glob patterns for source locale files. Pushes to those paths trigger a sync.
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setShowForm(false)}
          disabled={create.isPending}
          className="btn-secondary"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={create.isPending || !selectedRepo}
          className="btn-primary inline-flex items-center gap-1.5"
        >
          {create.isPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Connecting...
            </>
          ) : (
            "Connect"
          )}
        </button>
      </div>
    </form>
  );
}

export default function IntegrationsPage({ params }: Props) {
  const { projectId } = use(params);
  const utils = trpc.useUtils();

  const installationQuery = trpc.user.getGitHubInstallation.useQuery();
  const integrationsQuery = trpc.sourceFile.listVcsIntegrations.useQuery({ projectId });

  const installation = installationQuery.data;
  const integrations = integrationsQuery.data ?? [];

  const isLoading = installationQuery.isPending || integrationsQuery.isPending;

  return (
    <div className="flex w-full flex-1 flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect third-party tools and configure webhooks for this project.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Source control</h2>

        <div className="rounded-lg border border-border p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <GitHubIcon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">GitHub</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Sync source files from a repository and push translations back as pull requests.
              </p>

              {isLoading && (
                <div className="mt-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}

              {!isLoading && !installation && (
                <div className="mt-3 rounded-lg bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
                  Connect your GitHub account in{" "}
                  <Link
                    href="/settings/connections"
                    className="font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    Settings &rarr; Connections
                  </Link>{" "}
                  to add repositories.
                </div>
              )}

              {!isLoading && installation && (
                <>
                  {integrations.length > 0 && (
                    <ul className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
                      {integrations.map((integration) => (
                        <ConnectedRepo
                          key={integration.id}
                          integration={integration}
                          onUpdated={() => integrationsQuery.refetch()}
                        />
                      ))}
                    </ul>
                  )}

                  <div className={integrations.length > 0 ? "mt-3 border-t border-border pt-3" : "mt-3"}>
                    <AddRepoForm
                      projectId={projectId}
                      onAdded={() => integrationsQuery.refetch()}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

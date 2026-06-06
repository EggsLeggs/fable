"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { t } from "@lingui/core/macro";
import { Input } from "@fable/ui";
import { InlineUpdateAction } from "@/components/inline-update-action";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ projectId: string }> };

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border py-6 first:border-t-0 first:pt-0 last:pb-0">
      <div className="mb-5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function FieldGroup({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">{label}</label>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      {children}
    </div>
  );
}

function InlineTextField({
  label,
  description,
  value,
  savedValue,
  onChange,
  onUpdate,
  updating,
  inputProps,
  multiline,
}: {
  label: string;
  description?: string;
  value: string;
  savedValue: string;
  onChange: (value: string) => void;
  onUpdate: () => void;
  updating: boolean;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement>;
  multiline?: boolean;
}) {
  const isDirty = value !== savedValue;

  return (
    <FieldGroup label={label} description={description}>
      <div
        className={cn(
          "flex items-start transition-[gap] duration-100 ease-out",
          isDirty ? "gap-2" : "gap-0"
        )}
      >
        {multiline ? (
          <textarea
            {...(inputProps as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            className="input min-w-0 flex-1 resize-none transition-[flex-grow] duration-100 ease-out"
          />
        ) : (
          <Input
            {...(inputProps as React.ComponentProps<typeof Input>)}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="min-w-0 flex-1 transition-[flex-grow] duration-100 ease-out"
          />
        )}
        <InlineUpdateAction
          visible={isDirty}
          onClick={onUpdate}
          disabled={updating}
        >
          {updating ? t`Saving...` : t`Save`}
        </InlineUpdateAction>
      </div>
    </FieldGroup>
  );
}

function badgeColor(pct: number): string {
  if (pct >= 90) return "brightgreen";
  if (pct >= 70) return "green";
  if (pct >= 50) return "yellow";
  if (pct >= 30) return "orange";
  return "red";
}

function BadgeGenerator({ projectId }: { projectId: string }) {
  const [copied, setCopied] = useState<"markdown" | "html" | null>(null);

  const statsQuery = trpc.project.badgeStats.useQuery({ id: projectId });
  const pct = statsQuery.data?.pct ?? 0;
  const color = badgeColor(pct);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const endpointUrl = `${origin}/api/projects/${projectId}/badge`;
  const endpointBadgeUrl = `https://img.shields.io/endpoint?url=${encodeURIComponent(endpointUrl)}`;
  const previewBadgeUrl = `https://img.shields.io/badge/translated-${pct}%25-${color}`;
  const badgeAlt = t`Translation status`;

  const markdown = `[![${badgeAlt}](${endpointBadgeUrl})](https://fable.app)`;
  const html = `<a href="https://fable.app"><img src="${endpointBadgeUrl}" alt="${badgeAlt}" /></a>`;

  async function copy(type: "markdown" | "html") {
    const text = type === "markdown" ? markdown : html;
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {statsQuery.isLoading ? (
          <div className="h-5 w-24 animate-pulse rounded bg-muted" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewBadgeUrl} alt={badgeAlt} className="h-5" />
        )}
        {!statsQuery.isLoading && (
          <span className="text-xs text-muted-foreground">
            {statsQuery.data
              ? `${pct}% of strings approved across ${statsQuery.data.targetLocaleCount} target ${statsQuery.data.targetLocaleCount === 1 ? "language" : "languages"}`
              : "No translation data yet"}
          </span>
        )}
      </div>
      <div className="space-y-2">
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">{t`Markdown`}</p>
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2">
            <code className="flex-1 truncate font-mono text-xs">{markdown}</code>
            <button
              type="button"
              onClick={() => copy("markdown")}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label={t`Copy markdown`}
            >
              {copied === "markdown" ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">{t`HTML`}</p>
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2">
            <code className="flex-1 truncate font-mono text-xs">{html}</code>
            <button
              type="button"
              onClick={() => copy("html")}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label={t`Copy HTML`}
            >
              {copied === "html" ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProjectGeneralSettingsPage({ params }: Props) {
  const { projectId } = use(params);
  const router = useRouter();

  const projectQuery = trpc.project.getById.useQuery({ id: projectId });
  const project = projectQuery.data;
  const synced = useRef<string | null>(null);

  const [nameDraft, setNameDraft] = useState<string | undefined>(undefined);
  const name = nameDraft ?? project?.name ?? "";
  const [descDraft, setDescDraft] = useState<string | undefined>(undefined);
  const desc = descDraft ?? project?.description ?? "";

  const [updatingField, setUpdatingField] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [nameCopied, setNameCopied] = useState(false);

  useEffect(() => {
    if (!project || synced.current === project.id) return;
    synced.current = project.id;
    setNameDraft(undefined);
    setDescDraft(undefined);
  }, [project]);

  const updateMutation = trpc.project.update.useMutation({
    onError: (err) => toast.error(err.message ?? t`Could not update project.`),
  });

  const deleteMutation = trpc.project.delete.useMutation({
    onSuccess: () => {
      toast.success(t`Project deleted.`);
      router.push("/dashboard");
    },
    onError: (err) => {
      toast.error(err.message ?? t`Could not delete project.`);
      setDeleting(false);
    },
  });

  function save(
    data: Parameters<typeof updateMutation.mutate>[0],
    field: string
  ) {
    setUpdatingField(field);
    updateMutation.mutate(data, {
      onSuccess: () => {
        void projectQuery.refetch();
        setUpdatingField(null);
        if (data.name !== undefined) setNameDraft(undefined);
        if (data.description !== undefined) setDescDraft(undefined);
        toast.success(t`Updated.`);
      },
      onError: () => setUpdatingField(null),
    });
  }

  function handleUpdateName() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error(t`Project name cannot be empty.`);
      return;
    }
    save({ id: projectId, name: trimmed }, "name");
  }

  function handleUpdateDesc() {
    save({ id: projectId, description: desc.trim() || undefined }, "description");
  }

  function handleDeleteDialogOpenChange(open: boolean) {
    setDeleteDialogOpen(open);
    if (!open) {
      setConfirmName("");
      setNameCopied(false);
    }
  }

  function handleCopyProjectName() {
    if (!project) return;
    void navigator.clipboard.writeText(project.name).then(() => {
      setNameCopied(true);
      setTimeout(() => setNameCopied(false), 2000);
    });
  }

  function handleDelete() {
    if (confirmName !== project?.name) {
      toast.error(t`Project name does not match.`);
      return;
    }
    setDeleting(true);
    deleteMutation.mutate({ id: projectId });
  }

  if (projectQuery.isLoading || !project) {
    return <div className="text-sm text-muted-foreground">{t`Loading...`}</div>;
  }

  return (
    <div className="flex w-full flex-1 flex-col">
      <div className="max-w-xl">
      <Section title={t`Project details`} description={t`Basic information about this project.`}>
        <InlineTextField
          label={t`Name`}
          value={name}
          savedValue={project.name}
          onChange={setNameDraft}
          onUpdate={handleUpdateName}
          updating={updatingField === "name"}
          inputProps={{ placeholder: t`Project name` }}
        />
        <InlineTextField
          label={t`Description`}
          description={t`A short description of what this project is.`}
          value={desc}
          savedValue={project.description ?? ""}
          onChange={setDescDraft}
          onUpdate={handleUpdateDesc}
          updating={updatingField === "description"}
          multiline
          inputProps={{ placeholder: t`Optional description` }}
        />
      </Section>

      <Section title={t`GitHub badge`} description={t`Embed a badge in your repository's README.`}>
        <BadgeGenerator projectId={projectId} />
      </Section>

      <Section
        title={t`Danger zone`}
        description={t`Permanently delete this project and all associated translation keys, locales, and data. This cannot be undone.`}
      >
        <Button
          type="button"
          variant="destructive"
          onClick={() => setDeleteDialogOpen(true)}
        >
          {t`Delete project`}
        </Button>
      </Section>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={handleDeleteDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t`Delete project`}</DialogTitle>
            <DialogDescription>
              {t`Permanently delete this project and all associated translation keys, locales, and data. This cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium">
                {t`Type`}{" "}
                <span className="inline-flex items-center gap-1 align-middle">
                  <code className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {project.name}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyProjectName}
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                    aria-label={t`Copy project name`}
                  >
                    {nameCopied ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </span>{" "}
                {t`to confirm`}
              </p>
              <Input
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={project.name}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleDeleteDialogOpenChange(false)}
                disabled={deleting}
              >
                {t`Cancel`}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={deleting || confirmName !== project.name}
                onClick={handleDelete}
              >
                {deleting ? t`Deleting...` : t`Delete project`}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

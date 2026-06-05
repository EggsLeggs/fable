"use client";

import { use, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { t } from "@lingui/core/macro";
import { trpc } from "@/lib/trpc/client";
import type { GlossaryAccess } from "@fable/db";

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
    <section className="rounded-lg border border-border bg-card p-6">
      <div className="mb-5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export default function CollaborationSettingsPage({ params }: Props) {
  const { projectId } = use(params);

  const projectQuery = trpc.project.getById.useQuery({ id: projectId });
  const project = projectQuery.data;
  const synced = useRef<string | null>(null);

  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const [glossaryAccess, setGlossaryAccess] = useState<GlossaryAccess>("readonly");
  const [notifyTranslators, setNotifyTranslators] = useState(false);
  const [updatingField, setUpdatingField] = useState<string | null>(null);

  useEffect(() => {
    if (!project || synced.current === project.id) return;
    synced.current = project.id;
    setVisibility(project.visibility);
    setGlossaryAccess(project.glossaryAccess);
    setNotifyTranslators(project.notifyTranslatorsOnNewStrings);
  }, [project]);

  const updateMutation = trpc.project.update.useMutation({
    onError: (err) => toast.error(err.message ?? t`Could not update project.`),
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
      },
      onError: () => setUpdatingField(null),
    });
  }

  function handleVisibilityChange(value: "public" | "private") {
    setVisibility(value);
    save({ id: projectId, visibility: value }, "visibility");
  }

  function handleGlossaryAccessChange(value: GlossaryAccess) {
    setGlossaryAccess(value);
    save({ id: projectId, glossaryAccess: value }, "glossaryAccess");
  }

  function handleNotifyTranslatorsChange(checked: boolean) {
    setNotifyTranslators(checked);
    save({ id: projectId, notifyTranslatorsOnNewStrings: checked }, "notifyTranslators");
  }

  if (projectQuery.isLoading || !project) {
    return <div className="text-sm text-muted-foreground">{t`Loading...`}</div>;
  }

  const visibilityOptions: { value: "public" | "private"; label: string; description: string }[] = [
    {
      value: "public",
      label: t`Public`,
      description: t`Anyone can view this project's translations and contribute suggestions.`,
    },
    {
      value: "private",
      label: t`Private`,
      description: t`Only org members can access this project.`,
    },
  ];

  const glossaryOptions: { value: GlossaryAccess; label: string; description: string }[] = [
    {
      value: "readonly",
      label: t`Read only`,
      description: t`Translators can view glossary terms but cannot edit or suggest.`,
    },
    {
      value: "suggest",
      label: t`Suggest`,
      description: t`Translators can suggest new glossary terms for review.`,
    },
    {
      value: "full",
      label: t`Full access`,
      description: t`Translators can add and edit glossary terms directly.`,
    },
  ];

  const notificationOptions: { field: string; label: string; description: string; checked: boolean; onChange: (v: boolean) => void }[] = [
    {
      field: "notifyTranslators",
      label: t`Notify translators of new strings`,
      description: t`Send a notification to project translators when new translation keys are added.`,
      checked: notifyTranslators,
      onChange: handleNotifyTranslatorsChange,
    },
  ];

  return (
    <div className="max-w-xl space-y-6">
      <Section
        title={t`Visibility`}
        description={t`Control who can view and contribute to this project.`}
      >
        <div className="space-y-2">
          {visibilityOptions.map(({ value, label, description }) => (
            <label
              key={value}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:bg-muted/50"
            >
              <input
                type="radio"
                name="visibility"
                value={value}
                checked={visibility === value}
                onChange={() => handleVisibilityChange(value)}
                disabled={updatingField === "visibility"}
                className="mt-0.5"
              />
              <span>
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-xs text-muted-foreground">{description}</span>
              </span>
            </label>
          ))}
        </div>
      </Section>

      <Section
        title={t`Glossary access`}
        description={t`Set what translators can do with the organisation glossary on this project.`}
      >
        <div className="space-y-2">
          {glossaryOptions.map(({ value, label, description }) => (
            <label
              key={value}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:bg-muted/50"
            >
              <input
                type="radio"
                name="glossaryAccess"
                value={value}
                checked={glossaryAccess === value}
                onChange={() => handleGlossaryAccessChange(value)}
                disabled={updatingField === "glossaryAccess"}
                className="mt-0.5"
              />
              <span>
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-xs text-muted-foreground">{description}</span>
              </span>
            </label>
          ))}
        </div>
      </Section>

      <Section
        title={t`Notifications`}
        description={t`Configure which events trigger notifications for project members.`}
      >
        <div className="space-y-3">
          {notificationOptions.map(({ field, label, description, checked, onChange }) => (
            <label
              key={field}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:bg-muted/50"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                disabled={updatingField === field}
                className="mt-0.5"
              />
              <span>
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-xs text-muted-foreground">{description}</span>
              </span>
            </label>
          ))}
        </div>
      </Section>
    </div>
  );
}

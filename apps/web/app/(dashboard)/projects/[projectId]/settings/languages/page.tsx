"use client";

import { use, useEffect, useRef, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { t } from "@lingui/core/macro";
import { Button, Input } from "@fable/ui";
import { trpc } from "@/lib/trpc/client";
import { LANGUAGES, getLanguageName } from "@/lib/language-constants";
import type { CustomLocale } from "@fable/db";

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

export default function LanguagesSettingsPage({ params }: Props) {
  const { projectId } = use(params);

  const projectQuery = trpc.project.getById.useQuery({ id: projectId });
  const project = projectQuery.data;
  const synced = useRef<string | null>(null);

  const [sourceLocale, setSourceLocale] = useState("en");
  const [customLocales, setCustomLocales] = useState<CustomLocale[]>([]);
  const [newCustomName, setNewCustomName] = useState("");
  const [newCustomCode, setNewCustomCode] = useState("");
  const [updatingSource, setUpdatingSource] = useState(false);
  const [updatingCustom, setUpdatingCustom] = useState(false);

  useEffect(() => {
    if (!project || synced.current === project.id) return;
    synced.current = project.id;
    setSourceLocale(project.sourceLocale);
    setCustomLocales(project.customLocales ?? []);
  }, [project]);

  const updateSourceLocaleMutation = trpc.project.updateSourceLocale.useMutation({
    onSuccess: () => {
      void projectQuery.refetch();
      setUpdatingSource(false);
      toast.success(t`Source language updated.`);
    },
    onError: (err) => {
      toast.error(err.message ?? t`Could not update source language.`);
      setUpdatingSource(false);
    },
  });

  const addLocaleMutation = trpc.project.addLocale.useMutation({
    onSuccess: () => void projectQuery.refetch(),
    onError: (err) => toast.error(err.message ?? t`Could not add language.`),
  });

  const removeLocaleMutation = trpc.project.removeLocale.useMutation({
    onSuccess: () => void projectQuery.refetch(),
    onError: (err) => toast.error(err.message ?? t`Could not remove language.`),
  });

  const updateMutation = trpc.project.update.useMutation({
    onError: (err) => toast.error(err.message ?? t`Could not update project.`),
  });

  function handleSourceLocaleChange(value: string) {
    setSourceLocale(value);
    setUpdatingSource(true);
    updateSourceLocaleMutation.mutate({ id: projectId, sourceLocale: value });
  }

  function handleAddTargetLocale(locale: string) {
    if (!locale) return;
    const existing = project?.locales.find((l) => l.locale === locale);
    if (existing) {
      toast.error(t`This language is already added.`);
      return;
    }
    addLocaleMutation.mutate({ projectId, locale });
  }

  function handleRemoveLocale(localeId: string) {
    removeLocaleMutation.mutate({ projectId, localeId });
  }

  function handleAddCustomLocale() {
    const name = newCustomName.trim();
    const code = newCustomCode.trim();
    if (!name || !code) {
      toast.error(t`Both a name and a code are required.`);
      return;
    }
    const already = customLocales.some(
      (l) => l.code.toLowerCase() === code.toLowerCase()
    );
    if (already) {
      toast.error(t`A custom language with that code already exists.`);
      return;
    }
    const next = [...customLocales, { name, code }];
    setUpdatingCustom(true);
    setCustomLocales(next);
    updateMutation.mutate(
      { id: projectId, customLocales: next },
      {
        onSuccess: () => {
          void projectQuery.refetch();
          setNewCustomName("");
          setNewCustomCode("");
          setUpdatingCustom(false);
          toast.success(t`Custom language added.`);
        },
        onError: () => {
          setCustomLocales(customLocales);
          setUpdatingCustom(false);
        },
      }
    );
  }

  function handleRemoveCustomLocale(code: string) {
    const next = customLocales.filter((l) => l.code !== code);
    setCustomLocales(next);
    updateMutation.mutate(
      { id: projectId, customLocales: next },
      {
        onSuccess: () => {
          void projectQuery.refetch();
          toast.success(t`Custom language removed.`);
        },
        onError: () => setCustomLocales(customLocales),
      }
    );
  }

  if (projectQuery.isLoading || !project) {
    return <div className="text-sm text-muted-foreground">{t`Loading...`}</div>;
  }

  const targetLocales = project.locales.filter((l) => !l.isSource);
  const addedCodes = new Set(project.locales.map((l) => l.locale));
  const availableToAdd = [...LANGUAGES, ...customLocales].filter(
    (l) => !addedCodes.has(l.code) && l.code !== sourceLocale
  );

  return (
    <div className="max-w-xl space-y-6">
      <Section
        title={t`Source language`}
        description={t`The language your strings are written in. All translations are derived from this.`}
      >
        <select
          value={sourceLocale}
          onChange={(e) => handleSourceLocaleChange(e.target.value)}
          disabled={updatingSource}
          className="input w-full"
        >
          {LANGUAGES.map(({ code, name }) => (
            <option key={code} value={code}>
              {name} ({code})
            </option>
          ))}
          {customLocales.map(({ code, name }) => (
            <option key={code} value={code}>
              {name} ({code})
            </option>
          ))}
        </select>
      </Section>

      <Section
        title={t`Target languages`}
        description={t`Languages your project will be translated into.`}
      >
        {targetLocales.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t`No target languages yet.`}</p>
        ) : (
          <ul className="space-y-1.5">
            {targetLocales.map((locale) => {
              const label =
                getLanguageName(locale.locale) ||
                customLocales.find((l) => l.code === locale.locale)?.name ||
                locale.locale;
              return (
                <li
                  key={locale.id}
                  className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2"
                >
                  <span className="text-sm">
                    {label}
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {locale.locale}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveLocale(locale.id)}
                    disabled={removeLocaleMutation.isPending}
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    aria-label={t`Remove language`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="pt-1">
          <p className="mb-2 text-xs font-medium text-muted-foreground">{t`Add a language`}</p>
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) handleAddTargetLocale(e.target.value);
              e.target.value = "";
            }}
            disabled={addLocaleMutation.isPending}
            className="input w-full"
          >
            <option value="" disabled>
              {t`Select a language to add...`}
            </option>
            {availableToAdd.map(({ code, name }) => (
              <option key={code} value={code}>
                {name} ({code})
              </option>
            ))}
          </select>
        </div>
      </Section>

      <Section
        title={t`Custom language codes`}
        description={t`Add languages that are not in the standard list, such as regional variants or internal codes.`}
      >
        {customLocales.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t`No custom languages added yet.`}</p>
        ) : (
          <ul className="space-y-1.5">
            {customLocales.map((locale) => (
              <li
                key={locale.code}
                className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2"
              >
                <span className="text-sm">
                  {locale.name}
                  <span className="ml-2 font-mono text-xs text-muted-foreground">
                    {locale.code}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveCustomLocale(locale.code)}
                  disabled={updatingCustom}
                  className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                  aria-label={t`Remove custom language`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-2 pt-1">
          <p className="text-xs font-medium text-muted-foreground">{t`Add a custom language`}</p>
          <div className="flex gap-2">
            <Input
              value={newCustomName}
              onChange={(e) => setNewCustomName(e.target.value)}
              placeholder={t`Language name`}
              className="flex-1"
            />
            <Input
              value={newCustomCode}
              onChange={(e) => setNewCustomCode(e.target.value)}
              placeholder={t`Code (e.g. en-GB)`}
              className="w-36"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={handleAddCustomLocale}
              disabled={updatingCustom || !newCustomName.trim() || !newCustomCode.trim()}
            >
              <Plus className="h-4 w-4" />
              {t`Add`}
            </Button>
          </div>
        </div>
      </Section>
    </div>
  );
}

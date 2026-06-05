"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X } from "lucide-react";
import { t } from "@lingui/core/macro";
import { trpc } from "@/lib/trpc/client";
import { LANGUAGES, getLanguageName } from "@/lib/language-constants";
import { SelectCombobox } from "@/components/ui/select-combobox";
import type { DbProject } from "@fable/db";

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

type AddedMember = {
  name: string;
  email: string;
  role: "owner" | "collaborator";
};

export function NewProjectWizard() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [sourceLocale, setSourceLocale] = useState("en");
  const [targetLocales, setTargetLocales] = useState<string[]>([]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdProject, setCreatedProject] = useState<DbProject | null>(null);
  const [createdOrgId, setCreatedOrgId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [addedMembers, setAddedMembers] = useState<AddedMember[]>([]);

  const slug = toSlug(name);

  const getOrCreate = trpc.organization.getOrCreate.useMutation();
  const createProject = trpc.project.create.useMutation();
  const inviteByEmail = trpc.organization.inviteByEmail.useMutation();

  const creating = getOrCreate.isPending || createProject.isPending;

  const addedCodes = new Set([sourceLocale, ...targetLocales]);
  const availableToAdd = LANGUAGES.filter(
    (l) => !addedCodes.has(l.code) && l.code !== sourceLocale
  );

  function handleSourceLocaleChange(value: string) {
    setSourceLocale(value);
    setTargetLocales((prev) => prev.filter((locale) => locale !== value));
  }

  function handleAddTargetLocale(locale: string) {
    if (!locale || locale === sourceLocale || targetLocales.includes(locale)) return;
    setTargetLocales((prev) => [...prev, locale]);
  }

  function handleRemoveTargetLocale(locale: string) {
    setTargetLocales((prev) => prev.filter((code) => code !== locale));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreateError(null);
    try {
      const org = await getOrCreate.mutateAsync();
      const project = await createProject.mutateAsync({
        orgId: org.id,
        name: name.trim(),
        slug,
        sourceLocale,
        targetLocales,
      });
      setCreatedProject(project);
      setCreatedOrgId(org.id);
      setAddedMembers([{ name: t`You`, email: "", role: "owner" }]);
      setStep(2);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("PROJECT_LIMIT_REACHED")) {
        setCreateError("limit");
      } else {
        setCreateError(t`Failed to create project. Please try again.`);
      }
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim() || !createdOrgId) return;
    setInviteError(null);
    try {
      await inviteByEmail.mutateAsync({ orgId: createdOrgId, email: inviteEmail.trim() });
      setAddedMembers((prev) => [
        ...prev,
        { name: inviteEmail.trim(), email: inviteEmail.trim(), role: "collaborator" },
      ]);
      setInviteEmail("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("USER_NOT_FOUND")) {
        setInviteError(t`No account found with that email address.`);
      } else if (msg.includes("ALREADY_MEMBER")) {
        setInviteError(t`That person is already a member.`);
      } else if (msg.includes("MEMBER_LIMIT_REACHED")) {
        setInviteError("member-limit");
      } else {
        setInviteError(t`Failed to invite member. Please try again.`);
      }
    }
  }

  function goToProject() {
    if (createdProject) {
      router.push(`/projects/${createdProject.id}/collaborators`);
    }
  }

  if (step === 2 && createdProject) {
    return (
      <div className="flex w-full max-w-md flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t`Invite team members`}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t`Add people who should have access to this project.`}
          </p>
        </div>

        <form onSubmit={handleInvite} className="flex gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder={t`Email address`}
            className="input flex-1"
          />
          <button
            type="submit"
            disabled={inviteByEmail.isPending || !inviteEmail.trim()}
            className="btn-primary shrink-0"
          >
            {inviteByEmail.isPending ? t`Inviting...` : t`Invite`}
          </button>
        </form>

        {inviteError === "member-limit" ? (
          <p className="text-sm text-destructive">
            {t`You have reached the member limit on the free plan.`}{" "}
            <Link href="/settings/billing" className="underline">
              {t`Upgrade to Pro`}
            </Link>{" "}
            {t`for unlimited members.`}
          </p>
        ) : inviteError ? (
          <p className="text-sm text-destructive">{inviteError}</p>
        ) : null}

        {addedMembers.length > 0 && (
          <ul className="flex flex-col gap-2">
            {addedMembers.map((m, i) => (
              <li key={i} className="flex items-center gap-3 rounded-lg border border-border p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium uppercase">
                  {(m.name || m.email).charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.name || m.email}</p>
                  {m.email && m.name !== m.email && (
                    <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    m.role === "owner"
                      ? "bg-accent text-accent-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {m.role === "owner" ? t`Owner` : t`Collaborator`}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={goToProject} className="btn-primary">
            {t`Go to project`}
          </button>
          <button
            type="button"
            onClick={goToProject}
            className="btn-secondary"
          >
            {t`Skip for now`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t`Create a new project`}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t`A project is a workspace for your translation files and team.`}
        </p>
      </div>

      <form onSubmit={handleCreate} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="project-name" className="text-sm font-medium">
            {t`Project name`}
          </label>
          <input
            id="project-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t`My project`}
            required
            autoFocus
            className="input"
          />
          {slug && (
            <p className="text-xs text-muted-foreground">
              {t`Slug:`} <span className="font-mono">{slug}</span>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="source-locale" className="text-sm font-medium">
            {t`Source language`}
          </label>
          <SelectCombobox
            id="source-locale"
            value={sourceLocale}
            onValueChange={handleSourceLocaleChange}
            options={LANGUAGES.map(({ code, name }) => ({
              value: code,
              label: `${name} (${code})`,
            }))}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div>
            <p className="text-sm font-medium">{t`Target languages`}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t`Languages your project will be translated into.`}
            </p>
          </div>

          {targetLocales.length > 0 ? (
            <ul className="space-y-1.5">
              {targetLocales.map((locale) => {
                const label = getLanguageName(locale) || locale;
                return (
                  <li
                    key={locale}
                    className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2"
                  >
                    <span className="text-sm">
                      {label}
                      <span className="ml-2 font-mono text-xs text-muted-foreground">
                        {locale}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTargetLocale(locale)}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label={t`Remove language`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          <SelectCombobox
            value=""
            onValueChange={(code) => {
              if (code) handleAddTargetLocale(code);
            }}
            placeholder={t`Select a language to add...`}
            options={availableToAdd.map(({ code, name }) => ({
              value: code,
              label: `${name} (${code})`,
            }))}
          />
        </div>

        {createError === "limit" ? (
          <p className="text-sm text-destructive">
            {t`You have reached the project limit on the free plan.`}{" "}
            <Link href="/settings/billing" className="underline">
              {t`Upgrade to Pro`}
            </Link>{" "}
            {t`to create unlimited projects.`}
          </p>
        ) : createError ? (
          <p className="text-sm text-destructive">{createError}</p>
        ) : null}

        <button type="submit" disabled={creating || !name.trim()} className="btn-primary">
          {creating ? t`Creating...` : t`Create project`}
        </button>
      </form>
    </div>
  );
}

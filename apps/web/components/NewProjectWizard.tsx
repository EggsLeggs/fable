"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import type { DbProject } from "@fable/db";

const COMMON_LOCALES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "zh", label: "Chinese" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "pt", label: "Portuguese" },
  { value: "it", label: "Italian" },
  { value: "ru", label: "Russian" },
  { value: "ar", label: "Arabic" },
  { value: "nl", label: "Dutch" },
  { value: "pl", label: "Polish" },
  { value: "sv", label: "Swedish" },
  { value: "tr", label: "Turkish" },
];

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
      });
      setCreatedProject(project);
      setCreatedOrgId(org.id);
      setAddedMembers([{ name: "You", email: "", role: "owner" }]);
      setStep(2);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("PROJECT_LIMIT_REACHED")) {
        setCreateError("limit");
      } else {
        setCreateError("Failed to create project. Please try again.");
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
        setInviteError("No account found with that email address.");
      } else if (msg.includes("ALREADY_MEMBER")) {
        setInviteError("That person is already a member.");
      } else if (msg.includes("MEMBER_LIMIT_REACHED")) {
        setInviteError("member-limit");
      } else {
        setInviteError("Failed to invite member. Please try again.");
      }
    }
  }

  function goToProject() {
    if (createdProject) {
      router.push(`/projects/${createdProject.id}/members`);
    }
  }

  if (step === 2 && createdProject) {
    return (
      <div className="flex w-full max-w-md flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invite team members</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Add people who should have access to this project.
          </p>
        </div>

        <form onSubmit={handleInvite} className="flex gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="Email address"
            className="input flex-1"
          />
          <button
            type="submit"
            disabled={inviteByEmail.isPending || !inviteEmail.trim()}
            className="btn-primary shrink-0"
          >
            {inviteByEmail.isPending ? "Inviting..." : "Invite"}
          </button>
        </form>

        {inviteError === "member-limit" ? (
          <p className="text-sm text-destructive">
            You have reached the member limit on the free plan.{" "}
            <Link href="/settings/billing" className="underline">
              Upgrade to Pro
            </Link>{" "}
            for unlimited members.
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
                  {m.role === "owner" ? "Owner" : "Collaborator"}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={goToProject} className="btn-primary">
            Go to project
          </button>
          <button
            type="button"
            onClick={goToProject}
            className="btn-secondary"
          >
            Skip for now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Create a new project</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A project is a workspace for your translation files and team.
        </p>
      </div>

      <form onSubmit={handleCreate} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="project-name" className="text-sm font-medium">
            Project name
          </label>
          <input
            id="project-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My project"
            required
            autoFocus
            className="input"
          />
          {slug && (
            <p className="text-xs text-muted-foreground">
              Slug: <span className="font-mono">{slug}</span>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="source-locale" className="text-sm font-medium">
            Source language
          </label>
          <select
            id="source-locale"
            value={sourceLocale}
            onChange={(e) => setSourceLocale(e.target.value)}
            className="input"
          >
            {COMMON_LOCALES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {createError === "limit" ? (
          <p className="text-sm text-destructive">
            You have reached the project limit on the free plan.{" "}
            <Link href="/settings/billing" className="underline">
              Upgrade to Pro
            </Link>{" "}
            to create unlimited projects.
          </p>
        ) : createError ? (
          <p className="text-sm text-destructive">{createError}</p>
        ) : null}

        <button type="submit" disabled={creating || !name.trim()} className="btn-primary">
          {creating ? "Creating..." : "Create project"}
        </button>
      </form>
    </div>
  );
}

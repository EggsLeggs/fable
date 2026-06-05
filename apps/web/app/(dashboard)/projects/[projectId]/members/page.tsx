"use client";

import { use, useState } from "react";
import { X, Loader2 } from "lucide-react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";

type Props = { params: Promise<{ projectId: string }> };

export default function MembersPage({ params }: Props) {
  const { projectId } = use(params);

  const userQuery = trpc.user.me.useQuery();
  const currentUserId = userQuery.data?.id;

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);

  const projectQuery = trpc.project.getById.useQuery({ id: projectId });
  const orgId = projectQuery.data?.orgId;

  const orgQuery = trpc.organization.getById.useQuery(
    { id: orgId ?? "" },
    { enabled: !!orgId }
  );

  const utils = trpc.useUtils();

  const removeMember = trpc.organization.removeMember.useMutation({
    onSuccess: () => utils.organization.getById.invalidate({ id: orgId }),
  });

  const inviteByEmail = trpc.organization.inviteByEmail.useMutation({
    onSuccess: () => {
      utils.organization.getById.invalidate({ id: orgId });
      setInviteEmail("");
      setInviteError(null);
    },
    onError: (err) => {
      const msg = err.message;
      if (msg.includes("USER_NOT_FOUND")) {
        setInviteError("No account found with that email address.");
      } else if (msg.includes("ALREADY_MEMBER")) {
        setInviteError("That person is already a member.");
      } else if (msg.includes("MEMBER_LIMIT_REACHED")) {
        setInviteError("member-limit");
      } else {
        setInviteError("Failed to invite member. Please try again.");
      }
    },
  });

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim() || !orgId) return;
    setInviteError(null);
    inviteByEmail.mutate({ orgId, email: inviteEmail.trim() });
  }

  const org = orgQuery.data;
  const members = org?.members ?? [];

  const currentUserMember = members.find((m) => m.userId === currentUserId);
  const isOwner = currentUserMember?.role === "owner";

  const isLoading = projectQuery.isPending || orgQuery.isPending;

  if (isLoading) {
    return (
      <div className="flex w-full flex-1 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (projectQuery.isError || orgQuery.isError) {
    return (
      <div className="flex w-full flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Failed to load project.</p>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-1 flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Members</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage who has access to this project.
        </p>
      </header>

      {isOwner && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Invite by email</h2>
          <form onSubmit={handleInvite} className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => {
                setInviteEmail(e.target.value);
                setInviteError(null);
              }}
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
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">
          {members.length} {members.length === 1 ? "member" : "members"}
        </h2>
        <ul className="flex flex-col gap-2">
          {members.map((member) => {
            const displayName = member.user.name || member.user.email;
            const isSelf = member.userId === currentUserId;
            const memberRole = member.role === "owner" ? "Owner" : "Collaborator";
            const canRemove = isOwner && !isSelf && member.role !== "owner";

            return (
              <li
                key={member.id}
                className="flex items-center gap-3 rounded-lg border border-border p-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium uppercase">
                  {displayName.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{displayName}</p>
                  {member.user.name && (
                    <p className="truncate text-xs text-muted-foreground">{member.user.email}</p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    member.role === "owner"
                      ? "bg-accent text-accent-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {memberRole}
                </span>
                {canRemove && (
                  <button
                    type="button"
                    onClick={() =>
                      removeMember.mutate({ orgId: orgId!, userId: member.userId })
                    }
                    disabled={removeMember.isPending}
                    className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Remove member"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

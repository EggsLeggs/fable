"use client";

import { use, useState } from "react";
import { X, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { trpc } from "@/lib/trpc/client";
import { UserAvatar } from "@/components/UserAvatar";

type Props = { params: Promise<{ projectId: string }> };

type OrgMember = {
  user: {
    name: string;
    email: string;
    image: string | null;
    username: string | null;
  };
};

function memberAvatarLabel(member: OrgMember["user"], isTeamMember: boolean): string {
  if (!isTeamMember) {
    return member.username ? `@${member.username}` : "?";
  }
  return member.name || member.email;
}

function memberPrimaryLine(member: OrgMember["user"], isTeamMember: boolean) {
  if (!isTeamMember) {
    return (
      <p className="truncate text-sm font-medium">
        {member.username ? `@${member.username}` : "?"}
      </p>
    );
  }

  const name = member.name || member.email;
  return (
    <p className="truncate text-sm font-medium">
      {name}
      {member.username && (
        <span className="font-normal text-muted-foreground"> @{member.username}</span>
      )}
    </p>
  );
}

function InviteForm({
  onInvite,
  isPending,
  placeholder,
  buttonLabel,
  pendingLabel,
}: {
  onInvite: (email: string) => void;
  isPending: boolean;
  placeholder: string;
  buttonLabel: string;
  pendingLabel: string;
}) {
  const [email, setEmail] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    onInvite(email.trim());
    setEmail("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={placeholder}
        className="input flex-1"
      />
      <button
        type="submit"
        disabled={isPending || !email.trim()}
        className="btn-primary shrink-0"
      >
        {isPending ? pendingLabel : buttonLabel}
      </button>
    </form>
  );
}

export default function CollaboratorsPage({ params }: Props) {
  const { projectId } = use(params);

  const userQuery = trpc.user.me.useQuery();
  const currentUserId = userQuery.data?.id;

  const projectQuery = trpc.project.getById.useQuery({ id: projectId });
  const orgId = projectQuery.data?.orgId;

  const orgQuery = trpc.organization.getById.useQuery(
    { id: orgId ?? "" },
    { enabled: !!orgId }
  );

  const utils = trpc.useUtils();

  const removeMember = trpc.organization.removeMember.useMutation({
    onSuccess: () => {
      void utils.organization.getById.invalidate({ id: orgId });
      toast.success(t`Member removed.`);
    },
    onError: (err) => toast.error(err.message ?? t`Could not remove member.`),
  });

  const inviteByEmail = trpc.organization.inviteByEmail.useMutation({
    onSuccess: () => {
      void utils.organization.getById.invalidate({ id: orgId });
      toast.success(t`Invite sent.`);
    },
    onError: (err) => {
      const msg = err.message;
      if (msg.includes("USER_NOT_FOUND")) {
        toast.error(t`No account found with that email address.`);
      } else if (msg.includes("ALREADY_MEMBER")) {
        toast.error(t`That person is already a member.`);
      } else if (msg.includes("MEMBER_LIMIT_REACHED")) {
        toast.error(t`Member limit reached.`);
      } else {
        toast.error(t`Failed to invite. Please try again.`);
      }
    },
  });

  const inviteTranslator = trpc.organization.inviteTranslatorByEmail.useMutation({
    onSuccess: () => {
      void utils.organization.getById.invalidate({ id: orgId });
      toast.success(t`Translator added.`);
    },
    onError: (err) => {
      const msg = err.message;
      if (msg.includes("USER_NOT_FOUND")) {
        toast.error(t`No account found with that email address.`);
      } else if (msg.includes("ALREADY_MEMBER")) {
        toast.error(t`That person is already a collaborator or translator.`);
      } else {
        toast.error(t`Failed to add translator. Please try again.`);
      }
    },
  });

  const removeTranslator = trpc.organization.removeTranslator.useMutation({
    onSuccess: () => {
      void utils.organization.getById.invalidate({ id: orgId });
      toast.success(t`Translator removed.`);
    },
    onError: (err) => toast.error(err.message ?? t`Could not remove translator.`),
  });

  const org = orgQuery.data;
  const allMembers = org?.members ?? [];

  const teamMembers = allMembers.filter((m) => m.role !== "translator");
  const translators = allMembers.filter((m) => m.role === "translator");

  const currentUserMember = allMembers.find((m) => m.userId === currentUserId);
  const isOwner = currentUserMember?.role === "owner";
  const isTeamMember = currentUserMember?.role !== "translator" && !!currentUserMember;

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
        <p className="text-sm text-muted-foreground">{t`Failed to load project.`}</p>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-1 flex-col gap-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t`Collaborators`}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t`Manage who has access to this project.`}
        </p>
      </header>

      {/* Team members */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold">{t`Team`}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t`Team members have full access to the project.`}
          </p>
        </div>

        {isOwner && (
          <div className="flex flex-col gap-2">
            <InviteForm
              onInvite={(email) => {
                if (!orgId) return;
                inviteByEmail.mutate({ orgId, email });
              }}
              isPending={inviteByEmail.isPending}
              placeholder={t`Email address`}
              buttonLabel={t`Invite`}
              pendingLabel={t`Inviting...`}
            />
            {inviteByEmail.isError &&
              inviteByEmail.error.message.includes("MEMBER_LIMIT_REACHED") && (
                <p className="text-sm text-destructive">
                  <Trans>
                    You have reached the member limit on the free plan.{" "}
                    <Link href="/settings/billing" className="underline">
                      Upgrade to Pro
                    </Link>{" "}
                    for unlimited members.
                  </Trans>
                </p>
              )}
          </div>
        )}

        <ul className="flex flex-col gap-2">
          {teamMembers.map((member) => {
            const isSelf = member.userId === currentUserId;
            const canRemove = isOwner && !isSelf && member.role !== "owner";

            return (
              <li
                key={member.id}
                className="flex items-center gap-3 rounded-lg border border-border p-3"
              >
                <UserAvatar
                  name={memberAvatarLabel(member.user, isTeamMember)}
                  email={isTeamMember ? member.user.email : undefined}
                  src={member.user.image}
                  className="h-8 w-8"
                />
                <div className="min-w-0 flex-1">
                  {memberPrimaryLine(member.user, isTeamMember)}
                  {isOwner && isTeamMember && member.user.email && (
                    <p className="truncate text-xs text-muted-foreground">
                      {member.user.email}
                    </p>
                  )}
                </div>
                {member.role === "owner" && (
                  <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                    {t`Owner`}
                  </span>
                )}
                {canRemove && (
                  <button
                    type="button"
                    onClick={() =>
                      removeMember.mutate({ orgId: orgId!, userId: member.userId })
                    }
                    disabled={removeMember.isPending}
                    className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title={t`Remove member`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Translators */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold">{t`Translators`}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t`Translators can contribute translations to this project.`}
          </p>
        </div>

        {isTeamMember && (
          <InviteForm
            onInvite={(email) => {
              if (!orgId) return;
              inviteTranslator.mutate({ orgId, email });
            }}
            isPending={inviteTranslator.isPending}
            placeholder={t`Email address`}
            buttonLabel={t`Add translator`}
            pendingLabel={t`Adding...`}
          />
        )}

        {translators.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t`No translators yet.`}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {translators.map((member) => {
              const canRemove = isTeamMember;

              return (
                <li
                  key={member.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-3"
                >
                  <UserAvatar
                    name={memberAvatarLabel(member.user, isTeamMember)}
                    email={isTeamMember ? member.user.email : undefined}
                    src={member.user.image}
                    className="h-8 w-8"
                  />
                  <div className="min-w-0 flex-1">
                    {memberPrimaryLine(member.user, isTeamMember)}
                    {isOwner && isTeamMember && member.user.email && (
                      <p className="truncate text-xs text-muted-foreground">
                        {member.user.email}
                      </p>
                    )}
                  </div>
                  {canRemove && (
                    <button
                      type="button"
                      onClick={() =>
                        removeTranslator.mutate({ orgId: orgId!, userId: member.userId })
                      }
                      disabled={removeTranslator.isPending}
                      className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title={t`Remove translator`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

"use client";

import { use, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { trpc } from "@/lib/trpc/client";

type Props = { params: Promise<{ token: string }> };

export default function JoinPage({ params }: Props) {
  const { token } = use(params);
  const router = useRouter();
  const acceptedRef = useRef(false);

  const userQuery = trpc.user.me.useQuery(undefined, { retry: false });
  const inviteQuery = trpc.project.validateInviteToken.useQuery({ token });

  const acceptInvite = trpc.project.acceptInvite.useMutation({
    onSuccess: () => {
      router.push("/dashboard");
    },
  });

  const isLoggedIn = userQuery.isSuccess && !!userQuery.data;
  const invite = inviteQuery.data;
  const joinPath = `/join/${token}`;
  const loginHref = `/login?callbackUrl=${encodeURIComponent(joinPath)}`;
  const signupHref = `/signup?callbackUrl=${encodeURIComponent(joinPath)}`;

  useEffect(() => {
    if (
      !isLoggedIn ||
      !invite?.valid ||
      acceptedRef.current ||
      acceptInvite.isPending ||
      acceptInvite.isSuccess
    ) {
      return;
    }

    acceptedRef.current = true;
    acceptInvite.mutate({ token });
  }, [isLoggedIn, invite?.valid, token, acceptInvite]);

  if (inviteQuery.isLoading || userQuery.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!invite?.valid) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center">
          <h1 className="text-xl font-bold tracking-tight">{t`Invite link invalid`}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t`This invite link is invalid or has been disabled.`}
          </p>
          <Link href="/dashboard" className="btn-primary mt-6 inline-block text-sm">
            {t`Go to dashboard`}
          </Link>
        </div>
      </main>
    );
  }

  if (!isLoggedIn) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center">
          <h1 className="text-xl font-bold tracking-tight">{t`You are invited`}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {invite.role === "member" ? (
              <Trans>
                Join <strong className="text-foreground">{invite.orgName}</strong> as a team
                member.
              </Trans>
            ) : (
              <Trans>
                Join <strong className="text-foreground">{invite.orgName}</strong> as a translator.
              </Trans>
            )}
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link href={loginHref} className="btn-primary text-sm">
              {t`Log in to join`}
            </Link>
            <Link href={signupHref} className="btn-secondary text-sm">
              {t`Sign up to join`}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (acceptInvite.isError) {
    const msg = acceptInvite.error.message;
    if (msg.includes("ALREADY_MEMBER")) {
      return (
        <main className="flex min-h-screen flex-col items-center justify-center px-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center">
            <h1 className="text-xl font-bold tracking-tight">{t`Already a member`}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t`You are already part of this workspace.`}
            </p>
            <Link href="/dashboard" className="btn-primary mt-6 inline-block text-sm">
              {t`Go to dashboard`}
            </Link>
          </div>
        </main>
      );
    }

    if (msg.includes("MEMBER_LIMIT_REACHED")) {
      return (
        <main className="flex min-h-screen flex-col items-center justify-center px-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center">
            <h1 className="text-xl font-bold tracking-tight">{t`Cannot join`}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t`This workspace has reached its member limit.`}
            </p>
            <Link href="/dashboard" className="btn-primary mt-6 inline-block text-sm">
              {t`Go to dashboard`}
            </Link>
          </div>
        </main>
      );
    }

    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center">
          <h1 className="text-xl font-bold tracking-tight">{t`Could not join`}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t`Something went wrong. Please try again.`}
          </p>
          <button
            type="button"
            onClick={() => {
              acceptedRef.current = false;
              acceptInvite.mutate({ token });
            }}
            className="btn-primary mt-6 text-sm"
          >
            {t`Try again`}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </main>
  );
}

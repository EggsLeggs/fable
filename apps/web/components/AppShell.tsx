import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth, type AuthUser } from "@fable/auth";
import { AppSidebar } from "@/components/AppSidebar";
import { resolveUserAvatarUrl } from "@/lib/gravatar";

export const dashboardContentClassName =
  "mx-auto flex min-h-0 w-full max-w-[1100px] flex-1 flex-col p-8 px-5 md:px-28 md:py-12";

type Props = {
  children: React.ReactNode;
  contentClassName?: string;
};

export async function AppShell({ children, contentClassName }: Props) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/login");
  }

  const authUser = session.user as AuthUser & { username?: string | null };
  const userName = authUser.name?.trim() || authUser.email || "User";
  const userHandle = authUser.username ?? null;
  const userEmail = session.user.email ?? "";
  const userAvatarUrl = resolveUserAvatarUrl(session.user.image, userEmail);

  return (
    <div className="flex h-dvh overflow-hidden bg-sidebar text-foreground md:py-3 md:pr-3">
      <AppSidebar
        userName={userName}
        userHandle={userHandle}
        userEmail={userEmail}
        userAvatarUrl={userAvatarUrl}
      />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div
          className={
            contentClassName
              ? "relative flex h-full min-h-0 flex-1 flex-col overflow-auto rounded-none border-0 bg-background md:rounded-lg md:border md:border-border"
              : "relative flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-none border-0 bg-background md:rounded-lg md:border md:border-border"
          }
        >
          {contentClassName ? (
            <div className={contentClassName}>{children}</div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
          )}
        </div>
      </main>
    </div>
  );
}

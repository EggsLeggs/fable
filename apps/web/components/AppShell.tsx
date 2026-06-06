import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth, type AuthUser } from "@fable/auth";
import { DashboardChrome } from "@/components/DashboardChrome";
import { resolveUserAvatarUrl } from "@/lib/gravatar";

export const dashboardContentClassName =
  "mx-auto flex min-h-0 w-full max-w-[1100px] flex-1 flex-col px-4 py-5 md:px-28 md:py-12";

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
    <DashboardChrome
      contentClassName={contentClassName}
      userName={userName}
      userHandle={userHandle}
      userEmail={userEmail}
      userAvatarUrl={userAvatarUrl}
    >
      {children}
    </DashboardChrome>
  );
}

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@fable/auth";
import { AppSidebar } from "@/components/AppSidebar";

export const dashboardContentClassName =
  "mx-auto flex h-full min-w-0 w-full max-w-[1100px] flex-1 flex-col overflow-auto p-8 px-5 md:px-28 md:py-12";

type Props = {
  children: React.ReactNode;
  contentClassName?: string;
};

export async function AppShell({ children, contentClassName }: Props) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/login");
  }

  const userName = session.user.name ?? session.user.email?.split("@")[0] ?? "User";

  return (
    <div className="flex h-dvh overflow-hidden bg-sidebar text-foreground md:py-3 md:pr-3">
      <AppSidebar
        orgName={userName}
        userName={userName}
        userEmail={session.user.email ?? ""}
      />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-none border-0 bg-background md:rounded-lg md:border md:border-border">
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

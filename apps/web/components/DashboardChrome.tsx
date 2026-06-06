"use client";

import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { AppMobileNav } from "@/components/AppMobileNav";
import { ProjectCommandMenu } from "@/components/ProjectCommandMenu";
import { isTypingTarget } from "@/lib/app-nav-items";

type Props = {
  children: React.ReactNode;
  contentClassName?: string;
  userName: string;
  userHandle: string | null;
  userEmail: string;
  userAvatarUrl: string | null;
};

export function DashboardChrome({
  children,
  contentClassName,
  userName,
  userHandle,
  userEmail,
  userAvatarUrl,
}: Props) {
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandMenuOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex h-dvh overflow-hidden bg-sidebar text-foreground md:py-3 md:pr-3">
      <AppSidebar
        userName={userName}
        userHandle={userHandle}
        userEmail={userEmail}
        userAvatarUrl={userAvatarUrl}
        onSearchClick={() => setCommandMenuOpen(true)}
      />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AppMobileNav
          userName={userName}
          userHandle={userHandle}
          userEmail={userEmail}
          userAvatarUrl={userAvatarUrl}
          onSearchClick={() => setCommandMenuOpen(true)}
        />
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
      <ProjectCommandMenu open={commandMenuOpen} onOpenChange={setCommandMenuOpen} />
    </div>
  );
}

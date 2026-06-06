"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, Search } from "lucide-react";
import { t } from "@lingui/core/macro";
import { UserMenu } from "@/components/UserMenu";
import { SidebarAdCard } from "@/components/SidebarAdCard";
import { ProjectSwitcher } from "@/components/ProjectSwitcher";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { trpc } from "@/lib/trpc/client";
import {
  getAppNavItems,
  getMobileNavTitle,
  navIconClass,
  projectIdFromPathname,
} from "@/lib/app-nav-items";

type Props = {
  userName: string;
  userHandle: string | null;
  userEmail: string;
  userAvatarUrl: string | null;
  onSearchClick: () => void;
};

export function AppMobileNav({
  userName,
  userHandle,
  userEmail,
  userAvatarUrl,
  onSearchClick,
}: Props) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const { data: projects = [] } = trpc.project.listAll.useQuery();
  const projectId = projectIdFromPathname(pathname);
  const displayProjectId = projectId ?? projects[0]?.id ?? null;
  const navItems = getAppNavItems();
  const title = getMobileNavTitle(pathname);

  return (
    <>
      <header className="flex shrink-0 items-center gap-2 border-b border-border bg-background px-3 py-2 md:hidden">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setMenuOpen(true)}
          aria-label={t`Open menu`}
        >
          <Menu className="h-4 w-4" />
        </Button>

        <Link
          href="/dashboard"
          className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight text-foreground"
        >
          {title}
        </Link>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onSearchClick}
          aria-label={t`Search projects`}
        >
          <Search className="h-4 w-4" />
        </Button>
      </header>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="min-h-0 p-0">
          <SheetHeader>
            <SheetTitle>
              <Link href="/dashboard" onClick={() => setMenuOpen(false)}>
                fable
              </Link>
            </SheetTitle>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="relative flex shrink-0 items-center gap-1 px-2 pb-2">
              <ProjectSwitcher collapsed={false} />
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onSearchClick();
                }}
                title={t`Search projects`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <Search className="h-3.5 w-3.5" />
              </button>
            </div>

            <Separator className="mx-2 shrink-0 bg-sidebar-border" />

            <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 py-2">
              {displayProjectId &&
                navItems.map(({ href, label, Icon }) => {
                  const base = `/projects/${displayProjectId}/${href}`;
                  const active = pathname === base || pathname.startsWith(`${base}/`);
                  return (
                    <Link
                      key={href}
                      href={`/projects/${displayProjectId}/${href}`}
                      onClick={() => setMenuOpen(false)}
                      className={`group flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors ${
                        active
                          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      }`}
                    >
                      <Icon className={navIconClass} />
                      <span className="min-w-0 flex-1 truncate">{label}</span>
                    </Link>
                  );
                })}
            </nav>

            <div className="shrink-0 px-2 pb-4 pt-2">
              <SidebarAdCard collapsed={false} />
              <UserMenu
                userName={userName}
                userHandle={userHandle}
                userEmail={userEmail}
                userAvatarUrl={userAvatarUrl}
                collapsed={false}
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

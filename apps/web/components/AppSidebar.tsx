"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  PanelLeftClose,
  PanelLeft,
  Search,
} from "lucide-react";
import { useState } from "react";
import { t } from "@lingui/core/macro";
import { UserMenu } from "@/components/UserMenu";
import { SidebarAdCard } from "@/components/SidebarAdCard";
import { FableIcon } from "@/components/FableIcon";
import { ProjectSwitcher } from "@/components/ProjectSwitcher";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc/client";
import {
  getAppNavItems,
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

export function AppSidebar({
  userName,
  userHandle,
  userEmail,
  userAvatarUrl,
  onSearchClick,
}: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const { data: projects = [] } = trpc.project.listAll.useQuery();
  const projectId = projectIdFromPathname(pathname);
  const displayProjectId = projectId ?? projects[0]?.id ?? null;
  const navItems = getAppNavItems();

  return (
    <aside
      className={`hidden h-full shrink-0 flex-col bg-sidebar transition-all md:flex ${
        collapsed ? "w-14" : "w-64"
      }`}
    >
      <div
        className={`flex shrink-0 items-center gap-2 p-2 ${
          collapsed ? "justify-center" : "justify-between pb-2"
        }`}
      >
        {!collapsed && (
          <Link
            href="/dashboard"
            aria-label="Fable"
            className="flex items-center gap-2 px-2 text-sm font-bold tracking-tight text-sidebar-foreground"
          >
            <FableIcon className="h-5 w-auto shrink-0" />
            <span>fable</span>
          </Link>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className={`group rounded p-1 text-muted-foreground hover:bg-sidebar-accent ${
            collapsed ? "" : "ml-auto"
          }`}
          aria-label={collapsed ? t`Expand sidebar` : t`Collapse sidebar`}
        >
          {collapsed ? (
            <PanelLeft className={navIconClass} />
          ) : (
            <PanelLeftClose className={navIconClass} />
          )}
        </button>
      </div>

      <Separator className="mx-2 shrink-0 bg-sidebar-border" />

      <div
        className={`relative flex shrink-0 items-center gap-1 px-2 pb-2 pt-2 ${
          collapsed ? "justify-center" : ""
        }`}
      >
        <ProjectSwitcher collapsed={collapsed} />
        {!collapsed && (
          <button
            type="button"
            onClick={onSearchClick}
            title={t`Search projects (⌘K)`}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <Search className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 pt-2">
        {displayProjectId &&
          navItems.map(({ href, label, Icon }) => {
            const base = `/projects/${displayProjectId}/${href}`;
            const active = pathname === base || pathname.startsWith(`${base}/`);
            return (
              <Link
                key={href}
                href={`/projects/${displayProjectId}/${href}`}
                title={collapsed ? label : undefined}
                className={`group flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors ${
                  collapsed ? "justify-center" : "w-full"
                } ${
                  active
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon className={navIconClass} />
                {!collapsed && (
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                )}
              </Link>
            );
          })}
      </nav>

      <div className="shrink-0 px-2 pb-2 pt-2">
        <SidebarAdCard collapsed={collapsed} />
        <UserMenu
          userName={userName}
          userHandle={userHandle}
          userEmail={userEmail}
          userAvatarUrl={userAvatarUrl}
          collapsed={collapsed}
        />
      </div>
    </aside>
  );
}

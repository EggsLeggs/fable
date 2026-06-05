"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  PanelLeftClose,
  PanelLeft,
  Search,
  LayoutDashboard,
  Database,
  Languages,
  MessageSquare,
  ListChecks,
  Plug,
  Activity,
  Settings,
} from "lucide-react";
import { useEffect, useState } from "react";
import { UserMenu } from "@/components/UserMenu";
import { ProjectSwitcher } from "@/components/ProjectSwitcher";
import { ProjectCommandMenu } from "@/components/ProjectCommandMenu";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc/client";

const iconClass =
  "h-4 w-4 shrink-0 transition-transform duration-200 ease-out group-hover:scale-110";

type Props = {
  userName: string;
  userEmail: string;
  userAvatarUrl: string | null;
};

function projectIdFromPathname(pathname: string): string | null {
  const match = pathname.match(/^\/projects\/([^/]+)/);
  const id = match?.[1];
  if (!id || id === "new") return null;
  return id;
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

export function AppSidebar({ userName, userEmail, userAvatarUrl }: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);

  const { data: projects = [] } = trpc.project.listAll.useQuery();
  const projectId = projectIdFromPathname(pathname);
  const displayProjectId = projectId ?? projects[0]?.id ?? null;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandMenuOpen(true);
        return;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <aside
        className={`flex h-full shrink-0 flex-col bg-sidebar transition-all max-md:border-r max-md:border-sidebar-border ${
          collapsed ? "w-14" : "w-64"
        }`}
      >
        <div
          className={`flex items-center gap-2 p-2 ${
            collapsed ? "justify-center" : "justify-between pb-2"
          }`}
        >
          {!collapsed && (
            <Link
              href="/dashboard"
              className="px-2 text-sm font-bold tracking-tight text-sidebar-foreground"
            >
              fable
            </Link>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className={`group rounded p-1 text-muted-foreground hover:bg-sidebar-accent ${
              collapsed ? "" : "ml-auto"
            }`}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeft className={iconClass} />
            ) : (
              <PanelLeftClose className={iconClass} />
            )}
          </button>
        </div>

        <div
          className={`relative flex items-center gap-1 px-2 pb-2 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <ProjectSwitcher
            collapsed={collapsed}
            onSearchOpen={() => setCommandMenuOpen(true)}
          />
          {!collapsed && (
            <button
              type="button"
              onClick={() => setCommandMenuOpen(true)}
              title="Search projects (⌘K)"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <Search className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <Separator className="mx-2 bg-sidebar-border" />

        <nav className="flex flex-1 flex-col gap-1 px-2 pt-2">
          {displayProjectId && (
            <>
              {(
                [
                  { href: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
                  { href: "strings", label: "Strings", Icon: MessageSquare },
                  { href: "sources", label: "Sources", Icon: Database },
                  { href: "translations", label: "Translations", Icon: Languages },
                  { href: "tasks", label: "Tasks", Icon: ListChecks },
                  { href: "integrations", label: "Integrations", Icon: Plug },
                  { href: "activity", label: "Activity", Icon: Activity },
                  { href: "members", label: "Members", Icon: Users },
                  { href: "settings", label: "Settings", Icon: Settings },
                ] as const
              ).map(({ href, label, Icon }) => {
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
                    <Icon className={iconClass} />
                    {!collapsed && (
                      <span className="min-w-0 flex-1 truncate">{label}</span>
                    )}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        <div className="px-2 pt-2">
          <UserMenu
            userName={userName}
            userEmail={userEmail}
            userAvatarUrl={userAvatarUrl}
            collapsed={collapsed}
          />
        </div>
      </aside>

      <ProjectCommandMenu open={commandMenuOpen} onOpenChange={setCommandMenuOpen} />
    </>
  );
}

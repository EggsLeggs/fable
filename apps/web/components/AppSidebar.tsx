"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid,
  Settings,
  PanelLeftClose,
  PanelLeft,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { UserMenu } from "@/components/UserMenu";
import { Separator } from "@/components/ui/separator";
import { Kbd } from "@/components/ui/kbd";

const iconClass =
  "h-4 w-4 shrink-0 transition-transform duration-200 ease-out group-hover:scale-110";

type Props = {
  orgName: string;
  userName: string;
  userEmail: string;
};

const nav: { href: string; label: string; icon: LucideIcon; shortcut: string }[] = [
  { href: "/dashboard", label: "Projects", icon: LayoutGrid, shortcut: "p" },
  { href: "/settings", label: "Settings", icon: Settings, shortcut: "s" },
];

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

export function AppSidebar({ orgName, userName, userEmail }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      const item = nav.find(({ shortcut }) => shortcut === e.key.toLowerCase());
      if (item) {
        e.preventDefault();
        router.push(item.href);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return (
    <aside
      className={`flex h-full shrink-0 flex-col bg-sidebar transition-all max-md:border-r max-md:border-sidebar-border ${
        collapsed ? "w-14" : "w-64"
      }`}
    >
      <div
        className={`flex items-center gap-2 p-2 ${
          collapsed ? "justify-center" : "justify-between pb-4"
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

      {!collapsed && <Separator className="mx-2 bg-sidebar-border" />}

      {!collapsed && (
        <div className="mx-2 mb-4 flex items-center gap-2 px-2 pb-2 pt-4">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-xs font-semibold text-accent-foreground">
            {orgName.charAt(0).toUpperCase()}
          </div>
          <span className="truncate text-sm font-medium text-sidebar-foreground">
            {orgName}
          </span>
        </div>
      )}

      <nav className="flex flex-1 flex-col gap-1 px-2">
        {nav.map(({ href, label, icon: Icon, shortcut }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? `${label} (${shortcut})` : undefined}
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
                <>
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  <Kbd className="ml-auto uppercase opacity-0 transition-opacity group-hover:opacity-100">
                    {shortcut}
                  </Kbd>
                </>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="px-2 pt-2">
        <UserMenu userName={userName} userEmail={userEmail} collapsed={collapsed} />
      </div>
    </aside>
  );
}

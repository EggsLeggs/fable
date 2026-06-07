import {
  LayoutDashboard,
  Database,
  Languages,
  MessageSquare,
  ListChecks,
  Plug,
  Activity,
  Settings,
  Users,
  BookOpen,
  ShieldCheck,
  Brain,
  type LucideIcon,
} from "lucide-react";
import { t } from "@lingui/core/macro";

export const navIconClass =
  "h-4 w-4 shrink-0 transition-transform duration-200 ease-out group-hover:scale-110";

export type AppNavHref =
  | "dashboard"
  | "strings"
  | "sources"
  | "translations"
  | "tasks"
  | "glossary"
  | "qa"
  | "tm"
  | "integrations"
  | "activity"
  | "collaborators"
  | "settings";

export type AppNavItem = {
  href: AppNavHref;
  label: string;
  Icon: LucideIcon;
};

export function getAppNavItems(): AppNavItem[] {
  return [
    { href: "dashboard", label: t`Dashboard`, Icon: LayoutDashboard },
    { href: "strings", label: t`Strings`, Icon: MessageSquare },
    { href: "sources", label: t`Sources`, Icon: Database },
    { href: "translations", label: t`Translations`, Icon: Languages },
    { href: "tasks", label: t`Tasks`, Icon: ListChecks },
    { href: "glossary", label: t`Glossary`, Icon: BookOpen },
    { href: "qa", label: t`QA Checks`, Icon: ShieldCheck },
    { href: "tm", label: t`Translation Memory`, Icon: Brain },
    { href: "integrations", label: t`Integrations`, Icon: Plug },
    { href: "activity", label: t`Activity`, Icon: Activity },
    { href: "collaborators", label: t`Collaborators`, Icon: Users },
    { href: "settings", label: t`Settings`, Icon: Settings },
  ];
}

export function projectIdFromPathname(pathname: string): string | null {
  const match = pathname.match(/^\/projects\/([^/]+)/);
  const id = match?.[1];
  if (!id || id === "new") return null;
  return id;
}

export function getMobileNavTitle(pathname: string): string {
  if (pathname.startsWith("/settings")) return t`Settings`;
  if (pathname === "/dashboard") return t`Dashboard`;
  if (pathname === "/projects/new") return t`New project`;

  const projectId = projectIdFromPathname(pathname);
  if (!projectId) return "fable";

  const navItems = getAppNavItems();
  for (const { href, label } of navItems) {
    const base = `/projects/${projectId}/${href}`;
    if (pathname === base || pathname.startsWith(`${base}/`)) {
      return label;
    }
  }

  return "fable";
}

export function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

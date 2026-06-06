"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronDown, Plus } from "lucide-react";
import { t } from "@lingui/core/macro";
import { trpc } from "@/lib/trpc/client";
import { ProjectAvatar } from "@/components/ProjectAvatar";
import { SidebarDropdownPanel } from "@/components/SidebarDropdownPanel";
import Link from "next/link";

type Props = {
  collapsed: boolean;
};

function projectIdFromPathname(pathname: string): string | null {
  const match = pathname.match(/^\/projects\/([^/]+)/);
  const id = match?.[1];
  if (!id || id === "new") return null;
  return id;
}

export function ProjectSwitcher({ collapsed }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: projects = [] } = trpc.project.listAll.useQuery();
  const { data: usage } = trpc.billing.getUsage.useQuery();

  const activeId = projectIdFromPathname(pathname);
  const activeProject = projects.find((p) => p.id === activeId);
  const displayProject = activeProject ?? projects[0] ?? null;

  const hasProjects = projects.length > 0;

  const isFreePlan = !usage || usage.plan === "free";
  const atLimit = isFreePlan && projects.length >= 1;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function selectProject(id: string) {
    router.push(`/projects/${id}/collaborators`);
    setOpen(false);
  }

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={hasProjects ? () => setOpen((o) => !o) : () => router.push("/projects/new")}
        className="flex h-8 w-8 items-center justify-center rounded-md hover:opacity-80"
        title={displayProject?.name ?? t`Add project`}
      >
        {displayProject ? (
          <ProjectAvatar
            projectId={displayProject.id}
            name={displayProject.name}
            className="h-8 w-8 text-xs"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <Plus className="h-3.5 w-3.5" />
          </div>
        )}
      </button>
    );
  }

  return (
    <div className="contents" ref={ref}>
      <div className="min-w-0 flex-1">
        {hasProjects ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-sidebar-accent"
          >
            <ProjectAvatar
              projectId={displayProject!.id}
              name={displayProject!.name}
              className="h-6 w-6 text-[11px]"
            />
            <span className="min-w-0 flex-1 truncate font-medium text-sidebar-foreground">
              {displayProject!.name}
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </button>
        ) : (
          <Link
            href="/projects/new"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted">
              <Plus className="h-3.5 w-3.5" />
            </div>
            <span className="min-w-0 flex-1 truncate font-medium">{t`Add project`}</span>
          </Link>
        )}
      </div>

      <SidebarDropdownPanel
        open={open}
        origin="top"
        className="absolute inset-x-2 top-full z-50 rounded-lg border border-border bg-popover shadow-lg"
      >
          <div className="max-h-48 overflow-y-auto p-1">
            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => selectProject(project.id)}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs hover:bg-secondary"
              >
                <ProjectAvatar
                  projectId={project.id}
                  name={project.name}
                  className="h-5 w-5 text-[10px]"
                />
                <span className="min-w-0 flex-1 truncate">{project.name}</span>
                {project.id === activeId && (
                  <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                )}
              </button>
            ))}
          </div>

          <div className="border-t border-border p-1">
            {atLimit ? (
              <Link
                href="/settings/billing"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs text-muted-foreground hover:bg-secondary"
              >
                <Plus className="h-3.5 w-3.5" />
                {t`Upgrade to Pro for more projects`}
              </Link>
            ) : (
              <Link
                href="/projects/new"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs hover:bg-secondary"
              >
                <Plus className="h-3.5 w-3.5" />
                {t`New project`}
              </Link>
            )}
          </div>
      </SidebarDropdownPanel>
    </div>
  );
}

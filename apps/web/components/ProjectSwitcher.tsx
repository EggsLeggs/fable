"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronDown, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import Link from "next/link";

type Props = {
  collapsed: boolean;
  onSearchOpen: () => void;
};

function projectIdFromPathname(pathname: string): string | null {
  const match = pathname.match(/^\/projects\/([^/]+)/);
  const id = match?.[1];
  if (!id || id === "new") return null;
  return id;
}

export function ProjectSwitcher({ collapsed, onSearchOpen }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const { data: projects = [] } = trpc.project.listAll.useQuery();
  const { data: usage } = trpc.billing.getUsage.useQuery();

  const activeId = projectIdFromPathname(pathname);
  const activeProject = projects.find((p) => p.id === activeId);
  const displayProject = activeProject ?? projects[0] ?? null;

  const hasProjects = projects.length > 0;

  const filtered = query
    ? projects.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
    : projects;

  const isFreePlan = !usage || usage.plan === "free";
  const atLimit = isFreePlan && projects.length >= 1;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function selectProject(id: string) {
    router.push(`/projects/${id}/members`);
    setOpen(false);
    setQuery("");
  }

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={hasProjects ? () => setOpen((o) => !o) : () => router.push("/projects/new")}
        className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-xs font-semibold text-accent-foreground hover:opacity-80"
        title={displayProject?.name ?? "Add project"}
      >
        {displayProject ? displayProject.name.charAt(0).toUpperCase() : <Plus className="h-3.5 w-3.5" />}
      </button>
    );
  }

  return (
    <div className="relative min-w-0 flex-1" ref={ref}>
      {hasProjects ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-sidebar-accent"
        >
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-accent text-[11px] font-semibold text-accent-foreground">
            {displayProject!.name.charAt(0).toUpperCase()}
          </div>
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
          <span className="min-w-0 flex-1 truncate font-medium">Add project</span>
        </Link>
      )}

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[200px] rounded-lg border border-border bg-popover shadow-lg">
          <div className="p-1.5">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects..."
              className="w-full rounded bg-muted px-2 py-1.5 text-xs outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <Link
                href="/projects/new"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-secondary"
              >
                <Plus className="h-3.5 w-3.5 shrink-0" />
                Add project
              </Link>
            ) : (
              filtered.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => selectProject(project.id)}
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs hover:bg-secondary"
                >
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-accent text-[10px] font-semibold text-accent-foreground">
                    {project.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="min-w-0 flex-1 truncate">{project.name}</span>
                  {project.id === activeId && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                  )}
                </button>
              ))
            )}
          </div>

          <div className="border-t border-border p-1">
            {atLimit ? (
              <Link
                href="/settings/billing"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs text-muted-foreground hover:bg-secondary"
              >
                <Plus className="h-3.5 w-3.5" />
                Upgrade to Pro for more projects
              </Link>
            ) : (
              <Link
                href="/projects/new"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs hover:bg-secondary"
              >
                <Plus className="h-3.5 w-3.5" />
                New project
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

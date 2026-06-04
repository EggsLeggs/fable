"use client";

import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { trpc } from "@/lib/trpc/client";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ProjectCommandMenu({ open, onOpenChange }: Props) {
  const router = useRouter();
  const { data: projects = [] } = trpc.project.listAll.useQuery();

  function navigate(projectId: string) {
    router.push(`/projects/${projectId}/members`);
    onOpenChange(false);
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Search projects"
      overlayClassName="fixed inset-0 z-50 bg-black/40"
      contentClassName="fixed left-1/2 top-[20%] z-50 w-full max-w-md -translate-x-1/2 rounded-xl border border-border bg-popover shadow-xl"
    >
      <div className="flex items-center border-b border-border px-3">
        <Command.Input
          placeholder="Search projects..."
          className="flex h-11 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <Command.List className="max-h-64 overflow-y-auto p-2">
        <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
          No projects found.
        </Command.Empty>
        {projects.map((project) => (
          <Command.Item
            key={project.id}
            value={project.name}
            onSelect={() => navigate(project.id)}
            className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-secondary data-[selected=true]:bg-secondary"
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-accent text-[11px] font-semibold text-accent-foreground">
              {project.name.charAt(0).toUpperCase()}
            </div>
            <span>{project.name}</span>
            {project.sourceLocale && (
              <span className="ml-auto text-xs text-muted-foreground">{project.sourceLocale}</span>
            )}
          </Command.Item>
        ))}
      </Command.List>
    </Command.Dialog>
  );
}

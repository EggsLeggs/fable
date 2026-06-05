"use client";

import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { t } from "@lingui/core/macro";
import { trpc } from "@/lib/trpc/client";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ProjectCommandMenu({ open, onOpenChange }: Props) {
  const router = useRouter();
  const { data: projects = [] } = trpc.project.listAll.useQuery();

  function navigate(projectId: string) {
    router.push(`/projects/${projectId}/collaborators`);
    onOpenChange(false);
  }

  const title = t`Search projects`;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-[20%] z-50 w-full max-w-md -translate-x-1/2 rounded-xl border border-border bg-popover p-0 shadow-xl">
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          <Command label={title}>
            <div className="flex items-center border-b border-border px-3">
              <Command.Input
                placeholder={t`Search projects...`}
                className="flex h-11 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <Command.List className="max-h-64 overflow-y-auto p-2">
              <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                {t`No projects found.`}
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
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

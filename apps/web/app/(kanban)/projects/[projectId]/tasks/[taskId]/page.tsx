"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  X,
  Loader2,
  ListChecks,
  Calendar,
  User2,
  FileText,
  Clock3,
  Circle,
  CheckCircle2,
  Pencil,
  Trash2,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { getLanguageName } from "@/lib/language-constants";
import { cn } from "@/lib/utils";

type TaskStatus = "todo" | "in_progress" | "done";

const STATUS_CONFIG: Record<TaskStatus, { label: string; icon: React.ElementType; className: string }> = {
  todo: { label: "To Do", icon: Circle, className: "text-muted-foreground" },
  in_progress: { label: "In Progress", icon: Clock3, className: "text-blue-500" },
  done: { label: "Done", icon: CheckCircle2, className: "text-emerald-500" },
};

function formatDate(date: Date | null | undefined): string {
  if (!date) return "-";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

function formatDateTime(date: Date | null | undefined): string {
  if (!date) return "-";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0] ?? "")
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

type Props = { params: Promise<{ projectId: string; taskId: string }> };

export default function TaskDetailPage({ params }: Props) {
  const { projectId, taskId } = use(params);
  const router = useRouter();
  const utils = trpc.useUtils();

  const [editing, setEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const taskQuery = trpc.task.get.useQuery({ taskId });
  const projectQuery = trpc.project.getById.useQuery({ id: projectId });
  const orgId = projectQuery.data?.orgId ?? "";
  const orgQuery = trpc.organization.getById.useQuery({ id: orgId }, { enabled: !!orgId });
  const filesQuery = trpc.sourceFile.list.useQuery({ projectId });

  // Edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState<TaskStatus>("todo");
  const [editLocale, setEditLocale] = useState("");
  const [editSourceFileId, setEditSourceFileId] = useState("");
  const [editAssignedTo, setEditAssignedTo] = useState("");
  const [editDueDate, setEditDueDate] = useState("");

  function startEditing() {
    const t = taskQuery.data;
    if (!t) return;
    setEditTitle(t.title);
    setEditDescription(t.description ?? "");
    setEditStatus(t.status as TaskStatus);
    setEditLocale(t.locale ?? "");
    setEditSourceFileId(t.sourceFileId ?? "");
    setEditAssignedTo(t.assignedTo ?? "");
    setEditDueDate(
      t.dueDate ? new Date(t.dueDate).toISOString().split("T")[0]! : ""
    );
    setEditing(true);
  }

  const updateTask = trpc.task.update.useMutation({
    onSuccess: () => {
      utils.task.get.invalidate({ taskId });
      utils.task.list.invalidate({ projectId });
      toast.success("Task updated");
      setEditing(false);
    },
    onError: () => toast.error("Failed to update task"),
  });

  const deleteTask = trpc.task.delete.useMutation({
    onSuccess: () => {
      utils.task.list.invalidate({ projectId });
      toast.success("Task deleted");
      router.push(`/projects/${projectId}/tasks`);
    },
    onError: () => toast.error("Failed to delete task"),
  });

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editTitle.trim()) return;
    updateTask.mutate({
      taskId,
      title: editTitle.trim(),
      description: editDescription.trim() || null,
      status: editStatus,
      locale: editLocale || null,
      sourceFileId: editSourceFileId || null,
      assignedTo: editAssignedTo || null,
      dueDate: editDueDate ? new Date(editDueDate) : null,
    });
  }

  const task = taskQuery.data;
  const project = projectQuery.data;
  const locales = project?.locales ?? [];
  const members = orgQuery.data?.members ?? [];
  const sourceFiles = (filesQuery.data ?? []) as { id: string; name: string }[];

  const statusConfig = task ? STATUS_CONFIG[task.status as TaskStatus] : null;
  const StatusIcon = statusConfig?.icon ?? Circle;

  return (
    <>
      <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-4">
        <nav className="flex items-center gap-1.5 text-sm">
          <Link
            href={`/projects/${projectId}/tasks`}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Tasks
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          {task ? (
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
              {task.title}
            </span>
          ) : (
            <span className="h-4 w-40 animate-pulse rounded bg-muted" />
          )}
        </nav>
        <Link
          href={`/projects/${projectId}/tasks`}
          className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Back to tasks"
        >
          <X className="h-4 w-4" />
        </Link>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        {taskQuery.isPending && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {taskQuery.isError && (
          <div className="mx-auto max-w-2xl p-8">
            <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
              Task not found or you do not have access.
            </div>
          </div>
        )}

        {task && !editing && (
          <div className="mx-auto max-w-2xl p-8">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="flex items-center gap-2">
                <StatusIcon className={cn("h-5 w-5 shrink-0", statusConfig?.className)} />
                <h1 className="text-xl font-semibold leading-snug">{task.title}</h1>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={startEditing}
                  className="btn-secondary flex items-center gap-1.5 py-1.5 text-xs"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-background px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </div>

            {task.description && (
              <p className="mb-6 whitespace-pre-wrap text-sm text-muted-foreground">
                {task.description}
              </p>
            )}

            <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border">
              <Row label="Status">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 text-sm",
                    statusConfig?.className
                  )}
                >
                  <StatusIcon className="h-4 w-4" />
                  {statusConfig?.label}
                </span>
              </Row>

              <Row label="Language">
                {task.locale ? (
                  <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {getLanguageName(task.locale)}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground/50">None</span>
                )}
              </Row>

              <Row label="Source file">
                {task.sourceFile ? (
                  <span className="flex items-center gap-1.5 text-sm">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    {task.sourceFile.name}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground/50">None</span>
                )}
              </Row>

              <Row label="Assigned to">
                {task.assignedToUser ? (
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold uppercase text-muted-foreground">
                      {getInitials(task.assignedToUser.name)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {task.assignedToUser.username
                          ? `@${task.assignedToUser.username}`
                          : task.assignedToUser.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{task.assignedToUser.email}</p>
                    </div>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground/50">Unassigned</span>
                )}
              </Row>

              <Row label="Created by">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold uppercase text-muted-foreground">
                    {getInitials(task.createdByUser.name)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {task.createdByUser.username
                        ? `@${task.createdByUser.username}`
                        : task.createdByUser.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{task.createdByUser.email}</p>
                  </div>
                </div>
              </Row>

              <Row label="Due date">
                {task.dueDate ? (
                  <span className="flex items-center gap-1.5 text-sm">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    {formatDate(task.dueDate)}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground/50">No due date</span>
                )}
              </Row>

              <Row label="Created">
                <span className="text-sm text-muted-foreground">{formatDateTime(task.createdAt)}</span>
              </Row>

              <Row label="Updated">
                <span className="text-sm text-muted-foreground">{formatDateTime(task.updatedAt)}</span>
              </Row>
            </div>
          </div>
        )}

        {task && editing && (
          <div className="mx-auto max-w-2xl p-8">
            <form onSubmit={handleSave} className="flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Edit task</h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="btn-secondary py-1.5 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!editTitle.trim() || updateTask.isPending}
                    className="btn-primary flex items-center gap-1.5 py-1.5 text-xs"
                  >
                    {updateTask.isPending ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-3.5 w-3.5" />
                        Save
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Title <span className="text-destructive">*</span>
                </label>
                <input
                  autoFocus
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="input"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={4}
                  className="input resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as TaskStatus)}
                    className="input"
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Language</label>
                  <select
                    value={editLocale}
                    onChange={(e) => setEditLocale(e.target.value)}
                    className="input"
                  >
                    <option value="">No language</option>
                    {locales
                      .filter((l) => !l.isSource)
                      .map((l) => (
                        <option key={l.id} value={l.locale}>
                          {getLanguageName(l.locale)}
                        </option>
                      ))}
                    {project?.customLocales?.map((cl) => (
                      <option key={cl.code} value={cl.code}>
                        {cl.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Source file</label>
                  <select
                    value={editSourceFileId}
                    onChange={(e) => setEditSourceFileId(e.target.value)}
                    className="input"
                  >
                    <option value="">No file</option>
                    {sourceFiles.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Assigned to</label>
                  <select
                    value={editAssignedTo}
                    onChange={(e) => setEditAssignedTo(e.target.value)}
                    className="input"
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.user.username ? `@${m.user.username}` : m.user.name || m.user.email}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Due date</label>
                <input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="input"
                />
              </div>
            </form>
          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-background p-6 shadow-xl">
            <h2 className="text-sm font-semibold">Delete task?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This action cannot be undone. The task will be permanently deleted.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteTask.mutate({ taskId })}
                disabled={deleteTask.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-50"
              >
                {deleteTask.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                Delete task
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 bg-background px-4 py-3">
      <span className="w-28 shrink-0 text-xs font-medium text-muted-foreground pt-0.5">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

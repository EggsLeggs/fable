"use client";

import { use, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  ChevronDown,
  Loader2,
  Calendar,
  FileText,
  MoreHorizontal,
  Circle,
  CheckCircle2,
  Clock3,
  X,
  GripVertical,
  Info,
} from "lucide-react";
import * as Tooltip from "@radix-ui/react-tooltip";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { getLanguageName } from "@/lib/language-constants";
import { cn } from "@/lib/utils";

type TaskStatus = "todo" | "in_progress" | "done";

type TaskUser = { id: string; name: string; email: string; username: string | null };
type TaskFile = { id: string; name: string };
type Task = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  locale: string | null;
  sourceFileId: string | null;
  assignedTo: string | null;
  createdBy: string;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  assignedToUser: TaskUser | null;
  createdByUser: TaskUser;
  sourceFile: TaskFile | null;
};

type Filters = {
  locale: string | null;
  assignedTo: string | null;
  createdBy: string | null;
  sourceFileId: string | null;
};

const STATUS_CONFIG = {
  todo: {
    label: "To Do",
    icon: Circle,
    iconClass: "text-muted-foreground",
    headerClass: "border-t-2 border-muted-foreground/30",
  },
  in_progress: {
    label: "In Progress",
    icon: Clock3,
    iconClass: "text-blue-500",
    headerClass: "border-t-2 border-blue-500",
  },
  done: {
    label: "Done",
    icon: CheckCircle2,
    iconClass: "text-emerald-500",
    headerClass: "border-t-2 border-emerald-500",
  },
} as const;

function formatShortDate(date: Date | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleDateString("en", { month: "short", day: "numeric" });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0] ?? "")
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

function getDueDateClass(dueDate: Date): string {
  const now = new Date();
  const diff = new Date(dueDate).getTime() - now.getTime();
  const days = diff / (1000 * 60 * 60 * 24);
  if (days < 0) return "text-destructive";
  if (days <= 3) return "text-amber-500 dark:text-amber-400";
  return "text-muted-foreground";
}

function TaskCardOverlay({ task }: { task: Task }) {
  return (
    <div className="w-[372px] rotate-1 rounded-lg border border-border bg-background p-3 shadow-xl opacity-95">
      <p className="text-sm font-medium leading-snug">{task.title}</p>
      {(task.locale || task.sourceFile) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.locale && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {getLanguageName(task.locale)}
            </span>
          )}
          {task.sourceFile && (
            <span className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              <FileText className="h-2.5 w-2.5" />
              {task.sourceFile.name}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function TaskCard({
  task,
  projectId,
  onStatusChange,
  onDelete,
}: {
  task: Task;
  projectId: string;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onDelete: (taskId: string) => void;
}) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative rounded-lg border border-border bg-background shadow-sm transition-shadow hover:border-ring/40 hover:shadow-md",
        isDragging && "opacity-0"
      )}
    >
      <div className="flex items-start gap-1 p-3">
        {/* Drag handle */}
        <button
          type="button"
          {...listeners}
          {...attributes}
          onClick={(e) => e.stopPropagation()}
          className="mt-0.5 flex h-4 w-4 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground/30 opacity-0 transition-opacity hover:text-muted-foreground group-hover:opacity-100 active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        {/* Card content */}
        <div className="min-w-0 flex-1">
          {/* Title + menu row */}
          <div className="flex items-start justify-between gap-2">
            <p
              className="cursor-pointer text-sm font-medium leading-snug"
              onClick={() => router.push(`/projects/${projectId}/tasks/${task.id}`)}
            >
              {task.title}
            </p>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="z-50 min-w-[160px] overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg"
                  sideOffset={4}
                  onClick={(e) => e.stopPropagation()}
                >
                  {task.status !== "todo" && (
                    <DropdownMenu.Item
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm outline-none hover:bg-muted"
                      onSelect={() => onStatusChange(task.id, "todo")}
                    >
                      <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                      Move to To Do
                    </DropdownMenu.Item>
                  )}
                  {task.status !== "in_progress" && (
                    <DropdownMenu.Item
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm outline-none hover:bg-muted"
                      onSelect={() => onStatusChange(task.id, "in_progress")}
                    >
                      <Clock3 className="h-3.5 w-3.5 text-blue-500" />
                      Move to In Progress
                    </DropdownMenu.Item>
                  )}
                  {task.status !== "done" && (
                    <DropdownMenu.Item
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm outline-none hover:bg-muted"
                      onSelect={() => onStatusChange(task.id, "done")}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      Mark as Done
                    </DropdownMenu.Item>
                  )}
                  <DropdownMenu.Separator className="my-1 h-px bg-border" />
                  <DropdownMenu.Item
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-destructive outline-none hover:bg-destructive/10"
                    onSelect={() => onDelete(task.id)}
                  >
                    Delete
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>

          {/* Badges */}
          {(task.locale || task.sourceFile) && (
            <div className="mt-2 flex flex-wrap gap-1">
              {task.locale && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {getLanguageName(task.locale)}
                </span>
              )}
              {task.sourceFile && (
                <span className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  <FileText className="h-2.5 w-2.5" />
                  {task.sourceFile.name}
                </span>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="mt-2.5 flex items-center justify-between gap-2">
            {task.assignedToUser ? (
              <div className="flex items-center gap-1.5">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold uppercase text-muted-foreground">
                  {getInitials(task.assignedToUser.name)}
                </div>
                <span className="max-w-[90px] truncate text-xs text-muted-foreground">
                  {task.assignedToUser.username
                    ? `@${task.assignedToUser.username}`
                    : task.assignedToUser.name.split(" ")[0]}
                </span>
              </div>
            ) : null}
            {task.dueDate && (
              <span className={cn("flex items-center gap-0.5 text-xs", getDueDateClass(task.dueDate))}>
                <Calendar className="h-3 w-3" />
                {formatShortDate(task.dueDate)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LocaleGroup({
  locale,
  tasks,
  projectId,
  isCollapsed,
  onToggle,
  onStatusChange,
  onDelete,
}: {
  locale: string | null;
  tasks: Task[];
  projectId: string;
  isCollapsed: boolean;
  onToggle: () => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onDelete: (taskId: string) => void;
}) {
  const label = locale ? getLanguageName(locale) : "No language";

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 rounded px-1 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-transform duration-150",
            isCollapsed && "-rotate-90"
          )}
        />
        <span className="truncate">{label}</span>
        <span className="ml-auto tabular-nums opacity-60">{tasks.length}</span>
      </button>

      {!isCollapsed && (
        <div className="flex flex-col gap-2 pl-1 pt-1">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              projectId={projectId}
              onStatusChange={onStatusChange}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function KanbanColumn({
  status,
  tasks,
  projectId,
  collapsedGroups,
  onToggleGroup,
  onStatusChange,
  onDelete,
}: {
  status: TaskStatus;
  tasks: Task[];
  projectId: string;
  collapsedGroups: Set<string>;
  onToggleGroup: (key: string) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onDelete: (taskId: string) => void;
}) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  const localeGroups = useMemo(() => {
    const map = new Map<string | null, Task[]>();
    for (const task of tasks) {
      const key = task.locale ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    }
    const entries = [...map.entries()].sort(([a], [b]) => {
      if (a === null) return 1;
      if (b === null) return -1;
      return a.localeCompare(b);
    });
    return entries;
  }, [tasks]);

  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      className={cn(
        "w-[380px] flex-shrink-0 rounded-xl border border-border bg-background/80 backdrop-blur-sm transition-colors",
        config.headerClass,
        isOver && "border-ring/60 bg-muted/40"
      )}
    >
      <div className="flex items-center gap-2 px-4 py-3">
        <Icon className={cn("h-4 w-4 shrink-0", config.iconClass)} />
        <h2 className="text-sm font-semibold">{config.label}</h2>
        {status === "done" && (
          <Tooltip.Provider delayDuration={200}>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <Info className="h-3.5 w-3.5 shrink-0 cursor-default text-muted-foreground/50 hover:text-muted-foreground" />
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  className="z-50 max-w-[200px] rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
                  sideOffset={6}
                >
                  Only shows completed tasks from the last 30 days.
                  <Tooltip.Arrow className="fill-border" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
        )}
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
          {tasks.length}
        </span>
      </div>

      <div ref={setNodeRef} className="min-h-[60px] px-3 pb-3">
        {localeGroups.length === 0 && (
          <p className="py-8 text-center text-xs text-muted-foreground/60">No tasks</p>
        )}
        {localeGroups.map(([locale, localeTasks]) => {
          const groupKey = `${status}-${locale ?? "_none"}`;
          return (
            <LocaleGroup
              key={groupKey}
              locale={locale}
              tasks={localeTasks}
              projectId={projectId}
              isCollapsed={collapsedGroups.has(groupKey)}
              onToggle={() => onToggleGroup(groupKey)}
              onStatusChange={onStatusChange}
              onDelete={onDelete}
            />
          );
        })}
      </div>
    </div>
  );
}

function CreateTaskDialog({
  projectId,
  defaultStatus,
  onClose,
  onCreated,
}: {
  projectId: string;
  defaultStatus: TaskStatus;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>(defaultStatus);
  const [locale, setLocale] = useState("");
  const [sourceFileId, setSourceFileId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");

  const projectQuery = trpc.project.getById.useQuery({ id: projectId });
  const orgId = projectQuery.data?.orgId ?? "";
  const orgQuery = trpc.organization.getById.useQuery(
    { id: orgId },
    { enabled: !!orgId }
  );
  const filesQuery = trpc.sourceFile.list.useQuery({ projectId });
  const utils = trpc.useUtils();

  const createTask = trpc.task.create.useMutation({
    onSuccess: () => {
      utils.task.list.invalidate({ projectId });
      toast.success("Task created");
      onCreated();
    },
    onError: () => toast.error("Failed to create task"),
  });

  const project = projectQuery.data;
  const locales = project?.locales ?? [];
  const members = orgQuery.data?.members ?? [];
  const sourceFiles = filesQuery.data ?? [];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    createTask.mutate({
      projectId,
      title: title.trim(),
      description: description.trim() || undefined,
      status,
      locale: locale || undefined,
      sourceFileId: sourceFileId || undefined,
      assignedTo: assignedTo || undefined,
      dueDate: dueDate ? new Date(dueDate) : undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">New task</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Title <span className="text-destructive">*</span>
            </label>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              className="input"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
              className="input resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
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
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
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

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Source file</label>
              <select
                value={sourceFileId}
                onChange={(e) => setSourceFileId(e.target.value)}
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
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
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
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="input"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || createTask.isPending}
              className="btn-primary flex items-center gap-1.5"
            >
              {createTask.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create task"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type Props = { params: Promise<{ projectId: string }> };

export default function TasksPage({ params }: Props) {
  const { projectId } = use(params);
  const utils = trpc.useUtils();

  const [filters, setFilters] = useState<Filters>({
    locale: null,
    assignedTo: null,
    createdBy: null,
    sourceFileId: null,
  });
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [createDefaultStatus, setCreateDefaultStatus] = useState<TaskStatus>("todo");
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const tasksQuery = trpc.task.list.useQuery({ projectId });
  const projectQuery = trpc.project.getById.useQuery({ id: projectId });
  const orgId = projectQuery.data?.orgId ?? "";
  const orgQuery = trpc.organization.getById.useQuery(
    { id: orgId },
    { enabled: !!orgId }
  );
  const filesQuery = trpc.sourceFile.list.useQuery({ projectId });

  const updateStatus = trpc.task.update.useMutation({
    onMutate: async (input) => {
      if (!input.status) return;
      await utils.task.list.cancel({ projectId });
      const previous = utils.task.list.getData({ projectId });
      utils.task.list.setData({ projectId }, (old) =>
        old?.map((t) => (t.id === input.taskId ? { ...t, status: input.status! } : t))
      );
      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) utils.task.list.setData({ projectId }, context.previous);
      toast.error("Failed to update task");
    },
    onSettled: () => utils.task.list.invalidate({ projectId }),
  });

  const deleteTask = trpc.task.delete.useMutation({
    onSuccess: () => {
      utils.task.list.invalidate({ projectId });
      toast.success("Task deleted");
    },
    onError: () => toast.error("Failed to delete task"),
  });

  const allTasks = (tasksQuery.data ?? []) as Task[];

  const filtered = useMemo(() => {
    return allTasks.filter((task) => {
      if (filters.locale && task.locale !== filters.locale) return false;
      if (filters.assignedTo && task.assignedTo !== filters.assignedTo) return false;
      if (filters.createdBy && task.createdBy !== filters.createdBy) return false;
      if (filters.sourceFileId && task.sourceFileId !== filters.sourceFileId) return false;
      return true;
    });
  }, [allTasks, filters]);

  const byStatus = useMemo(
    () => ({
      todo: filtered.filter((t) => t.status === "todo"),
      in_progress: filtered.filter((t) => t.status === "in_progress"),
      done: filtered.filter((t) => t.status === "done"),
    }),
    [filtered]
  );

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleDragStart({ active }: DragStartEvent) {
    const task = (active.data.current as { task: Task } | undefined)?.task;
    setActiveTask(task ?? null);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveTask(null);
    if (!over) return;
    const task = (active.data.current as { task: Task } | undefined)?.task;
    if (!task) return;
    const newStatus = over.id as TaskStatus;
    if (task.status !== newStatus) {
      updateStatus.mutate({ taskId: task.id, status: newStatus });
    }
  }

  function handleStatusChange(taskId: string, status: TaskStatus) {
    updateStatus.mutate({ taskId, status });
  }

  function handleDelete(taskId: string) {
    deleteTask.mutate({ taskId });
  }

  function openCreate(status: TaskStatus = "todo") {
    setCreateDefaultStatus(status);
    setShowCreate(true);
  }

  const members = orgQuery.data?.members ?? [];
  const project = projectQuery.data;
  const locales = project?.locales ?? [];
  const sourceFiles = (filesQuery.data ?? []) as { id: string; name: string }[];

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-background px-6 py-3.5">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold">Tasks</h1>
          {tasksQuery.isPending && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Filters */}
          <div className="flex items-center gap-2">
            <select
              value={filters.locale ?? ""}
              onChange={(e) =>
                setFilters((f) => ({ ...f, locale: e.target.value || null }))
              }
              className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:border-ring"
            >
              <option value="">All languages</option>
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

            <select
              value={filters.assignedTo ?? ""}
              onChange={(e) =>
                setFilters((f) => ({ ...f, assignedTo: e.target.value || null }))
              }
              className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:border-ring"
            >
              <option value="">Assigned to anyone</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user.name || m.user.email}
                </option>
              ))}
            </select>

            <select
              value={filters.createdBy ?? ""}
              onChange={(e) =>
                setFilters((f) => ({ ...f, createdBy: e.target.value || null }))
              }
              className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:border-ring"
            >
              <option value="">Created by anyone</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user.name || m.user.email}
                </option>
              ))}
            </select>

            <select
              value={filters.sourceFileId ?? ""}
              onChange={(e) =>
                setFilters((f) => ({ ...f, sourceFileId: e.target.value || null }))
              }
              className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:border-ring"
            >
              <option value="">Any file</option>
              {sourceFiles.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={() =>
                  setFilters({ locale: null, assignedTo: null, createdBy: null, sourceFileId: null })
                }
                className="flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3 w-3" />
                Clear ({activeFilterCount})
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => openCreate()}
            className="btn-primary flex items-center gap-1.5 py-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            New task
          </button>
        </div>
      </header>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveTask(null)}
      >
        <div className="flex-1 overflow-auto bg-background bg-dot-pattern">
          <div className="flex min-w-max items-start gap-5 p-5">
            {(["todo", "in_progress", "done"] as const).map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                tasks={byStatus[status]}
                projectId={projectId}
                collapsedGroups={collapsedGroups}
                onToggleGroup={toggleGroup}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
        <DragOverlay dropAnimation={null}>
          {activeTask ? <TaskCardOverlay task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>

      {showCreate && (
        <CreateTaskDialog
          projectId={projectId}
          defaultStatus={createDefaultStatus}
          onClose={() => setShowCreate(false)}
          onCreated={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}

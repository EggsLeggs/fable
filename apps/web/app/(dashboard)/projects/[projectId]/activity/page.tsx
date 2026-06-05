"use client";

import { use, useEffect, useRef, useState } from "react";
import type { DateRange } from "react-day-picker";
import {
  Loader2,
  GitBranch,
  Settings,
  FileText,
  CheckSquare,
  Plus,
  Trash2,
  PencilLine,
  Globe,
  UserPlus,
  UserMinus,
  ChevronDown,
  Check,
  CalendarRange,
  X,
  MessageSquare,
  CheckCircle,
  XCircle,
  Lightbulb,
} from "lucide-react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { trpc } from "@/lib/trpc/client";
import { UserAvatar } from "@/components/UserAvatar";
import {
  UserDisplayName,
  formatUserOptionLabel,
  getUserAvatarLabel,
} from "@/lib/user-display";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SelectCombobox } from "@/components/ui/select-combobox";
import type { ActivityType } from "@fable/db";

type Props = { params: Promise<{ projectId: string }> };

const TYPE_LABELS: Record<ActivityType, string> = {
  project_created: "Project created",
  project_updated: "Project updated",
  locale_added: "Language added",
  locale_removed: "Language removed",
  source_created: "Source file added",
  source_updated: "Source file updated",
  source_deleted: "Source file removed",
  member_joined: "Member joined",
  member_left: "Member left",
  task_created: "Task created",
  task_updated: "Task updated",
  task_deleted: "Task deleted",
  integration_created: "Integration connected",
  integration_updated: "Integration updated",
  integration_deleted: "Integration removed",
  translation_suggested: "Suggestion added",
  translation_approved: "Translation approved",
  translation_rejected: "Suggestion rejected",
  translations_pushed: "Translations pushed",
  comment_added: "Comment added",
};

const TYPE_GROUPS: { label: string; types: ActivityType[] }[] = [
  { label: "Project", types: ["project_created", "project_updated"] },
  { label: "Languages", types: ["locale_added", "locale_removed"] },
  { label: "Sources", types: ["source_created", "source_updated", "source_deleted"] },
  { label: "Members", types: ["member_joined", "member_left"] },
  { label: "Tasks", types: ["task_created", "task_updated", "task_deleted"] },
  { label: "Integrations", types: ["integration_created", "integration_updated", "integration_deleted"] },
  { label: "Translations", types: ["translation_suggested", "translation_approved", "translation_rejected", "translations_pushed"] },
  { label: "Comments", types: ["comment_added"] },
];

function activityIcon(type: ActivityType) {
  if (type === "project_created") return <Plus className="h-3.5 w-3.5" />;
  if (type === "project_updated") return <Settings className="h-3.5 w-3.5" />;
  if (type === "locale_added" || type === "locale_removed") return <Globe className="h-3.5 w-3.5" />;
  if (type === "source_created" || type === "source_updated") return <FileText className="h-3.5 w-3.5" />;
  if (type === "source_deleted") return <Trash2 className="h-3.5 w-3.5" />;
  if (type === "member_joined") return <UserPlus className="h-3.5 w-3.5" />;
  if (type === "member_left") return <UserMinus className="h-3.5 w-3.5" />;
  if (type === "task_created") return <CheckSquare className="h-3.5 w-3.5" />;
  if (type === "task_updated") return <PencilLine className="h-3.5 w-3.5" />;
  if (type === "task_deleted") return <Trash2 className="h-3.5 w-3.5" />;
  if (type === "translation_suggested") return <Lightbulb className="h-3.5 w-3.5" />;
  if (type === "translation_approved") return <CheckCircle className="h-3.5 w-3.5" />;
  if (type === "translation_rejected") return <XCircle className="h-3.5 w-3.5" />;
  if (type === "comment_added") return <MessageSquare className="h-3.5 w-3.5" />;
  return <GitBranch className="h-3.5 w-3.5" />;
}

function activityIconBg(type: ActivityType): string {
  if (type === "project_created") return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400";
  if (type === "project_updated") return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400";
  if (type.startsWith("locale_")) return "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400";
  if (type.startsWith("source_")) return "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400";
  if (type === "member_joined") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400";
  if (type === "member_left") return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400";
  if (type.startsWith("task_")) return "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400";
  if (type === "translation_suggested") return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400";
  if (type === "translation_approved") return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400";
  if (type === "translation_rejected") return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400";
  if (type === "comment_added") return "bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-400";
  return "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400";
}

type ChangeValue = { from: unknown; to: unknown };
type ActivityMetadata = {
  name?: string;
  changes?: Record<string, ChangeValue>;
  locale?: string;
  sourceId?: string;
  sourcePath?: string;
  memberUserId?: string;
  memberName?: string;
  role?: string;
  taskId?: string;
  taskTitle?: string;
  taskLocale?: string | null;
  taskStatus?: string;
  provider?: string;
  repoOwner?: string;
  repoName?: string;
  keyId?: string;
  keyName?: string;
  translationId?: string;
  translationValue?: string;
  commentId?: string;
  commentBody?: string;
  locales?: string[];
};

function formatStatus(s: unknown): string {
  if (s === "todo") return "To do";
  if (s === "in_progress") return "In progress";
  if (s === "done") return "Done";
  return String(s ?? "");
}

function describeTaskChange(field: string, change: ChangeValue): string | null {
  const { from, to } = change;
  if (field === "status") return `changed status from ${formatStatus(from)} to ${formatStatus(to)}`;
  if (field === "title") return `renamed from "${from}" to "${to}"`;
  if (field === "locale") {
    if (!to) return `removed locale ${from}`;
    if (!from) return `set locale to ${to}`;
    return `changed locale from ${from} to ${to}`;
  }
  if (field === "assignedTo") return !to ? "unassigned" : "assigned to a new user";
  if (field === "dueDate") {
    if (!to) return "removed due date";
    return `set due date to ${new Date(to as string).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`;
  }
  return null;
}

function describeProjectChange(field: string, change: ChangeValue): string | null {
  const { to } = change;
  if (field === "name") return `renamed to "${to}"`;
  if (field === "description") return "updated description";
  if (field === "visibility") return `changed visibility to ${to}`;
  if (field === "allowContributions") return to ? "enabled public contributions" : "disabled public contributions";
  if (field === "notifyTranslatorsOnNewStrings") return to ? "enabled translator notifications" : "disabled translator notifications";
  if (field === "glossaryAccess") return `changed glossary access to ${to}`;
  if (field === "sourceLocale") return `changed source language to ${to}`;
  if (field === "customLocales") return "updated custom languages";
  return null;
}

function activityDescription(type: ActivityType, meta: ActivityMetadata): string {
  const title = meta.taskTitle ? `"${meta.taskTitle}"` : "task";

  switch (type) {
    case "project_created":
      return meta.name ? `Created project "${meta.name}"` : "Created project";

    case "project_updated": {
      if (meta.changes) {
        const fields = Object.keys(meta.changes);
        if (fields.length === 1) {
          const desc = describeProjectChange(fields[0]!, meta.changes[fields[0]!]!);
          if (desc) return `Project ${desc}`;
        }
        const descs = fields.map((f) => describeProjectChange(f, meta.changes![f]!)).filter(Boolean);
        if (descs.length > 0) return `Project: ${descs.join("; ")}`;
      }
      return meta.name ? `Updated settings for "${meta.name}"` : "Updated project settings";
    }

    case "locale_added":
      return meta.locale ? `Added language ${meta.locale}` : "Added language";
    case "locale_removed":
      return meta.locale ? `Removed language ${meta.locale}` : "Removed language";
    case "source_created":
      return meta.name ? `Uploaded source file "${meta.name}"` : "Uploaded source file";
    case "source_updated":
      return meta.name ? `Updated source file "${meta.name}"` : "Updated source file";
    case "source_deleted":
      return meta.name ? `Archived source file "${meta.name}"` : "Archived source file";
    case "member_joined":
      return meta.memberName ? `${meta.memberName} joined as ${meta.role ?? "member"}` : "A new member joined";
    case "member_left":
      return meta.memberName ? `${meta.memberName} was removed` : "A member was removed";
    case "task_created":
      return `Created task ${title}`;

    case "task_updated": {
      if (meta.changes && Object.keys(meta.changes).length > 0) {
        const fields = Object.keys(meta.changes);
        if (fields.length === 1) {
          const desc = describeTaskChange(fields[0]!, meta.changes[fields[0]!]!);
          if (desc) return `Task ${title} - ${desc}`;
        }
        const descs = fields.map((f) => describeTaskChange(f, meta.changes![f]!)).filter(Boolean);
        if (descs.length > 0) return `Task ${title} - ${descs.join(", ")}`;
      }
      return `Updated task ${title}`;
    }

    case "task_deleted":
      return `Deleted task ${title}`;
    case "integration_created":
      return meta.repoName ? `Connected ${meta.repoOwner}/${meta.repoName}` : "Connected integration";
    case "integration_updated":
      return meta.repoName ? `Updated ${meta.repoOwner}/${meta.repoName}` : "Updated integration";
    case "integration_deleted":
      return meta.repoName ? `Removed ${meta.repoOwner}/${meta.repoName}` : "Removed integration";
    case "translation_suggested":
      return meta.keyName ? `Suggested translation for "${meta.keyName}"` : "Added a translation suggestion";
    case "translation_approved":
      return meta.keyName ? `Approved translation for "${meta.keyName}"` : "Approved a translation";
    case "translation_rejected":
      return meta.keyName ? `Rejected suggestion for "${meta.keyName}"` : "Rejected a translation suggestion";
    case "comment_added":
      return meta.keyName ? `Commented on "${meta.keyName}"` : "Added a comment";
    case "translations_pushed": {
      const repo = meta.repoName ? `${meta.repoOwner}/${meta.repoName}` : "repository";
      const langs = meta.locales && meta.locales.length > 0 ? ` (${meta.locales.join(", ")})` : "";
      return `Pushed translations to ${repo}${langs}`;
    }
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDayHeading(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (d.getTime() === today.getTime()) return "Today";
  if (d.getTime() === yesterday.getTime()) return "Yesterday";
  return date.toLocaleDateString([], { year: "numeric", month: "long", day: "numeric" });
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth()).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

type ActivityItem = {
  id: string;
  type: ActivityType;
  locale: string | null;
  metadata: ActivityMetadata;
  createdAt: Date;
  user: { id: string; name: string; username: string | null; email: string; image: string | null } | null;
};

type Actor = { id: string; name: string; username: string | null; email: string; image: string | null };

function TypeDropdown({
  selectedTypes,
  onChange,
}: {
  selectedTypes: ActivityType[];
  onChange: (types: ActivityType[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const label =
    selectedTypes.length === 0
      ? t`All types`
      : selectedTypes.length === 1
      ? TYPE_LABELS[selectedTypes[0]!]
      : t`${selectedTypes.length} types`;

  function toggleType(type: ActivityType) {
    onChange(
      selectedTypes.includes(type)
        ? selectedTypes.filter((t) => t !== type)
        : [...selectedTypes, type]
    );
  }

  function toggleGroup(types: ActivityType[]) {
    const allSelected = types.every((t) => selectedTypes.includes(t));
    onChange(
      allSelected
        ? selectedTypes.filter((t) => !types.includes(t))
        : [...selectedTypes, ...types.filter((t) => !selectedTypes.includes(t))]
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm text-foreground hover:border-foreground/40"
      >
        <span>{label}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border border-border bg-background py-1 shadow-md">
          {selectedTypes.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => onChange([])}
                className="w-full px-3 py-1.5 text-left text-xs text-muted-foreground hover:text-foreground"
              >
                {t`Clear selection`}
              </button>
              <div className="my-1 border-t border-border" />
            </>
          )}
          {TYPE_GROUPS.map((group) => {
            const allSelected = group.types.every((t) => selectedTypes.includes(t));
            return (
              <div key={group.label}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.types)}
                  className="flex w-full items-center gap-2 px-3 py-1 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
                >
                  <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${allSelected ? "border-foreground bg-foreground" : "border-border"}`}>
                    {allSelected && <Check className="h-2.5 w-2.5 text-background" />}
                  </span>
                  {group.label}
                </button>
                {group.types.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleType(type)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 pl-7 text-left text-sm hover:bg-accent"
                  >
                    <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${selectedTypes.includes(type) ? "border-foreground bg-foreground" : "border-border"}`}>
                      {selectedTypes.includes(type) && <Check className="h-2.5 w-2.5 text-background" />}
                    </span>
                    {TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DateRangeFilter({
  value,
  onChange,
}: {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
}) {
  const formatDate = (d: Date) =>
    d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

  const label = value?.from
    ? value.to
      ? `${formatDate(value.from)} - ${formatDate(value.to)}`
      : formatDate(value.from)
    : t`Any date`;

  const hasValue = Boolean(value?.from);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm text-foreground hover:border-foreground/40"
        >
          <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{label}</span>
          {hasValue && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onChange(undefined); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onChange(undefined); }}}
              className="ml-0.5 rounded-sm p-0.5 hover:bg-accent"
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={value}
          onSelect={onChange}
          numberOfMonths={2}
          disabled={{ after: new Date() }}
        />
      </PopoverContent>
    </Popover>
  );
}

export default function ActivityPage({ params }: Props) {
  const { projectId } = use(params);

  const [selectedTypes, setSelectedTypes] = useState<ActivityType[]>([]);
  const [selectedLocale, setSelectedLocale] = useState<string>("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const projectQuery = trpc.project.getById.useQuery({ id: projectId });
  const actorsQuery = trpc.activity.listActors.useQuery({ projectId });

  const activityQuery = trpc.activity.list.useInfiniteQuery(
    {
      projectId,
      types: selectedTypes.length > 0 ? selectedTypes : undefined,
      locale: selectedLocale || undefined,
      userId: selectedUserId || undefined,
      from: dateRange?.from?.toISOString(),
      to: dateRange?.to?.toISOString(),
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      initialCursor: undefined,
    }
  );

  const project = projectQuery.data;
  const locales = project?.locales?.filter((l) => !l.isSource) ?? [];
  const actors = actorsQuery.data ?? [];

  const items: ActivityItem[] =
    (activityQuery.data?.pages.flatMap((p) => p.items) as ActivityItem[] | undefined) ?? [];

  const groupedByDay = items.reduce<{ key: string; date: Date; items: ActivityItem[] }[]>(
    (acc, item) => {
      const d = new Date(item.createdAt);
      const key = dayKey(d);
      const existing = acc.find((g) => g.key === key);
      if (existing) {
        existing.items.push(item);
      } else {
        acc.push({ key, date: d, items: [item] });
      }
      return acc;
    },
    []
  );

  function resetFilters() {
    setSelectedTypes([]);
    setSelectedLocale("");
    setSelectedUserId("");
    setDateRange(undefined);
  }

  const isLoading = activityQuery.isPending;
  const hasFilters =
    selectedTypes.length > 0 || !!selectedLocale || !!selectedUserId || !!dateRange?.from;

  return (
    <div className="flex w-full flex-1 flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t`Activity`}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t`Recent changes and events across this project.`}
        </p>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <TypeDropdown selectedTypes={selectedTypes} onChange={setSelectedTypes} />

        <DateRangeFilter value={dateRange} onChange={setDateRange} />

        {locales.length > 0 && (
          <SelectCombobox
            value={selectedLocale}
            onValueChange={setSelectedLocale}
            emptyOption={t`All languages`}
            options={locales.map((l) => ({ value: l.locale, label: l.locale }))}
            triggerClassName="h-8 w-auto min-w-[8rem] rounded-md px-3 py-0 text-sm shadow-none"
            searchable={locales.length > 6}
          />
        )}

        {actors.length > 0 && (
          <SelectCombobox
            value={selectedUserId}
            onValueChange={setSelectedUserId}
            emptyOption={t`All users`}
            options={actors.map((actor: Actor) => ({
              value: actor.id,
              label: formatUserOptionLabel(actor),
            }))}
            triggerClassName="h-8 w-auto min-w-[8rem] rounded-md px-3 py-0 text-sm shadow-none"
          />
        )}

        {hasFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="h-8 rounded-md border border-border px-3 text-sm text-muted-foreground hover:border-foreground/40 hover:text-foreground"
          >
            {t`Clear`}
          </button>
        )}
      </div>

      {/* Feed */}
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <p className="text-sm text-muted-foreground">
            {hasFilters ? t`No activity matches your filters.` : t`No activity yet.`}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {groupedByDay.map((group) => (
            <div key={group.key}>
              <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {formatDayHeading(group.date)}
              </h2>
              <div className="rounded-lg border border-border">
                <ul className="divide-y divide-border px-4">
                  {group.items.map((item) => (
                    <li key={item.id} className="flex items-start gap-3 py-3">
                      <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${activityIconBg(item.type)}`}>
                        {activityIcon(item.type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">{activityDescription(item.type, item.metadata)}</p>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <UserAvatar
                            name={
                              item.user
                                ? getUserAvatarLabel(item.user)
                                : "Unknown"
                            }
                            email={item.user?.email}
                            src={item.user?.image}
                            className="h-5 w-5"
                          />
                          <span className="text-xs text-muted-foreground">
                            {item.user ? (
                              <UserDisplayName user={item.user} />
                            ) : (
                              "Unknown"
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <time className="text-xs text-muted-foreground">
                            {formatTime(new Date(item.createdAt))}
                          </time>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}

          {activityQuery.hasNextPage && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => void activityQuery.fetchNextPage()}
                disabled={activityQuery.isFetchingNextPage}
                className="rounded-md border border-border px-4 py-1.5 text-sm text-muted-foreground hover:border-foreground/40 hover:text-foreground disabled:opacity-50"
              >
                {activityQuery.isFetchingNextPage ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <Trans>Loading...</Trans>
                  </span>
                ) : (
                  t`Load more`
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

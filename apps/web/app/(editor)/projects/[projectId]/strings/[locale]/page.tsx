"use client";

import {
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Copy,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Search,
  ThumbsDown,
  ThumbsUp,
  X,
  Filter,
  Check,
  Languages,
  AlertCircle,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { useVirtualizer } from "@tanstack/react-virtual";
import { trpc } from "@/lib/trpc/client";

type Props = {
  params: Promise<{ projectId: string; locale: string }>;
};

type FilterValue = "all" | "untranslated" | "needs_review" | "approved" | "has_comments";

type StringItem = {
  id: string;
  key: string;
  value: string | null;
  context: string | null;
  labels: string[];
  hasScreenshot: boolean;
  hasComments: boolean;
  status: string;
  sourceFile: { id: string; name: string; format: string } | null;
  translation: { id: string; value: string; state: string } | null;
};

function getSaveLabel(
  role: string,
  settings: { translatorApprovalRequired: boolean; adminSelfReviewRequired: boolean }
): string {
  const isAdmin = role === "owner" || role === "admin" || role === "member";
  if (isAdmin && !settings.adminSelfReviewRequired) return "Save and approve";
  if (!isAdmin && !settings.translatorApprovalRequired) return "Save and approve";
  return "Save suggestion";
}

function StateIndicator({ state }: { state: string | null }) {
  if (state === "approved") {
    return <span className="h-full w-1 shrink-0 bg-green-500" />;
  }
  if (state === "suggested" || state === "needs_review") {
    return <span className="h-full w-1 shrink-0 bg-amber-400" />;
  }
  return <span className="h-full w-1 shrink-0 bg-red-400" />;
}

const FILTER_LABELS: Record<FilterValue, string> = {
  all: "All",
  untranslated: "Untranslated",
  needs_review: "Needs review",
  approved: "Approved",
  has_comments: "Has comments",
};

// ─── Left Panel: String List ───────────────────────────────────────────────

function StringListPanel({
  projectId,
  locale,
  selectedId,
  onSelect,
}: {
  projectId: string;
  locale: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [debouncedQ, setDebouncedQ] = useState(q);
  const [filter, setFilter] = useState<FilterValue>(
    (searchParams.get("filter") as FilterValue) ?? "all"
  );
  const [fileId, setFileId] = useState(searchParams.get("fileId") ?? "");
  const [filterOpen, setFilterOpen] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const projectQuery = trpc.project.getById.useQuery({ id: projectId });
  const locales = projectQuery.data?.locales ?? [];
  const targetLocales = locales.filter((l) => !l.isSource);

  const filesQuery = trpc.sourceFile.list.useQuery({ projectId });

  const stringsQuery = trpc.strings.list.useQuery({
    projectId,
    locale,
    q: debouncedQ || undefined,
    filter,
    fileId: fileId || undefined,
    page: 1,
    limit: 100,
  });

  const strings = stringsQuery.data?.strings ?? [];
  const total = stringsQuery.data?.total ?? 0;

  const rowVirtualizer = useVirtualizer({
    count: strings.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 10,
  });

  function handleLocaleChange(newLocale: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("stringId");
    router.push(`/projects/${projectId}/strings/${newLocale}?${params.toString()}`);
  }

  function handleFilterChange(f: FilterValue) {
    setFilter(f);
    setFilterOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    if (f === "all") params.delete("filter");
    else params.set("filter", f);
    params.delete("stringId");
    router.replace(`/projects/${projectId}/strings/${locale}?${params.toString()}`);
  }

  const currentIdx = selectedId ? strings.findIndex((s) => s.id === selectedId) : -1;

  return (
    <div className="flex w-72 shrink-0 flex-col overflow-hidden border-r border-border">
      {/* Language selector */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <div className="relative min-w-0 flex-1">
          <Languages className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <select
            value={locale}
            onChange={(e) => handleLocaleChange(e.target.value)}
            className="h-7 w-full rounded-md border border-border bg-background py-0 pl-7 pr-2 text-sm font-medium text-foreground outline-none hover:border-foreground/40 focus:ring-1 focus:ring-ring"
          >
            {targetLocales.map((l) => (
              <option key={l.locale} value={l.locale}>
                {l.locale}
              </option>
            ))}
          </select>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {total} strings
        </span>
      </div>

      {/* Search + filter */}
      <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search strings..."
            className="w-full rounded py-1 pl-7 pr-2 text-xs outline-none ring-1 ring-transparent focus:ring-border"
          />
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setFilterOpen((o) => !o)}
            className={`relative flex h-7 w-7 items-center justify-center rounded hover:bg-muted ${filter !== "all" || fileId ? "text-foreground" : "text-muted-foreground"}`}
            title="Filter"
          >
            {(filter !== "all" || fileId) && (
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-ring" />
            )}
            <Filter className="h-3.5 w-3.5" />
          </button>
          {filterOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-border bg-popover p-1 shadow-md">
              {(["all", "untranslated", "needs_review", "approved", "has_comments"] as FilterValue[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => handleFilterChange(f)}
                  className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent ${filter === f ? "font-medium text-foreground" : "text-muted-foreground"}`}
                >
                  {filter === f && <Check className="h-3 w-3 shrink-0" />}
                  <span className={filter === f ? "" : "ml-5"}>
                    {FILTER_LABELS[f]}
                  </span>
                </button>
              ))}
              {filesQuery.data && filesQuery.data.length > 0 && (
                <>
                  <div className="my-1 border-t border-border" />
                  <p className="px-2 py-1 text-xs font-medium text-muted-foreground">File</p>
                  <button
                    type="button"
                    onClick={() => { setFileId(""); setFilterOpen(false); }}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent ${!fileId ? "font-medium text-foreground" : "text-muted-foreground"}`}
                  >
                    {!fileId && <Check className="h-3 w-3 shrink-0" />}
                    <span className={!fileId ? "" : "ml-5"}>All files</span>
                  </button>
                  {filesQuery.data.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => { setFileId(f.id); setFilterOpen(false); }}
                      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent ${fileId === f.id ? "font-medium text-foreground" : "text-muted-foreground"}`}
                    >
                      {fileId === f.id && <Check className="h-3 w-3 shrink-0" />}
                      <span className={`min-w-0 truncate ${fileId === f.id ? "" : "ml-5"}`}>{f.name}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Active filter chips */}
      {(filter !== "all" || fileId) && (
        <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5">
          {filter !== "all" && (
            <span className="inline-flex items-center gap-1 rounded bg-accent px-1.5 py-0.5 text-xs font-medium text-accent-foreground">
              {FILTER_LABELS[filter]}
              <button
                type="button"
                onClick={() => handleFilterChange("all")}
                className="ml-0.5 rounded hover:text-foreground"
                aria-label="Clear state filter"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}
          {fileId && (
            <span className="inline-flex items-center gap-1 rounded bg-accent px-1.5 py-0.5 text-xs font-medium text-accent-foreground">
              {filesQuery.data?.find((f) => f.id === fileId)?.name ?? "File"}
              <button
                type="button"
                onClick={() => { setFileId(""); setFilterOpen(false); }}
                className="ml-0.5 rounded hover:text-foreground"
                aria-label="Clear file filter"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}
        </div>
      )}

      {/* List */}
      {stringsQuery.isPending ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : strings.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
          <p className="text-sm text-muted-foreground">No strings found</p>
        </div>
      ) : (
        <div ref={parentRef} className="flex-1 overflow-y-auto">
          <div
            style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const s = strings[virtualRow.index]!;
              const isSelected = s.id === selectedId;
              const state = s.translation?.state ?? null;
              return (
                <div
                  key={s.id}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(s.id)}
                    className={`flex w-full items-stretch gap-0 text-left ${isSelected ? "bg-muted hover:bg-muted" : "hover:bg-muted/60"}`}
                    style={{ height: `${virtualRow.size}px` }}
                  >
                    <StateIndicator state={state} />
                    <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-3 py-2">
                      <p className="flex min-w-0 items-baseline gap-1.5">
                        <span className="truncate text-xs font-medium text-foreground">
                          {s.value ?? s.key}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground/60">
                          {s.key}
                        </span>
                      </p>
                      {s.translation?.value ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {s.translation.value}
                        </p>
                      ) : (
                        <p className="truncate text-xs italic text-muted-foreground/60">
                          Not translated
                        </p>
                      )}
                    </div>
                    {s.hasComments && (
                      <div className="flex items-center pr-2">
                        <MessageSquare className="h-3 w-3 text-muted-foreground" />
                      </div>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Center Panel: Translation Editor ──────────────────────────────────────

function TranslationEditorPanel({
  projectId,
  locale,
  keyId,
  onNavigatePrev,
  onNavigateNext,
  hasPrev,
  hasNext,
}: {
  projectId: string;
  locale: string;
  keyId: string;
  onNavigatePrev: () => void;
  onNavigateNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}) {
  const utils = trpc.useUtils();
  const [value, setValue] = useState("");
  const [qaChecking, setQaChecking] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const stringQuery = trpc.strings.get.useQuery({ keyId, locale });
  const translationQuery = trpc.translation.get.useQuery({ keyId, locale });
  const tmQuery = trpc.tm.lookup.useQuery({ keyId, locale });
  const nearbyQuery = trpc.strings.nearby.useQuery({ keyId, locale });

  const string = stringQuery.data;
  const translationData = translationQuery.data;

  // Reset textarea when string changes
  useEffect(() => {
    if (translationData?.approved) {
      setValue(translationData.approved.value);
    } else {
      setValue("");
    }
  }, [keyId, translationData?.approved?.id]);

  const saveMutation = trpc.translation.save.useMutation({
    onSuccess: (result) => {
      const label = result.resultingState === "approved" ? "Approved" : "Suggestion saved";
      toast.success(label);
      setQaChecking(true);
      setTimeout(() => {
        void utils.translation.get.invalidate({ keyId, locale });
        void utils.strings.list.invalidate();
        setQaChecking(false);
      }, 1000);
    },
    onError: (err) => toast.error(err.message ?? "Failed to save"),
  });

  const approveMutation = trpc.translation.approve.useMutation({
    onSuccess: () => {
      toast.success("Translation approved");
      void utils.translation.get.invalidate({ keyId, locale });
      void utils.strings.list.invalidate();
    },
    onError: (err) => toast.error(err.message ?? "Failed to approve"),
  });

  const rejectMutation = trpc.translation.reject.useMutation({
    onSuccess: () => {
      toast.success("Suggestion rejected");
      void utils.translation.get.invalidate({ keyId, locale });
      void utils.strings.list.invalidate();
    },
    onError: (err) => toast.error(err.message ?? "Failed to reject"),
  });

  const voteMutation = trpc.translation.vote.useMutation({
    onSuccess: () => void utils.translation.get.invalidate({ keyId, locale }),
    onError: (err) => toast.error(err.message ?? "Failed to vote"),
  });

  function handleSave() {
    saveMutation.mutate({ keyId, locale, value });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
  }

  function copySourceToInput() {
    if (string?.value) {
      setValue(string.value);
      textareaRef.current?.focus();
    }
  }

  function insertAtCursor(text: string) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const newValue = value.slice(0, start) + text + value.slice(end);
    setValue(newValue);
    setTimeout(() => {
      el.selectionStart = start + text.length;
      el.selectionEnd = start + text.length;
      el.focus();
    }, 0);
  }

  const workflowSettings = translationData?.workflowSettings;
  const userRole = translationData?.userRole ?? "translator";
  const isAdmin = userRole === "owner" || userRole === "admin" || userRole === "member";
  const saveLabel =
    workflowSettings
      ? getSaveLabel(userRole, workflowSettings)
      : "Save suggestion";

  const charCount = value.length;
  const maxLength = string?.maxLength ?? null;
  const charCountExceeded = maxLength !== null && charCount > maxLength;

  if (!string) {
    if (stringQuery.isPending) {
      return (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      );
    }
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">String not found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted-foreground">
            {string.sourceFile?.name && (
              <span className="mr-1">{string.sourceFile.name} /</span>
            )}
            <button
              type="button"
              onClick={() => { void navigator.clipboard.writeText(string.key); toast.success("Copied"); }}
              className="font-mono hover:underline"
              title="Copy key"
            >
              {string.key}
            </button>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onNavigatePrev}
            disabled={!hasPrev}
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted disabled:opacity-40"
            title="Previous string (Ctrl+Shift+↑)"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onNavigateNext}
            disabled={!hasNext}
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted disabled:opacity-40"
            title="Next string (Ctrl+Shift+↓)"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-6 p-5">
          {/* Source string */}
          <section>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">Source</p>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-sm leading-relaxed">{string.value ?? <em className="text-muted-foreground">No source value</em>}</p>
            </div>
            <div className="mt-3 flex flex-col gap-1.5 text-xs text-muted-foreground">
              {string.context && (
                <div className="flex gap-2">
                  <span className="shrink-0 font-medium">Context</span>
                  <span>{string.context}</span>
                </div>
              )}
              <div className="flex gap-2">
                <span className="shrink-0 font-medium">Key</span>
                <code className="font-mono">{string.key}</code>
              </div>
              {string.sourceFile && (
                <div className="flex gap-2">
                  <span className="shrink-0 font-medium">File</span>
                  <span>{string.sourceFile.name}</span>
                </div>
              )}
              {string.labels.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {string.labels.map((label) => (
                    <span key={label} className="rounded bg-accent px-1.5 py-0.5 text-xs">
                      {label}
                    </span>
                  ))}
                </div>
              )}
              {maxLength && (
                <div className="flex gap-2">
                  <span className="shrink-0 font-medium">Max length</span>
                  <span>{maxLength} chars</span>
                </div>
              )}
            </div>
          </section>

          {/* Translation input */}
          <section>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Translation — {locale}
            </p>
            <div className="relative">
              <textarea
                ref={textareaRef}
                key={keyId}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={4}
                placeholder="Enter translation..."
                className={`w-full resize-none rounded-lg border bg-background p-3 text-sm outline-none focus:ring-2 ${
                  charCountExceeded
                    ? "border-destructive focus:ring-destructive/30"
                    : "border-border focus:ring-ring/30"
                }`}
              />
              {maxLength !== null && (
                <span
                  className={`absolute bottom-2 right-2 text-xs ${
                    charCountExceeded ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  {charCount}/{maxLength}
                </span>
              )}
            </div>

            {/* Toolbar */}
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={copySourceToInput}
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="Copy source to input (Ctrl+Shift+C)"
                >
                  <Copy className="h-3 w-3" />
                  Copy source
                </button>
                <button
                  type="button"
                  onClick={() => setValue("")}
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="Clear (Ctrl+Shift+U)"
                >
                  <X className="h-3 w-3" />
                  Clear
                </button>
              </div>
              <button
                type="button"
                onClick={handleSave}
                disabled={saveMutation.isPending || !value.trim() || charCountExceeded}
                className="btn-primary flex items-center gap-1.5 text-xs"
                title="Save (Ctrl+Enter)"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                {saveLabel}
              </button>
            </div>
            {qaChecking && (
              <p className="mt-1.5 text-xs text-muted-foreground animate-pulse">
                Running QA checks...
              </p>
            )}
          </section>

          {/* Suggestions */}
          {translationData && (translationData.suggestions.length > 0 || translationData.approved) && (
            <section>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {translationData.suggestions.length} suggestion{translationData.suggestions.length !== 1 ? "s" : ""}
              </p>
              <div className="flex flex-col gap-2">
                {translationData.approved && (
                  <div className="flex flex-col gap-1 rounded-lg border border-green-500/30 bg-green-500/5 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm leading-relaxed">{translationData.approved.value}</p>
                      <span className="shrink-0 rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                        Approved
                      </span>
                    </div>
                    {translationData.approved.translatedByUser && (
                      <p className="text-xs text-muted-foreground">
                        by @{translationData.approved.translatedByUser.username ?? translationData.approved.translatedByUser.name}
                      </p>
                    )}
                  </div>
                )}
                {translationData.suggestions.map((s) => (
                  <div key={s.id} className="flex flex-col gap-1.5 rounded-lg border border-border p-3">
                    <p
                      className="cursor-pointer text-sm leading-relaxed hover:text-foreground/80"
                      onClick={() => setValue(s.value)}
                      title="Click to use this suggestion"
                    >
                      {s.value}
                    </p>
                    <div className="flex items-center gap-2">
                      {s.translatedByUser && (
                        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                          @{s.translatedByUser.username ?? s.translatedByUser.name}
                        </p>
                      )}
                      {/* Voting */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => voteMutation.mutate({ translationId: s.id, vote: "up" })}
                          className={`flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs hover:bg-muted ${s.userVote === "up" ? "text-green-600" : "text-muted-foreground"}`}
                        >
                          <ThumbsUp className="h-3 w-3" />
                          {s.upvotes > 0 && <span>{s.upvotes}</span>}
                        </button>
                        <button
                          type="button"
                          onClick={() => voteMutation.mutate({ translationId: s.id, vote: "down" })}
                          className={`flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs hover:bg-muted ${s.userVote === "down" ? "text-red-500" : "text-muted-foreground"}`}
                        >
                          <ThumbsDown className="h-3 w-3" />
                          {s.downvotes > 0 && <span>{s.downvotes}</span>}
                        </button>
                      </div>
                      {/* Admin actions */}
                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          {s.canApprove ? (
                            <button
                              type="button"
                              onClick={() => approveMutation.mutate({ translationId: s.id })}
                              disabled={approveMutation.isPending}
                              className="rounded px-2 py-0.5 text-xs font-medium text-green-600 hover:bg-green-500/10"
                            >
                              Approve
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground" title="Cannot approve your own translation on this project">
                              Own
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => rejectMutation.mutate({ translationId: s.id })}
                            disabled={rejectMutation.isPending}
                            className="rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* TM suggestions */}
          <section>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Translation memory
            </p>
            {tmQuery.isPending ? (
              <p className="text-xs text-muted-foreground">Loading...</p>
            ) : !tmQuery.data || tmQuery.data.length === 0 ? (
              <p className="text-xs text-muted-foreground">No matches found</p>
            ) : (
              <div className="flex flex-col gap-2">
                {tmQuery.data.map((tm, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => insertAtCursor(tm.target)}
                    className="flex flex-col gap-1 rounded-lg border border-border p-2.5 text-left hover:bg-muted/50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">{tm.source}</p>
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${
                          tm.matchPct === 100
                            ? "bg-green-500/10 text-green-600"
                            : "bg-amber-400/10 text-amber-600"
                        }`}
                      >
                        {tm.matchPct}%
                      </span>
                    </div>
                    <p className="text-sm font-medium">{tm.target}</p>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Nearby strings */}
          {nearbyQuery.data && nearbyQuery.data.length > 0 && (
            <section>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Nearby strings
              </p>
              <div className="flex flex-col gap-1">
                {nearbyQuery.data.map((n) => (
                  <div key={n.id} className="rounded-lg border border-border p-2.5">
                    <div className="flex items-baseline gap-1.5">
                      <p className="truncate text-xs font-medium text-foreground">
                        {n.sourceValue ?? n.key}
                      </p>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground/60">
                        {n.key}
                      </span>
                    </div>
                    {n.translatedValue && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {n.translatedValue}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Right Panel: Context & Comments ───────────────────────────────────────

function ContextPanel({ keyId }: { keyId: string }) {
  const [commentBody, setCommentBody] = useState("");
  const utils = trpc.useUtils();

  const commentsQuery = trpc.comments.list.useQuery({ keyId });

  const createComment = trpc.comments.create.useMutation({
    onSuccess: () => {
      setCommentBody("");
      void utils.comments.list.invalidate({ keyId });
    },
    onError: (err) => toast.error(err.message ?? "Failed to post comment"),
  });

  const resolveComment = trpc.comments.resolve.useMutation({
    onSuccess: () => void utils.comments.list.invalidate({ keyId }),
    onError: (err) => toast.error(err.message ?? "Failed to resolve"),
  });

  function handleSubmitComment() {
    if (!commentBody.trim()) return;
    createComment.mutate({ keyId, body: commentBody.trim() });
  }

  const commentsList = commentsQuery.data ?? [];

  return (
    <div className="flex w-80 shrink-0 flex-col overflow-hidden border-l border-border">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Comments {commentsList.length > 0 && `(${commentsList.length})`}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {commentsQuery.isPending ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : commentsList.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 px-4 py-8 text-center">
            <MessageSquare className="h-6 w-6 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">No comments yet</p>
          </div>
        ) : (
          <div className="flex flex-col gap-0 divide-y divide-border">
            {commentsList.map((c) => (
              <div key={c.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium">
                      @{c.author.username ?? c.author.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {!c.resolved && (
                    <button
                      type="button"
                      onClick={() => resolveComment.mutate({ commentId: c.id })}
                      className="shrink-0 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Resolve"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <p className="mt-1 text-sm leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Comment input */}
      <div className="border-t border-border p-3">
        <textarea
          value={commentBody}
          onChange={(e) => setCommentBody(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              e.preventDefault();
              handleSubmitComment();
            }
          }}
          rows={2}
          placeholder="Add a comment... (Ctrl+Enter to send)"
          className="w-full resize-none rounded border border-border bg-background p-2 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
        <div className="mt-1.5 flex justify-end">
          <button
            type="button"
            onClick={handleSubmitComment}
            disabled={!commentBody.trim() || createComment.isPending}
            className="btn-primary text-xs"
          >
            {createComment.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              "Send"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function StringsEditorPage({ params }: Props) {
  const { projectId, locale } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("stringId");

  // We need the string list to enable prev/next navigation
  const filter = (searchParams.get("filter") as FilterValue) ?? "all";
  const q = searchParams.get("q") ?? undefined;
  const fileId = searchParams.get("fileId") ?? undefined;

  const stringsQuery = trpc.strings.list.useQuery({
    projectId,
    locale,
    filter,
    q,
    fileId,
    page: 1,
    limit: 100,
  });

  const strings = stringsQuery.data?.strings ?? [];
  const currentIdx = selectedId ? strings.findIndex((s) => s.id === selectedId) : -1;

  function selectString(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("stringId", id);
    router.replace(`/projects/${projectId}/strings/${locale}?${params.toString()}`);
  }

  function navigatePrev() {
    if (currentIdx > 0) {
      selectString(strings[currentIdx - 1]!.id);
    }
  }

  function navigateNext() {
    if (currentIdx < strings.length - 1) {
      selectString(strings[currentIdx + 1]!.id);
    }
  }

  // Global keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent) {
      const target = e.target as HTMLElement;
      const inInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;

      if (inInput && target.tagName !== "TEXTAREA") return;

      // Arrow navigation in list
      if (!inInput) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          if (currentIdx < strings.length - 1) {
            selectString(strings[currentIdx + 1]!.id);
          } else if (currentIdx === -1 && strings.length > 0) {
            selectString(strings[0]!.id);
          }
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          if (currentIdx > 0) selectString(strings[currentIdx - 1]!.id);
          return;
        }
      }

      // Ctrl/Cmd shortcuts
      if (e.ctrlKey || e.metaKey) {
        if (e.shiftKey) {
          if (e.key === "ArrowUp") { e.preventDefault(); navigatePrev(); }
          if (e.key === "ArrowDown") { e.preventDefault(); navigateNext(); }
          if (e.key === "C" || e.key === "c") {
            // Ctrl+Shift+C handled in editor panel
          }
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentIdx, strings, selectedId]);

  return (
    <div className="flex h-full min-h-0 flex-1">
      <StringListPanel
        projectId={projectId}
        locale={locale}
        selectedId={selectedId}
        onSelect={selectString}
      />

      {selectedId ? (
        <>
          <TranslationEditorPanel
            key={selectedId}
            projectId={projectId}
            locale={locale}
            keyId={selectedId}
            onNavigatePrev={navigatePrev}
            onNavigateNext={navigateNext}
            hasPrev={currentIdx > 0}
            hasNext={currentIdx < strings.length - 1}
          />
          <ContextPanel key={`comments-${selectedId}`} keyId={selectedId} />
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <MessageSquare className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            Select a string to start translating
          </p>
          <p className="text-xs text-muted-foreground/60">
            Use arrow keys to navigate
          </p>
        </div>
      )}
    </div>
  );
}

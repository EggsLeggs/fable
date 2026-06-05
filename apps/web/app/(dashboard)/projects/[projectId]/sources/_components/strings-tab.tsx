"use client";

import { useRef, useEffect, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Search,
  Copy,
  Check,
  FileText,
  MessageSquare,
  ImageIcon,
  ChevronRight,
  ChevronDown,
  Loader2,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { SelectCombobox } from "@/components/ui/select-combobox";

type SourceString = {
  id: string;
  key: string;
  value: string | null;
  context: string | null;
  labels: string[];
  hasScreenshot: boolean;
  status: "active" | "archived";
  sourceFile: { id: string; name: string; format: string } | null;
};

function StringRow({
  item,
  expanded,
  copied,
  onToggle,
  onCopyKey,
  onFilterByFile,
}: {
  item: SourceString;
  expanded: boolean;
  copied: boolean;
  onToggle: () => void;
  onCopyKey: (e: React.MouseEvent) => void;
  onFilterByFile: (fileId: string) => void;
}) {
  const truncatedValue =
    item.value && item.value.length > 120
      ? item.value.slice(0, 120) + "..."
      : item.value;

  return (
    <div className="border-b border-border last:border-0">
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onToggle();
        }}
        className="group flex w-full cursor-pointer items-start gap-3 px-4 py-3 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {/* Expand chevron */}
        <div className="mt-0.5 shrink-0 text-muted-foreground">
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </div>

        {/* Key */}
        <div className="flex w-56 shrink-0 items-center gap-1.5">
          <span
            className="truncate font-mono text-xs"
            title={item.key}
          >
            {item.key}
          </span>
          <button
            type="button"
            onClick={onCopyKey}
            className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-foreground"
            title="Copy key"
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
        </div>

        {/* Value */}
        <div className="min-w-0 flex-1 text-sm text-muted-foreground">
          {truncatedValue ?? (
            <span className="italic opacity-50">No source value</span>
          )}
        </div>

        {/* File pill */}
        <div className="shrink-0">
          {item.sourceFile && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFilterByFile(item.sourceFile!.id);
              }}
              className="inline-flex max-w-32 items-center gap-1 truncate rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted/80"
              title={item.sourceFile.name}
            >
              <FileText className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">{item.sourceFile.name}</span>
            </button>
          )}
        </div>

        {/* Indicators */}
        <div className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
          {item.context && (
            <span aria-label="Has context">
              <MessageSquare className="h-3.5 w-3.5" />
            </span>
          )}
          {item.hasScreenshot && (
            <span aria-label="Has screenshot">
              <ImageIcon className="h-3.5 w-3.5" />
            </span>
          )}
          {item.labels.length > 0 && (
            <span
              className="rounded-full bg-muted px-1.5 py-0.5 text-xs"
              title={item.labels.join(", ")}
            >
              {item.labels.length}
            </span>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="space-y-2.5 border-t border-border/50 bg-muted/20 px-10 py-3">
          {item.value && (
            <div>
              <p className="mb-0.5 text-xs font-medium text-muted-foreground">
                Source value
              </p>
              <p className="text-sm">{item.value}</p>
            </div>
          )}
          {item.context && (
            <div>
              <p className="mb-0.5 text-xs font-medium text-muted-foreground">
                Context
              </p>
              <p className="text-sm text-muted-foreground">{item.context}</p>
            </div>
          )}
          {item.labels.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Labels
              </p>
              <div className="flex flex-wrap gap-1">
                {item.labels.map((label) => (
                  <span
                    key={label}
                    className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}
          {item.hasScreenshot && (
            <div className="flex items-center gap-1 text-xs text-primary">
              <ImageIcon className="h-3 w-3" />
              <span>Screenshot attached</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type Props = {
  projectId: string;
};

export function StringsTab({ projectId }: Props) {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [fileFilter, setFileFilter] = useState("");
  const [labelFilter, setLabelFilter] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [missingContext, setMissingContext] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset scroll when filters change
  useEffect(() => {
    if (parentRef.current) parentRef.current.scrollTop = 0;
  }, [debouncedQ, fileFilter, labelFilter, showArchived, missingContext]);

  const filesQuery = trpc.sourceFile.list.useQuery({ projectId });

  const stringsQuery = trpc.sourceFile.listSourceStrings.useInfiniteQuery(
    {
      projectId,
      limit: 100,
      status: showArchived ? ("archived" as const) : ("active" as const),
      ...(debouncedQ && { q: debouncedQ }),
      ...(fileFilter && { sourceFileId: fileFilter }),
      ...(labelFilter && { label: labelFilter }),
      ...(missingContext && { missingContext: true }),
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    }
  );

  const allStrings: SourceString[] =
    stringsQuery.data?.pages.flatMap((p) => p.strings) ?? [];
  const hasNextPage = stringsQuery.hasNextPage;
  const isFetchingNextPage = stringsQuery.isFetchingNextPage;
  const total = stringsQuery.data?.pages[0]?.total;

  const rowCount = hasNextPage ? allStrings.length + 1 : allStrings.length;

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 10,
    measureElement:
      typeof window !== "undefined"
        ? (el) => el?.getBoundingClientRect().height ?? 52
        : undefined,
  });

  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    const lastItem = virtualItems[virtualItems.length - 1];
    if (!lastItem) return;
    if (
      lastItem.index >= allStrings.length - 1 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      void stringsQuery.fetchNextPage();
    }
  }, [virtualItems, allStrings.length, hasNextPage, isFetchingNextPage]);

  async function copyKey(id: string, key: string, e: React.MouseEvent) {
    e.stopPropagation();
    await navigator.clipboard.writeText(key);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search keys and values..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-8 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <SelectCombobox
          value={fileFilter}
          onValueChange={setFileFilter}
          emptyOption="All files"
          options={(filesQuery.data ?? []).map((f) => ({
            value: f.id,
            label: f.name,
          }))}
          triggerClassName="h-9 w-auto min-w-[10rem] rounded-md px-2 py-0 text-sm shadow-none"
        />

        <div className="relative">
          <input
            type="text"
            placeholder="Filter by label..."
            value={labelFilter}
            onChange={(e) => setLabelFilter(e.target.value)}
            className="h-9 w-36 rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <button
          type="button"
          onClick={() => setMissingContext(!missingContext)}
          className={cn(
            "h-9 rounded-md border px-3 text-xs font-medium transition-colors",
            missingContext
              ? "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-400"
              : "border-input bg-background text-muted-foreground hover:bg-muted"
          )}
        >
          Missing context
        </button>

        <button
          type="button"
          onClick={() => setShowArchived(!showArchived)}
          className={cn(
            "h-9 rounded-md border px-3 text-xs font-medium transition-colors",
            showArchived
              ? "border-muted-foreground/40 bg-muted text-foreground"
              : "border-input bg-background text-muted-foreground hover:bg-muted"
          )}
        >
          Archived
        </button>
      </div>

      {/* Result count */}
      {!stringsQuery.isLoading && total !== undefined && (
        <p className="text-xs text-muted-foreground">
          {total.toLocaleString()}{" "}
          {showArchived ? "archived" : "active"}{" "}
          {total === 1 ? "string" : "strings"}
          {(debouncedQ || fileFilter || labelFilter || missingContext) &&
            " matching filters"}
        </p>
      )}

      {stringsQuery.isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!stringsQuery.isLoading && allStrings.length === 0 && (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          No strings match your filters.
        </div>
      )}

      {!stringsQuery.isLoading && allStrings.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          {/* Column headers */}
          <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-4 py-2.5">
            <div className="w-3.5 shrink-0" />
            <div className="w-56 shrink-0 text-xs font-medium text-muted-foreground">
              Key
            </div>
            <div className="flex-1 text-xs font-medium text-muted-foreground">
              Source value
            </div>
            <div className="shrink-0 text-xs font-medium text-muted-foreground">
              File
            </div>
            <div className="w-16 shrink-0" />
          </div>

          {/* Virtualised rows */}
          <div
            ref={parentRef}
            className="overflow-y-auto"
            style={{ height: "min(600px, calc(100vh - 380px))" }}
          >
            <div
              style={{
                height: virtualizer.getTotalSize(),
                width: "100%",
                position: "relative",
              }}
            >
              {virtualItems.map((virtualRow) => {
                const isLoader = virtualRow.index > allStrings.length - 1;
                const item = allStrings[virtualRow.index];

                return (
                  <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {isLoader ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : item ? (
                      <StringRow
                        item={item}
                        expanded={expandedId === item.id}
                        copied={copiedId === item.id}
                        onToggle={() => toggleExpand(item.id)}
                        onCopyKey={(e) => copyKey(item.id, item.key, e)}
                        onFilterByFile={(fileId) => setFileFilter(fileId)}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

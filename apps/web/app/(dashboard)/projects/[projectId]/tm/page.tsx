"use client";

import { use, useState } from "react";
import { Brain, Trash2, ChevronLeft, ChevronRight, X } from "lucide-react";
import { t } from "@lingui/core/macro";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { DbTranslationMemory } from "@fable/db";

type Props = { params: Promise<{ projectId: string }> };

const PAGE_SIZE = 50;

function TmTable({
  entries,
  isAdmin,
  onDelete,
  deletingId,
}: {
  entries: DbTranslationMemory[];
  isAdmin: boolean;
  onDelete: (id: string) => void;
  deletingId: string | null;
}) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-border py-12 text-center">
        <Brain className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          {t`No translation memory entries found.`}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                {t`Source`}
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                {t`Source text`}
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                {t`Target`}
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                {t`Target text`}
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                {t`Uses`}
              </th>
              {isAdmin && <th className="w-12 px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.id}
                className="border-b border-border last:border-b-0 hover:bg-muted/20"
              >
                <td className="px-4 py-3">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
                    {entry.sourceLocale}
                  </span>
                </td>
                <td className="max-w-xs px-4 py-3">
                  <span className="line-clamp-2 text-muted-foreground">
                    {entry.sourceText}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
                    {entry.targetLocale}
                  </span>
                </td>
                <td className="max-w-xs px-4 py-3">
                  <span className="line-clamp-2">{entry.targetText}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {entry.usageCount}
                </td>
                {isAdmin && (
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onDelete(entry.id)}
                      disabled={deletingId === entry.id}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                      aria-label={t`Delete entry`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ClearLocaleDialog({
  open,
  locale,
  isPending,
  onConfirm,
  onClose,
}: {
  open: boolean;
  locale: string;
  isPending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t`Clear locale entries`}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t`This will permanently delete all translation memory entries for target locale`}{" "}
          <span className="font-mono font-medium text-foreground">{locale}</span>.{" "}
          {t`This cannot be undone.`}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            {t`Cancel`}
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isPending}>
            {isPending ? t`Clearing...` : t`Clear`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function TmPage({ params }: Props) {
  const { projectId } = use(params);
  const utils = trpc.useUtils();

  const [localeFilter, setLocaleFilter] = useState("");
  const [appliedLocale, setAppliedLocale] = useState<string | undefined>(undefined);
  const [offset, setOffset] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearingLocale, setClearingLocale] = useState<string | null>(null);

  const { data, isLoading } = trpc.tm.list.useQuery({
    projectId,
    targetLocale: appliedLocale,
    limit: PAGE_SIZE,
    offset,
  });

  const deleteMutation = trpc.tm.deleteEntry.useMutation({
    onSuccess() {
      toast.success(t`Entry deleted.`);
      setDeletingId(null);
      void utils.tm.list.invalidate({ projectId });
    },
    onError() {
      toast.error(t`Something went wrong.`);
      setDeletingId(null);
    },
  });

  const clearMutation = trpc.tm.clearLocale.useMutation({
    onSuccess() {
      toast.success(t`Locale entries cleared.`);
      setClearingLocale(null);
      setAppliedLocale(undefined);
      setLocaleFilter("");
      setOffset(0);
      void utils.tm.list.invalidate({ projectId });
    },
    onError() {
      toast.error(t`Something went wrong.`);
    },
  });

  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  // Only members with edit access can delete; only owner/admin can clear
  // We do not have a role query here, so we rely on the server returning FORBIDDEN
  // Use a separate context query — reuse the glossary.getContext pattern via project membership
  // Since we don't have a dedicated tm.getContext, we check on the first FORBIDDEN response.
  // For simplicity, show actions to all and let the server reject. The glossary does this too
  // (delete button visible to all admins). We'll show delete/clear to everyone and rely on server.
  // A better approach: add a getContext procedure. For now, show controls based on attempted actions.
  // Actually, let's do it right: use the same "optimistic show, server enforces" approach as glossary
  // but with a small helper query to know the user's role.
  // We'll use trpc.glossary.getContext which returns the role for this project.
  const { data: context } = trpc.glossary.getContext.useQuery({ projectId });
  const isAdmin = context
    ? context.role !== "translator"
    : false;
  const isOwnerOrAdmin = context
    ? context.role === "owner" || context.role === "admin"
    : false;

  function applyFilter() {
    const trimmed = localeFilter.trim();
    setAppliedLocale(trimmed || undefined);
    setOffset(0);
  }

  function clearFilter() {
    setLocaleFilter("");
    setAppliedLocale(undefined);
    setOffset(0);
  }

  function handleDelete(id: string) {
    setDeletingId(id);
    deleteMutation.mutate({ id, projectId });
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">{t`Translation Memory`}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t`Saved translation pairs used to guide machine translation.`}
          </p>
        </div>
        {isOwnerOrAdmin && appliedLocale && (
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setClearingLocale(appliedLocale)}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            {t`Clear locale`}
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Input
            value={localeFilter}
            onChange={(e) => setLocaleFilter(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") applyFilter(); }}
            placeholder={t`Filter by target locale (e.g. fr)`}
            className="pr-8"
          />
          {localeFilter && (
            <button
              type="button"
              onClick={clearFilter}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={t`Clear filter`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={applyFilter}>
          {t`Filter`}
        </Button>
        {appliedLocale && (
          <span className="text-sm text-muted-foreground">
            {t`Showing`}{" "}
            <span className="font-mono font-medium">{appliedLocale}</span>
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <span className="text-sm text-muted-foreground">{t`Loading...`}</span>
        </div>
      ) : (
        <TmTable
          entries={entries}
          isAdmin={isAdmin}
          onDelete={handleDelete}
          deletingId={deletingId}
        />
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {total} {t`entries`}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              <ChevronLeft className="h-4 w-4" />
              {t`Previous`}
            </Button>
            <span className="text-sm text-muted-foreground">
              {currentPage} / {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              {t`Next`}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {clearingLocale && (
        <ClearLocaleDialog
          open
          locale={clearingLocale}
          isPending={clearMutation.isPending}
          onConfirm={() =>
            clearMutation.mutate({ projectId, targetLocale: clearingLocale })
          }
          onClose={() => setClearingLocale(null)}
        />
      )}
    </div>
  );
}

"use client";

import { use, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  BookOpen,
  ShieldOff,
} from "lucide-react";
import { t } from "@lingui/core/macro";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { DbGlossaryEntry, DbGlossaryTranslation } from "@fable/db";

type Props = { params: Promise<{ projectId: string }> };

type EntryWithTranslations = DbGlossaryEntry & {
  translations: DbGlossaryTranslation[];
  submittedByUser: { id: string; name: string; username: string | null } | null;
};

type EntryFormValues = {
  term: string;
  definition: string;
  forbidden: boolean;
  caseSensitive: boolean;
  sourceLocale: string;
};

const EMPTY_FORM: EntryFormValues = {
  term: "",
  definition: "",
  forbidden: false,
  caseSensitive: false,
  sourceLocale: "en",
};

function EntryFormDialog({
  open,
  onClose,
  onSave,
  initial,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (values: EntryFormValues) => void;
  initial?: EntryFormValues;
  isPending: boolean;
}) {
  const [values, setValues] = useState<EntryFormValues>(initial ?? EMPTY_FORM);

  function update<K extends keyof EntryFormValues>(k: K, v: EntryFormValues[K]) {
    setValues((prev) => ({ ...prev, [k]: v }));
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? t`Edit term` : t`Add term`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label>{t`Term`}</Label>
            <Input
              value={values.term}
              onChange={(e) => update("term", e.target.value)}
              placeholder={t`e.g. homepage`}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t`Definition`} <span className="text-muted-foreground">{t`(optional)`}</span></Label>
            <textarea
              value={values.definition}
              onChange={(e) => update("definition", e.target.value)}
              rows={2}
              maxLength={500}
              placeholder={t`What does this term mean?`}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t`Source locale`}</Label>
            <Input
              value={values.sourceLocale}
              onChange={(e) => update("sourceLocale", e.target.value)}
              placeholder="en"
              maxLength={10}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={values.forbidden}
                onChange={(e) => update("forbidden", e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              {t`Forbidden term (do not translate)`}
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={values.caseSensitive}
                onChange={(e) => update("caseSensitive", e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              {t`Case sensitive`}
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            {t`Cancel`}
          </Button>
          <Button
            onClick={() => onSave(values)}
            disabled={!values.term.trim() || isPending}
          >
            {isPending ? t`Saving...` : t`Save`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GlossaryTable({
  entries,
  isAdmin,
  projectId,
  onEdit,
  onDelete,
}: {
  entries: EntryWithTranslations[];
  isAdmin: boolean;
  projectId: string;
  onEdit: (entry: EntryWithTranslations) => void;
  onDelete: (id: string) => void;
}) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-border py-12 text-center">
        <BookOpen className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{t`No glossary terms yet.`}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t`Term`}</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t`Definition`}</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t`Locale`}</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t`Flags`}</th>
            {isAdmin && <th className="w-20 px-4 py-3" />}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-b border-border last:border-b-0 hover:bg-muted/20">
              <td className="px-4 py-3 font-medium">
                {entry.term}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {entry.definition ?? <span className="text-muted-foreground/40">—</span>}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{entry.sourceLocale}</td>
              <td className="px-4 py-3">
                <div className="flex gap-1">
                  {entry.forbidden && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                      <ShieldOff className="h-3 w-3" />
                      {t`Forbidden`}
                    </span>
                  )}
                  {entry.caseSensitive && (
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      Aa
                    </span>
                  )}
                </div>
              </td>
              {isAdmin && (
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => onEdit(entry)}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label={t`Edit`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(entry.id)}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label={t`Delete`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PendingTab({
  projectId,
}: {
  projectId: string;
}) {
  const { data: pending = [], refetch } = trpc.glossary.listPending.useQuery({ projectId });
  const approveMutation = trpc.glossary.approve.useMutation({
    onSuccess() {
      toast.success(t`Term approved.`);
      void refetch();
    },
  });
  const rejectMutation = trpc.glossary.reject.useMutation({
    onSuccess() {
      toast.success(t`Suggestion rejected.`);
      void refetch();
    },
  });

  if (pending.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-border py-12 text-center">
        <Check className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{t`No pending suggestions.`}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t`Term`}</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t`Definition`}</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t`Submitted by`}</th>
            <th className="w-24 px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {pending.map((entry) => (
            <tr key={entry.id} className="border-b border-border last:border-b-0">
              <td className="px-4 py-3 font-medium">{entry.term}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {entry.definition ?? <span className="text-muted-foreground/40">—</span>}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {entry.submittedByUser?.name ?? <span className="text-muted-foreground/40">—</span>}
                {entry.submittedByUser?.username && (
                  <span className="ml-1 text-xs text-muted-foreground/60">
                    @{entry.submittedByUser.username}
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => approveMutation.mutate({ id: entry.id, projectId })}
                    disabled={approveMutation.isPending}
                    className="rounded p-1 text-muted-foreground hover:bg-green-500/10 hover:text-green-600"
                    aria-label={t`Approve`}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => rejectMutation.mutate({ id: entry.id, projectId })}
                    disabled={rejectMutation.isPending}
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label={t`Reject`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function GlossaryPage({ params }: Props) {
  const { projectId } = use(params);

  const utils = trpc.useUtils();
  const { data: entries = [], isLoading } = trpc.glossary.list.useQuery({ projectId });
  const { data: context } = trpc.glossary.getContext.useQuery({ projectId });

  const [tab, setTab] = useState<"approved" | "pending">("approved");
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<EntryWithTranslations | null>(null);

  const createMutation = trpc.glossary.create.useMutation({
    onSuccess() {
      toast.success(t`Term added.`);
      setShowForm(false);
      void utils.glossary.list.invalidate({ projectId });
      void utils.glossary.listPending.invalidate({ projectId });
    },
    onError(err) {
      if (err.data?.code === "FORBIDDEN") {
        toast.error(t`You do not have permission to add terms.`);
      } else {
        toast.error(t`Something went wrong.`);
      }
    },
  });

  const updateMutation = trpc.glossary.update.useMutation({
    onSuccess() {
      toast.success(t`Term updated.`);
      setEditingEntry(null);
      void utils.glossary.list.invalidate({ projectId });
    },
    onError() {
      toast.error(t`Something went wrong.`);
    },
  });

  const deleteMutation = trpc.glossary.delete.useMutation({
    onSuccess() {
      toast.success(t`Term deleted.`);
      void utils.glossary.list.invalidate({ projectId });
    },
    onError() {
      toast.error(t`Something went wrong.`);
    },
  });

  const isAdmin = context?.role !== "translator";
  const glossaryAccess = context?.glossaryAccess ?? "readonly";
  const canSuggest = glossaryAccess === "suggest" || glossaryAccess === "full";

  const canAdd = isAdmin || canSuggest;
  const addButtonLabel = isAdmin
    ? t`Add term`
    : t`Suggest term`;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{t`Glossary`}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t`Approved terms are used to guide machine translation.`}
          </p>
        </div>
        {canAdd && (
          <Button onClick={() => setShowForm(true)} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            {addButtonLabel}
          </Button>
        )}
      </div>

      {isAdmin && (
        <div className="flex gap-1 border-b border-border">
          <button
            type="button"
            onClick={() => setTab("approved")}
            className={cn(
              "px-3 pb-2 text-sm font-medium transition-colors",
              tab === "approved"
                ? "border-b-2 border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t`Approved`}
          </button>
          <button
            type="button"
            onClick={() => setTab("pending")}
            className={cn(
              "px-3 pb-2 text-sm font-medium transition-colors",
              tab === "pending"
                ? "border-b-2 border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t`Pending review`}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <span className="text-sm text-muted-foreground">{t`Loading...`}</span>
        </div>
      ) : tab === "approved" ? (
        <GlossaryTable
          entries={entries as EntryWithTranslations[]}
          isAdmin={isAdmin}
          projectId={projectId}
          onEdit={(entry) => setEditingEntry(entry)}
          onDelete={(id) => deleteMutation.mutate({ id, projectId })}
        />
      ) : (
        <PendingTab projectId={projectId} />
      )}

      {showForm && (
        <EntryFormDialog
          open
          onClose={() => setShowForm(false)}
          onSave={(values) =>
            createMutation.mutate({
              projectId,
              term: values.term,
              definition: values.definition || undefined,
              forbidden: values.forbidden,
              caseSensitive: values.caseSensitive,
              sourceLocale: values.sourceLocale,
            })
          }
          isPending={createMutation.isPending}
        />
      )}

      {editingEntry && (
        <EntryFormDialog
          open
          onClose={() => setEditingEntry(null)}
          onSave={(values) =>
            updateMutation.mutate({
              id: editingEntry.id,
              projectId,
              term: values.term,
              definition: values.definition || null,
              forbidden: values.forbidden,
              caseSensitive: values.caseSensitive,
            })
          }
          initial={{
            term: editingEntry.term,
            definition: editingEntry.definition ?? "",
            forbidden: editingEntry.forbidden,
            caseSensitive: editingEntry.caseSensitive,
            sourceLocale: editingEntry.sourceLocale,
          }}
          isPending={updateMutation.isPending}
        />
      )}
    </div>
  );
}

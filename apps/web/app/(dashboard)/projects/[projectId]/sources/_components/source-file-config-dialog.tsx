"use client";

import { useMemo, useState } from "react";
import { Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";
import {
  FORMAT_LABELS,
  inferOutputPattern,
  type FileFormat,
} from "@fable/formats";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectCombobox } from "@/components/ui/select-combobox";
import { trpc } from "@/lib/trpc/client";

const ALL_FORMATS: FileFormat[] = [
  "json_flat",
  "json_nested",
  "lingui_json",
  "po",
  "yaml",
];

const PLACEHOLDERS = [
  { token: "%locale%", example: "pt-BR" },
  { token: "%two_letters_code%", example: "pt" },
  { token: "%three_letters_code%", example: "por" },
  { token: "%language%", example: "Portuguese" },
  { token: "%locale_with_underscore%", example: "pt_BR" },
  { token: "%android_code%", example: "pt-rBR" },
  { token: "%bcp47_code%", example: "b+pt+BR" },
  { token: "%osx_code%", example: "pt-BR" },
  { token: "%osx_locale%", example: "pt_BR" },
  { token: "%original_path%", example: "locales/en" },
  { token: "%original_file_name%", example: "messages.json" },
  { token: "%original_file_name_without_extension%", example: "messages" },
  { token: "%file_name%", example: "messages" },
  { token: "%file_extension%", example: "json" },
];

type Props = {
  sourceFileId: string;
  filePath: string;
  sourceLocale: string;
  currentPattern: string | null;
  currentFormatOverride: FileFormat | null;
  onClose: () => void;
  onSaved: () => void;
};

export function SourceFileConfigDialog({
  sourceFileId,
  filePath,
  sourceLocale,
  currentPattern,
  currentFormatOverride,
  onClose,
  onSaved,
}: Props) {
  const [translationPattern, setTranslationPattern] = useState(
    currentPattern ?? ""
  );
  const [formatOverride, setFormatOverride] = useState<FileFormat | null>(
    currentFormatOverride
  );

  const suggestedPattern = useMemo(
    () => inferOutputPattern(filePath, sourceLocale),
    [filePath, sourceLocale]
  );

  const configure = trpc.sourceFile.configure.useMutation({
    onSuccess: () => {
      toast.success("Source file configuration saved");
      onSaved();
      onClose();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to save source file configuration");
    },
  });

  function handleSave() {
    configure.mutate({
      sourceFileId,
      translationPattern: translationPattern.trim() || null,
      formatOverride,
    });
  }

  const placeholder =
    suggestedPattern ?? "No source-locale segment found for this file";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-file-config-title"
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-background shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 id="source-file-config-title" className="text-base font-semibold">
            Configure source file
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            disabled={configure.isPending}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <div className="space-y-2">
            <label
              htmlFor="translation-pattern"
              className="block text-sm font-medium text-foreground"
            >
              Translation output pattern
            </label>
            <Input
              id="translation-pattern"
              value={translationPattern}
              onChange={(event) => setTranslationPattern(event.target.value)}
              placeholder={placeholder}
              disabled={configure.isPending}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to infer from the source path when possible.
            </p>
          </div>

          <details className="rounded-md border border-border bg-muted/20">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
              Available placeholders
            </summary>
            <div className="grid gap-2 border-t border-border p-3 sm:grid-cols-2">
              {PLACEHOLDERS.map((item) => (
                <div
                  key={item.token}
                  className="flex min-w-0 items-center justify-between gap-3 rounded-md bg-background px-2.5 py-2"
                >
                  <code className="truncate font-mono text-xs text-foreground">
                    {item.token}
                  </code>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {item.example}
                  </span>
                </div>
              ))}
            </div>
          </details>

          <div className="space-y-2">
            <label
              htmlFor="format-override"
              className="block text-sm font-medium text-foreground"
            >
              Format override
            </label>
            <SelectCombobox
              id="format-override"
              value={formatOverride ?? ""}
              onValueChange={(value) =>
                setFormatOverride(value ? (value as FileFormat) : null)
              }
              disabled={configure.isPending}
              emptyOption="Auto-detect"
              options={ALL_FORMATS.map((format) => ({
                value: format,
                label: FORMAT_LABELS[format],
              }))}
              searchable={false}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={configure.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={configure.isPending}
          >
            {configure.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

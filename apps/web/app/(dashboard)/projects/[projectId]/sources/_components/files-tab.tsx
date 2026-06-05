"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Upload,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useDropzone } from "react-dropzone";
import { trpc } from "@/lib/trpc/client";
import { detectFormat, FORMAT_LABELS } from "@fable/formats";
import type { FileFormat } from "@fable/formats";
import { SelectCombobox } from "@/components/ui/select-combobox";

const ALL_FORMATS: FileFormat[] = [
  "json_flat",
  "json_nested",
  "lingui_json",
  "po",
  "yaml",
];

function IngestStatusBadge({ status }: { status: string }) {
  if (status === "done") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
        <CheckCircle2 className="h-3 w-3" />
        Synced
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
        <XCircle className="h-3 w-3" />
        Failed
      </span>
    );
  }
  if (status === "processing" || status === "queued") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        {status === "queued" ? "Queued" : "Processing"}
      </span>
    );
  }
  return null;
}

function FormatBadge({ format }: { format: string }) {
  return (
    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
      {FORMAT_LABELS[format as FileFormat] ?? format}
    </span>
  );
}

function UploadModal({
  projectId,
  onClose,
  onUploaded,
}: {
  projectId: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<FileFormat | null>(null);
  const [uploading, setUploading] = useState(false);

  async function selectFile(file: File) {
    setSelectedFile(file);
    const content = await file.text();
    setSelectedFormat(detectFormat(file.name, content));
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted) => {
      const file = accepted[0];
      if (file) selectFile(file);
    },
    accept: {
      "application/json": [".json"],
      "text/x-gettext-translation": [".po", ".pot"],
      "text/yaml": [".yaml", ".yml"],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    disabled: uploading,
  });

  async function handleUpload() {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (selectedFormat) formData.append("format", selectedFormat);

      const res = await fetch(`/api/projects/${projectId}/files/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? `Upload failed (${res.status})`);
      }

      toast.success(`${selectedFile.name} uploaded - processing...`);
      onUploaded();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-lg">
        <h2 className="mb-4 text-base font-semibold">Upload source file</h2>

        <div
          {...getRootProps()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors ${
            isDragActive
              ? "border-ring bg-muted/50"
              : "border-border hover:border-ring"
          }`}
        >
          <input {...getInputProps()} />
          <FileText className="h-8 w-8 text-muted-foreground" />
          {selectedFile ? (
            <div className="text-center">
              <p className="text-sm font-medium">{selectedFile.name}</p>
              {!selectedFormat && (
                <p className="mt-1 text-xs text-destructive">
                  Unrecognised format
                </p>
              )}
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm font-medium">
                {isDragActive ? "Drop file here" : "Click or drag a file here"}
              </p>
              <p className="text-xs text-muted-foreground">
                .json, .po, .yaml supported, max 10MB
              </p>
            </div>
          )}
        </div>

        {selectedFile && (
          <div className="mt-4 space-y-2">
            <label className="block text-xs font-medium text-foreground">
              Format
            </label>
            <SelectCombobox
              value={selectedFormat ?? ""}
              onValueChange={(value) =>
                setSelectedFormat((value as FileFormat) || null)
              }
              disabled={uploading}
              placeholder="Select format..."
              options={ALL_FORMATS.map((fmt) => ({
                value: fmt,
                label: FORMAT_LABELS[fmt],
              }))}
              searchable={false}
            />
            {selectedFormat === "lingui_json" && (
              <p className="text-xs text-muted-foreground">
                Detected Lingui format - only message and translation fields will be imported.
              </p>
            )}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={!selectedFile || !selectedFormat || uploading}
            className="btn-primary inline-flex items-center gap-1.5"
          >
            {uploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Uploading...
              </>
            ) : (
              "Upload"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

type SourceFileItem = {
  id: string;
  name: string;
  path: string;
  format: string;
  sourceType: string;
  keyCount: number;
  lastSyncedAt: Date | null;
  latestIngestJob: {
    id: string;
    status: string;
    stringsAdded: number;
    stringsUpdated: number;
    stringsRemoved: number;
    error: string | null;
  } | null;
};

function SourceFileRow({
  file,
  projectId,
  onArchived,
}: {
  file: SourceFileItem;
  projectId: string;
  onArchived: () => void;
}) {
  const utils = trpc.useUtils();
  const [resyncing, setResyncing] = useState(false);
  const archive = trpc.sourceFile.archive.useMutation({
    onSuccess: () => {
      toast.success(`${file.name} archived`);
      onArchived();
    },
    onError: () => toast.error("Failed to archive file"),
  });

  async function handleResync() {
    setResyncing(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/files/${file.id}/resync`,
        { method: "POST" }
      );
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? `Resync failed (${res.status})`);
      }
      toast.success(`${file.name} re-sync queued`);
      utils.sourceFile.list.invalidate({ projectId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Resync failed");
    } finally {
      setResyncing(false);
    }
  }

  const isProcessing =
    file.latestIngestJob?.status === "queued" ||
    file.latestIngestJob?.status === "processing";

  const pollQuery = trpc.sourceFile.getIngestJob.useQuery(
    { jobId: file.latestIngestJob?.id ?? "" },
    {
      enabled: isProcessing && !!file.latestIngestJob?.id,
      refetchInterval: isProcessing ? 2000 : false,
    }
  );

  useEffect(() => {
    const status = pollQuery.data?.status;
    if (status === "done" || status === "failed") {
      utils.sourceFile.list.invalidate({ projectId });
    }
  }, [pollQuery.data?.status, utils, projectId]);

  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-3 pl-4 pr-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <Link
              href={`/projects/${projectId}/sources/${file.id}`}
              className="text-sm font-medium hover:underline"
            >
              {file.name}
            </Link>
            {file.path !== file.name && (
              <p className="text-xs text-muted-foreground">{file.path}</p>
            )}
          </div>
        </div>
      </td>
      <td className="py-3 pr-4">
        <FormatBadge format={file.format} />
      </td>
      <td className="py-3 pr-4">
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize text-muted-foreground">
          {file.sourceType}
        </span>
      </td>
      <td className="py-3 pr-4 text-sm tabular-nums">{file.keyCount}</td>
      <td className="py-3 pr-4">
        {file.latestIngestJob ? (
          <div>
            <IngestStatusBadge status={file.latestIngestJob.status} />
            {file.latestIngestJob.status === "done" && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                +{file.latestIngestJob.stringsAdded}{" "}
                ~{file.latestIngestJob.stringsUpdated}{" "}
                -{file.latestIngestJob.stringsRemoved}
              </p>
            )}
            {file.latestIngestJob.status === "failed" &&
              file.latestIngestJob.error && (
                <p
                  className="mt-0.5 max-w-xs truncate text-xs text-destructive"
                  title={file.latestIngestJob.error}
                >
                  {file.latestIngestJob.error}
                </p>
              )}
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            Never synced
          </span>
        )}
      </td>
      <td className="py-3 pr-4 text-right">
        <div className="flex items-center justify-end gap-1">
          {file.sourceType !== "upload" && (
            <button
              type="button"
              onClick={handleResync}
              disabled={resyncing || isProcessing}
              className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Re-sync from source"
            >
              {resyncing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => archive.mutate({ sourceFileId: file.id })}
            disabled={archive.isPending}
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            title="Archive file"
          >
            {archive.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </td>
    </tr>
  );
}

type Props = {
  projectId: string;
};

export function FilesTab({ projectId }: Props) {
  const [showUpload, setShowUpload] = useState(false);
  const utils = trpc.useUtils();

  const filesQuery = trpc.sourceFile.list.useQuery({ projectId });
  const files = (filesQuery.data ?? []) as SourceFileItem[];

  const hasProcessing = files.some(
    (f) =>
      f.latestIngestJob?.status === "queued" ||
      f.latestIngestJob?.status === "processing"
  );

  trpc.sourceFile.list.useQuery(
    { projectId },
    { refetchInterval: hasProcessing ? 2000 : false }
  );

  const handleUploaded = useCallback(() => {
    utils.sourceFile.list.invalidate({ projectId });
  }, [utils, projectId]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => filesQuery.refetch()}
          disabled={filesQuery.isFetching}
          className="btn-secondary flex items-center gap-1.5"
          title="Refresh"
        >
          <RefreshCw
            className={`h-4 w-4 ${filesQuery.isFetching ? "animate-spin" : ""}`}
          />
        </button>
        <button
          type="button"
          onClick={() => setShowUpload(true)}
          className="btn-primary flex items-center gap-1.5"
        >
          <Upload className="h-4 w-4" />
          Upload file
        </button>
      </div>

      {filesQuery.isPending && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {filesQuery.isError && (
        <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
          Failed to load source files.
        </div>
      )}

      {!filesQuery.isPending && files.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <FileText className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No source files yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Upload a JSON, PO, or YAML file to import translation keys.
          </p>
          <button
            type="button"
            onClick={() => setShowUpload(true)}
            className="btn-primary mt-4 flex items-center gap-1.5"
          >
            <Upload className="h-4 w-4" />
            Upload file
          </button>
        </div>
      )}

      {files.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="py-2.5 pl-4 pr-4 text-left text-xs font-medium text-muted-foreground">
                  File
                </th>
                <th className="py-2.5 pr-4 text-left text-xs font-medium text-muted-foreground">
                  Format
                </th>
                <th className="py-2.5 pr-4 text-left text-xs font-medium text-muted-foreground">
                  Source
                </th>
                <th className="py-2.5 pr-4 text-left text-xs font-medium text-muted-foreground">
                  Keys
                </th>
                <th className="py-2.5 pr-4 text-left text-xs font-medium text-muted-foreground">
                  Status
                </th>
                <th className="py-2.5 pr-4" />
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <SourceFileRow
                  key={file.id}
                  file={file}
                  projectId={projectId}
                  onArchived={() =>
                    utils.sourceFile.list.invalidate({ projectId })
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showUpload && (
        <UploadModal
          projectId={projectId}
          onClose={() => setShowUpload(false)}
          onUploaded={handleUploaded}
        />
      )}
    </div>
  );
}

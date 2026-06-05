"use client";

import { use } from "react";
import Link from "next/link";
import { ChevronRight, X, Loader2, FileText } from "lucide-react";
import { useTheme } from "@wrksz/themes/client";
import SyntaxHighlighter from "react-syntax-highlighter";
import {
  githubGist,
  atomOneDark,
} from "react-syntax-highlighter/dist/esm/styles/hljs";
import { trpc } from "@/lib/trpc/client";
import { FORMAT_LABELS } from "@fable/formats";
import type { FileFormat } from "@fable/formats";

const FORMAT_LANGUAGE: Record<string, string> = {
  json_flat: "json",
  json_nested: "json",
  yaml: "yaml",
  po: "gettext",
};

type Props = {
  params: Promise<{ projectId: string; sourceFileId: string }>;
};

export default function SourceFilePage({ params }: Props) {
  const { projectId, sourceFileId } = use(params);
  const { resolvedTheme } = useTheme();
  const fileQuery = trpc.sourceFile.get.useQuery({ sourceFileId });

  const file = fileQuery.data;
  const highlightStyle = resolvedTheme === "dark" ? atomOneDark : githubGist;
  const language = file ? (FORMAT_LANGUAGE[file.format] ?? "text") : "text";

  return (
    <>
      <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-4">
        <nav className="flex items-center gap-1.5 text-sm">
          <Link
            href={`/projects/${projectId}/sources`}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Sources
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          {file ? (
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              {file.name}
              {file.format && (
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-normal text-muted-foreground">
                  {FORMAT_LABELS[file.format as FileFormat] ?? file.format}
                </span>
              )}
            </span>
          ) : (
            <span className="h-4 w-32 animate-pulse rounded bg-muted" />
          )}
        </nav>
        <Link
          href={`/projects/${projectId}/sources`}
          className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Back to sources"
        >
          <X className="h-4 w-4" />
        </Link>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-[1100px] px-5 py-8 md:px-28 md:py-12">
        {fileQuery.isPending && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {fileQuery.isError && (
          <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
            Failed to load file.
          </div>
        )}

        {file && !file.rawContent && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
            <FileText className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">No preview available</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {file.sourceType === "upload"
                ? "This file has no stored content to preview."
                : "Re-sync this file from the Sources page to generate a preview."}
            </p>
          </div>
        )}

        {file?.rawContent && (
          <div className="overflow-hidden rounded-lg border border-border text-sm">
            <SyntaxHighlighter
              language={language}
              style={highlightStyle}
              showLineNumbers
              customStyle={{
                margin: 0,
                borderRadius: 0,
                fontSize: "0.8125rem",
                lineHeight: "1.6",
              }}
              lineNumberStyle={{
                minWidth: "3em",
                paddingRight: "1em",
                userSelect: "none",
                opacity: 0.4,
              }}
            >
              {file.rawContent}
            </SyntaxHighlighter>
          </div>
        )}
        </div>
      </div>
    </>
  );
}

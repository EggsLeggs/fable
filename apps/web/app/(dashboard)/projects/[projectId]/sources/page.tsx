"use client";

import { use, useState } from "react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";
import { FilesTab } from "./_components/files-tab";
import { StringsTab } from "./_components/strings-tab";

type Tab = "files" | "strings";

type Props = { params: Promise<{ projectId: string }> };

export default function SourcesPage({ params }: Props) {
  const { projectId } = use(params);
  const [activeTab, setActiveTab] = useState<Tab>("files");

  // Lightweight count query for the tab label - fetches 1 item to get total
  const countQuery = trpc.sourceFile.listSourceStrings.useInfiniteQuery(
    { projectId, limit: 1 },
    {
      getNextPageParam: () => undefined,
      staleTime: 5 * 60 * 1000,
    }
  );
  const totalStrings = countQuery.data?.pages[0]?.total;

  return (
    <div className="flex w-full flex-1 flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Sources</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect and manage translation sources for this project.
        </p>
      </header>

      {/* Tab bar */}
      <div className="flex border-b border-border">
        {(["files", "strings"] as Tab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              "border-b-2 px-4 pb-2.5 pt-0.5 text-sm font-medium capitalize transition-colors",
              activeTab === tab
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab === "strings"
              ? totalStrings !== undefined
                ? `Strings (${totalStrings.toLocaleString()})`
                : "Strings"
              : "Files"}
          </button>
        ))}
      </div>

      {activeTab === "files" && <FilesTab projectId={projectId} />}
      {activeTab === "strings" && <StringsTab projectId={projectId} />}
    </div>
  );
}

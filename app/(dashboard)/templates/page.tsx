"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { DbTemplate } from "@/lib/db/schema";
import { NewTemplateModal } from "@/components/NewTemplateModal";
import { PatternedBackground } from "@/components/PatternedBackground";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<DbTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/templates");
    const data = await res.json();
    setTemplates(data.templates ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex w-full flex-1 flex-col">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Templates</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reusable campaign configs and scenarios. Start new campaigns from a template.
          </p>
        </div>
        <button type="button" onClick={() => setModalOpen(true)} className="btn-primary shrink-0">
          + New
        </button>
      </header>

      {loading ? (
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className="aspect-[16/9] animate-pulse rounded-lg border border-border bg-muted/40"
              aria-hidden
            />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
          <p className="mb-4 text-sm text-muted-foreground">No templates yet.</p>
          <button type="button" onClick={() => setModalOpen(true)} className="btn-primary">
            Create your first template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </div>
      )}

      <NewTemplateModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={load}
      />
    </div>
  );
}

function TemplateCard({ template }: { template: DbTemplate }) {
  return (
    <Link
      href={`/templates/${template.id}`}
      className="group relative flex aspect-[16/9] flex-col items-center justify-center overflow-hidden rounded-lg border border-border bg-card p-4 text-card-foreground transition-colors hover:bg-muted dark:hover:bg-[hsl(var(--background))]"
    >
      <PatternedBackground />
      <span className="relative z-10 mb-1 rounded-full border border-border bg-background/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Template
      </span>
      <h2 className="relative z-10 text-center text-sm font-semibold">{template.name}</h2>
      <p className="relative z-10 mt-1.5 text-center text-[11px] font-medium tracking-wide text-foreground/60">
        {template.advertiser}
      </p>
    </Link>
  );
}

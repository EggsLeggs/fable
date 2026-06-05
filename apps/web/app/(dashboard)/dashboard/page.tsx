"use client";

import { useState } from "react";
import Link from "next/link";
import { PatternedBackground } from "@/components/PatternedBackground";
import type { DbProject } from "@fable/db";

export default function DashboardPage() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="flex w-full flex-1 flex-col">
      <header className="mb-6 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="btn-primary"
        >
          + New
        </button>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
        <p className="mb-4 text-sm text-muted-foreground">No projects yet.</p>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="btn-primary"
        >
          Create your first project
        </button>
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: DbProject }) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="group relative flex aspect-[16/9] flex-col items-center justify-center overflow-hidden rounded-lg border border-border bg-card p-4 text-card-foreground transition-colors hover:bg-muted dark:hover:bg-[hsl(var(--background))]"
    >
      <PatternedBackground />
      <span className="relative z-10 mb-1 rounded-full border border-border bg-background/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {project.visibility}
      </span>
      <h2 className="relative z-10 text-center text-sm font-semibold">
        {project.name}
      </h2>
      <p className="relative z-10 mt-1.5 text-center text-[11px] font-medium tracking-wide text-foreground/60 [text-shadow:0_0_10px_hsl(var(--background)),0_0_20px_hsl(var(--background))]">
        {project.sourceLocale}
      </p>
    </Link>
  );
}

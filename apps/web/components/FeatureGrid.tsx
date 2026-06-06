"use client";

import { Sparkles, Users, FileCode2, ShieldCheck, Code2, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";

const features = [
  {
    id: "ai",
    icon: Sparkles,
    title: "AI translation",
    description:
      "GPT-4o-mini pre-translates every new key using translation memory and your glossary as context.",
  },
  {
    id: "community",
    icon: Users,
    title: "Community contributions",
    description:
      "Public projects accept unauthenticated suggestions. Every suggestion enters a review queue before approval.",
  },
  {
    id: "formats",
    icon: FileCode2,
    title: "Format-agnostic",
    description:
      "JSON, YAML, and PO/Gettext - import and export to whatever format your codebase already uses.",
  },
  {
    id: "qa",
    icon: ShieldCheck,
    title: "Automated QA",
    description:
      "Placeholder matching, length ratios, terminal punctuation, and whitespace run on every save.",
  },
  {
    id: "opensource",
    icon: Code2,
    title: "Open source",
    description:
      "Fully open source and self-hostable. Deploy on Railway, Fly.io, or any VPS in minutes.",
  },
  {
    id: "vcs",
    icon: GitBranch,
    title: "VCS sync",
    description:
      "Sync directly with GitHub. Pull requests trigger automatic key extraction and MT pre-translation.",
  },
];

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <article className="group relative aspect-square overflow-hidden rounded-2xl border border-border bg-card p-6 transition-colors hover:bg-muted/40">
      <div className="flex h-full flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-muted transition-all duration-300 group-hover:opacity-0 group-hover:scale-95">
          <Icon className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
        </div>
        <h3
          className={cn(
            "text-sm font-medium transition-all duration-300",
            "group-hover:opacity-0 group-hover:scale-95"
          )}
        >
          {title}
        </h3>
        <p
          className={cn(
            "absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground",
            "scale-95 opacity-0 transition-all duration-300",
            "group-hover:scale-100 group-hover:opacity-100"
          )}
        >
          {description}
        </p>
      </div>
    </article>
  );
}

export function FeatureGrid() {
  return (
    <div
      id="features"
      className="mx-auto max-w-5xl scroll-mt-24 px-6"
    >
      <h2 className="text-center text-3xl font-bold tracking-tight">
        Features
      </h2>
      <p className="mx-auto mb-10 mt-3 max-w-lg text-center text-sm text-muted-foreground">
        From AI pre-translation to community review, everything your team needs
        to ship in every language.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {features.map((f) => (
          <FeatureCard key={f.id} icon={f.icon} title={f.title} description={f.description} />
        ))}
      </div>
    </div>
  );
}

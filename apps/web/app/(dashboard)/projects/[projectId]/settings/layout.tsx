"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { t } from "@lingui/core/macro";

export default function ProjectSettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { projectId } = useParams<{ projectId: string }>();

  const tabs = [
    { href: `/projects/${projectId}/settings`, label: t`General` },
    { href: `/projects/${projectId}/settings/collaboration`, label: t`Collaboration` },
    { href: `/projects/${projectId}/settings/languages`, label: t`Languages` },
  ];

  return (
    <div className="flex w-full flex-1 flex-col pb-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{t`Project Settings`}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t`Configure project name, locales, and collaboration settings.`}
        </p>
      </header>

      <nav className="mb-6 flex gap-1 border-b border-border">
        {tabs.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`-mb-px border-b-2 px-3 pb-2.5 text-sm font-medium transition-colors ${
                active
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}

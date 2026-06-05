"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@wrksz/themes/client";
import { t } from "@lingui/core/macro";
import { useLingui } from "@/components/lingui-provider";
import type { Locale } from "@/locales";
import { localeNames } from "@/locales";
import { SelectCombobox } from "@/components/ui/select-combobox";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <div className="mb-5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function FieldGroup({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">{label}</label>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      {children}
    </div>
  );
}

export default function PreferencesSettingsPage() {
  const { locale, setLocale, availableLocales } = useLingui();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const themes = [
    { id: "system" as const, label: t`System` },
    { id: "light" as const, label: t`Light` },
    { id: "dark" as const, label: t`Dark` },
  ];

  return (
    <div className="max-w-xl space-y-6">
      <Section
        title={t`Interface language`}
        description={t`Choose the language used across the Fable interface.`}
      >
        <FieldGroup label={t`Language`}>
          <SelectCombobox
            value={locale}
            onValueChange={(value) => setLocale(value as Locale)}
            options={availableLocales.map((code) => ({
              value: code,
              label: localeNames[code],
            }))}
            searchable={availableLocales.length > 6}
          />
        </FieldGroup>
      </Section>

      <Section
        title={t`Theme`}
        description={t`Choose how Fable looks on this device.`}
      >
        <div className="space-y-2">
          {themes.map(({ id, label }) => (
            <label
              key={id}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:bg-muted/50"
            >
              <input
                type="radio"
                name="theme"
                value={id}
                checked={mounted && theme === id}
                onChange={() => setTheme(id)}
                className="mt-0.5"
              />
              <span className="text-sm font-medium">{label}</span>
            </label>
          ))}
        </div>
      </Section>
    </div>
  );
}

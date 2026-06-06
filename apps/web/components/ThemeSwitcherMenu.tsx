"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@wrksz/themes/client";
import { t } from "@lingui/core/macro";

export function ThemeSwitcherMenu() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => setMounted(true), []);

  const themes = [
    { id: "system" as const, label: t`System` },
    { id: "dark" as const, label: t`Dark` },
    { id: "light" as const, label: t`Light` },
  ];

  return (
    <div className="p-1">
      <p className="px-3 py-2 text-xs text-muted-foreground">{t`Theme`}</p>
      {themes.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => setTheme(id)}
          className="flex w-full items-center rounded-[5px] px-3 py-2 text-left text-xs hover:bg-secondary"
        >
          <span
            className={`mr-3 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground ${
              mounted && theme === id ? "visible" : "invisible"
            }`}
          />
          {label}
        </button>
      ))}
    </div>
  );
}

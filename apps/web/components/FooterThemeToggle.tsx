"use client";

import { useEffect, useRef, useState } from "react";
import { SunMoon } from "lucide-react";
import { t } from "@lingui/core/macro";
import { ThemeSwitcherMenu } from "@/components/ThemeSwitcherMenu";
import { SidebarDropdownPanel } from "@/components/SidebarDropdownPanel";

export function FooterThemeToggle() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t`Theme`}
        className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <SunMoon className="h-4 w-4" strokeWidth={1.5} />
      </button>
      <SidebarDropdownPanel
        open={open}
        origin="bottom"
        className="absolute bottom-full right-0 z-50 mb-2 w-48 rounded-lg border border-border bg-popover py-1 shadow-lg"
      >
        <ThemeSwitcherMenu />
      </SidebarDropdownPanel>
    </div>
  );
}

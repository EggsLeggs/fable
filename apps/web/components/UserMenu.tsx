"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { LogOut, Settings } from "lucide-react";
import { signOut } from "@fable/auth/client";
import { UserAvatar } from "@/components/UserAvatar";

type Props = {
  userName: string;
  userEmail: string;
  userAvatarUrl: string | null;
  collapsed?: boolean;
};

export function UserMenu({ userName, userEmail, userAvatarUrl, collapsed }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const themes = [
    { id: "system", label: "System" },
    { id: "dark", label: "Dark" },
    { id: "light", label: "Light" },
  ] as const;

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-sidebar-accent ${
          collapsed ? "justify-center" : ""
        }`}
      >
        <UserAvatar src={userAvatarUrl} name={userName} />
        {!collapsed && (
          <span className="truncate text-sidebar-foreground">{userName}</span>
        )}
      </button>

      {open && (
        <div
          className={`absolute bottom-full z-50 mb-2 rounded-lg border border-border bg-popover py-1 shadow-lg ${
            collapsed ? "left-0 w-48" : "left-0 right-0 min-w-48"
          }`}
        >
          <div className="border-b border-border px-3 py-2">
            <p className="truncate text-sm font-medium text-popover-foreground">{userName}</p>
            <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
          </div>
          <div className="p-1">
            <button
              type="button"
              onClick={() => navigate("/settings")}
              className="flex w-full items-center gap-2 rounded-[5px] px-3 py-2 text-left text-xs hover:bg-secondary"
            >
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
              Settings
            </button>
          </div>
          <div className="border-t border-border" />
          <div className="p-1">
            <p className="px-3 py-2 text-xs text-muted-foreground">Theme</p>
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
          <div className="border-t border-border" />
          <button
            type="button"
            onClick={() => signOut({ fetchOptions: { onSuccess: () => { window.location.href = "/login"; } } })}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-secondary"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

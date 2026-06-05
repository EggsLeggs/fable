"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { User, LogOut, Trash2 } from "lucide-react";

type Props = {
  userName: string;
  userEmail: string;
  collapsed?: boolean;
};

export function UserMenu({ userName, userEmail, collapsed }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  async function handleDeleteAccount() {
    const confirmed = window.confirm(
      "Delete your account permanently? This removes your workspace, campaigns, and all data. This cannot be undone."
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data.error ?? "Failed to delete account");
        return;
      }
      setOpen(false);
      await signOut({ callbackUrl: "/login" });
      router.refresh();
    } catch {
      window.alert("Something went wrong. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

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

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-sidebar-accent ${
          collapsed ? "justify-center" : ""
        }`}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        {!collapsed && (
          <span className="truncate text-sidebar-foreground">{userName}</span>
        )}
      </button>

      {open && (
        <div
          className={`absolute bottom-full z-50 mb-2 rounded-lg border border-border bg-popover py-1 shadow-lg ${
            collapsed ? "left-0 w-48" : "left-0 right-0 min-w-[12rem]"
          }`}
        >
          <div className="border-b border-border px-3 py-2">
            <p className="truncate text-sm font-medium text-popover-foreground">{userName}</p>
            <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
          </div>
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
            disabled={deleting}
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-secondary disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={handleDeleteAccount}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? "Deleting…" : "Delete account"}
          </button>
        </div>
      )}
    </div>
  );
}

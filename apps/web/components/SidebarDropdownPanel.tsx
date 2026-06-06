"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  origin?: "top" | "bottom";
  className?: string;
  children: ReactNode;
};

export function SidebarDropdownPanel({
  open,
  origin = "top",
  className,
  children,
}: Props) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(id);
    }

    setVisible(false);
    const timeout = setTimeout(() => setMounted(false), 75);
    return () => clearTimeout(timeout);
  }, [open]);

  if (!mounted) return null;

  return (
    <div
      className={cn(
        "transform transition",
        visible
          ? "duration-100 ease-out opacity-100 scale-100"
          : "duration-75 ease-in opacity-0 scale-95",
        origin === "top" ? "origin-top" : "origin-bottom",
        className,
      )}
    >
      {children}
    </div>
  );
}

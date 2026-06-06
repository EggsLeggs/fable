"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type InlineUpdateActionProps = {
  visible: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
};

export function InlineUpdateAction({
  visible,
  onClick,
  disabled,
  children,
}: InlineUpdateActionProps) {
  return (
    <div
      className={cn(
        "grid transition-[grid-template-columns,opacity] duration-100 ease-out",
        visible ? "grid-cols-[1fr] opacity-100" : "grid-cols-[0fr] opacity-0"
      )}
      aria-hidden={!visible}
    >
      <div className="min-w-0 overflow-hidden">
        <Button
          type="button"
          onClick={onClick}
          disabled={disabled || !visible}
          tabIndex={visible ? 0 : -1}
          className={cn(
            "shrink-0 whitespace-nowrap transition-[transform,opacity] duration-100 ease-out",
            visible
              ? "translate-x-0 opacity-100"
              : "pointer-events-none translate-x-1 opacity-0"
          )}
        >
          {children}
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

export function PatternedBackground({ className }: Props) {
  const patternId = `pattern-${useId().replace(/:/g, "")}`;

  return (
    <div className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}>
      <svg className="h-full w-full" aria-hidden>
        <pattern
          id={patternId}
          x="10"
          y="10"
          width="14.423223834988539"
          height="14.423223834988539"
          patternUnits="userSpaceOnUse"
          patternTransform="translate(-0.45072574484339184,-0.45072574484339184)"
        >
          <circle
            cx="0.45072574484339184"
            cy="0.45072574484339184"
            r="0.45072574484339184"
            fill="var(--pattern-dot)"
          />
        </pattern>
        <rect x="0" y="0" width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
    </div>
  );
}

"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const screens = [
  {
    id: "translate",
    label: "Translate",
    src: "/screenshots/translate.png",
    alt: "Strings editor showing source text, translation input, and nearby strings panel",
  },
  {
    id: "dashboard",
    label: "Dashboard",
    src: "/screenshots/dashboard.png",
    alt: "Project dashboard showing translation key counts and per-language progress",
  },
  {
    id: "sources",
    label: "Sources",
    src: "/screenshots/sources.png",
    alt: "Sources view listing all translation keys with their source values and file names",
  },
];

export function ScreenshotSection() {
  const [active, setActive] = useState("translate");
  const activeScreen = screens.find((s) => s.id === active) ?? screens[0];

  return (
    <div className="mx-auto max-w-5xl px-6">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {/* Window chrome - desktop only */}
        <div className="hidden sm:flex h-8 items-center gap-1.5 border-b border-border bg-muted/50 px-4">
          <span className="h-2.5 w-2.5 rounded-full bg-border" />
          <span className="h-2.5 w-2.5 rounded-full bg-border" />
          <span className="h-2.5 w-2.5 rounded-full bg-border" />
        </div>
        <div className="relative aspect-[16/9] w-full">
          {screens.map((screen) => (
            <Image
              key={screen.id}
              src={screen.src}
              alt={screen.alt}
              fill
              sizes="(max-width: 1024px) 100vw, 1024px"
              className={cn(
                "object-cover object-top transition-opacity duration-300",
                screen.id === activeScreen.id ? "opacity-100" : "opacity-0"
              )}
              priority={screen.id === "translate"}
            />
          ))}
        </div>
      </div>

      {/* Desktop tabs - equal pills */}
      <div className="mt-4 hidden sm:flex w-full gap-2">
        {screens.map((screen) => (
          <button
            key={screen.id}
            type="button"
            onClick={() => setActive(screen.id)}
            className={cn(
              "flex-1 rounded-full border px-4 py-1.5 text-center text-sm transition-colors",
              active === screen.id
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-muted text-muted-foreground hover:border-foreground/40 hover:text-foreground"
            )}
          >
            {screen.label}
          </button>
        ))}
      </div>

      {/* Mobile tabs - active expands, inactive collapse to circles */}
      <div className="mt-4 flex gap-2 sm:hidden">
        {screens.map((screen) => {
          const isActive = active === screen.id;
          return (
            <button
              key={screen.id}
              type="button"
              onClick={() => setActive(screen.id)}
              className={cn(
                "flex h-8 min-w-8 items-center justify-center overflow-hidden rounded-full border transition-all duration-300 ease-in-out",
                isActive
                  ? "flex-[1_0_2rem] border-foreground bg-foreground px-4 text-background"
                  : "flex-[0_0_2rem] border-border bg-muted"
              )}
            >
              <span
                className={cn(
                  "whitespace-nowrap text-sm transition-opacity duration-200",
                  isActive ? "opacity-100 delay-100" : "opacity-0"
                )}
              >
                {screen.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

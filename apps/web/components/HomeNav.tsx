"use client";

import { useEffect, useState, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import { FableIcon } from "@/components/FableIcon";

interface HomeNavProps {
  isLoggedIn: boolean;
  localiseUrl: string | null;
}

const FEATURES_ID = "features";
const SCROLL_TO_FEATURES_KEY = "scrollToFeatures";

function scrollToFeatures() {
  const el = document.getElementById(FEATURES_ID);
  if (!el) return false;
  el.scrollIntoView({ behavior: "smooth" });
  return true;
}

function scrollToFeaturesWhenReady() {
  if (scrollToFeatures()) return;
  let attempts = 0;
  const tryScroll = () => {
    if (scrollToFeatures() || attempts++ >= 30) return;
    requestAnimationFrame(tryScroll);
  };
  requestAnimationFrame(tryScroll);
}

export function HomeNav({ isLoggedIn, localiseUrl }: HomeNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 72);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (pathname !== "/") return;
    if (!sessionStorage.getItem(SCROLL_TO_FEATURES_KEY)) return;

    sessionStorage.removeItem(SCROLL_TO_FEATURES_KEY);
    scrollToFeaturesWhenReady();
    window.history.replaceState(null, "", "/#features");
  }, [pathname]);

  const handleFeaturesClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();

    if (pathname === "/") {
      scrollToFeatures();
      window.history.replaceState(null, "", "/#features");
      return;
    }

    sessionStorage.setItem(SCROLL_TO_FEATURES_KEY, "true");
    router.push("/");
  };

  return (
    <>
    <header className="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none">
      <div
        className={cn(
          "pointer-events-auto w-full transition-all duration-300 ease-in-out",
          scrolled
            ? "mt-3 max-w-2xl rounded-2xl border border-border bg-background/95 shadow-xl backdrop-blur-sm px-5 py-3"
            : "max-w-5xl px-6 py-5"
        )}
      >
        <nav className="relative flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm font-bold font-serif tracking-tight">
            <FableIcon className="h-5 w-auto" />
            fable
          </Link>
          <div
            className={cn(
              "hidden sm:flex items-center gap-7",
              !localiseUrl &&
                "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            )}
          >
            <Link
              href="/#features"
              onClick={handleFeaturesClick}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Features
            </Link>
            <Link
              href="/pricing"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Pricing
            </Link>
            {localiseUrl && (
              <a
                href={localiseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                localise
              </a>
            )}
          </div>
          <div className="flex items-center gap-3">
            {!isLoggedIn && (
              <Link
                href="/login"
                className="hidden sm:inline-flex text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Sign in
              </Link>
            )}
            <Link
              href={isLoggedIn ? "/dashboard" : "/signup"}
              className="btn-primary"
            >
              {isLoggedIn ? "Go to projects" : "Get started"}
            </Link>
            <button
              type="button"
              className="sm:hidden flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>
        </nav>
      </div>
    </header>

    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>
            <span className="flex items-center gap-2">
              <FableIcon className="h-5 w-auto" />
              fable
            </span>
          </SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-1 p-4">
          <SheetClose asChild>
            <Link
              href="/#features"
              onClick={handleFeaturesClick}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Features
            </Link>
          </SheetClose>
          <SheetClose asChild>
            <Link
              href="/pricing"
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Pricing
            </Link>
          </SheetClose>
          {localiseUrl && (
            <a
              href={localiseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              localise
            </a>
          )}
        </div>
        <div className="mt-auto flex flex-col gap-2 border-t border-border p-4">
          {!isLoggedIn && (
            <SheetClose asChild>
              <Link href="/login" className="btn-secondary w-full justify-center">
                Sign in
              </Link>
            </SheetClose>
          )}
          <SheetClose asChild>
            <Link
              href={isLoggedIn ? "/dashboard" : "/signup"}
              className="btn-primary w-full justify-center"
            >
              {isLoggedIn ? "Go to projects" : "Get started"}
            </Link>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
    </>
  );
}

import Link from "next/link";
import { headers } from "next/headers";
import { Star } from "lucide-react";
import { auth } from "@fable/auth";
import { HomeNav } from "@/components/HomeNav";
import { LanguageTicker } from "@/components/LanguageTicker";
import { ScreenshotSection } from "@/components/ScreenshotSection";
import { FeatureGrid } from "@/components/FeatureGrid";
import { FooterThemeToggle } from "@/components/FooterThemeToggle";

function WavyDivider() {
  return (
    <div className="relative -my-px overflow-hidden" aria-hidden>
      <svg
        viewBox="0 0 1440 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full"
        preserveAspectRatio="none"
      >
        <path
          d="M0 60 C180 100 360 20 540 60 C720 100 900 20 1080 60 C1260 100 1380 40 1440 60 L1440 120 L0 120 Z"
          fill="hsl(var(--border))"
          fillOpacity="0.4"
        />
        <path
          d="M0 70 C200 30 400 110 600 70 C800 30 1000 110 1200 70 C1320 50 1400 80 1440 70 L1440 120 L0 120 Z"
          fill="hsl(var(--border))"
          fillOpacity="0.25"
        />
        <path
          d="M0 80 C150 50 350 110 540 80 C730 50 930 110 1100 80 C1250 58 1370 90 1440 80 L1440 120 L0 120 Z"
          fill="hsl(var(--border))"
          fillOpacity="0.15"
        />
      </svg>
    </div>
  );
}

export default async function RootPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const isLoggedIn = !!session?.user;
  const primaryHref = isLoggedIn ? "/dashboard" : "/signup";

  const localiseUrl = process.env.NEXT_PUBLIC_LOCALISE_URL ?? null;
  const githubUrl = "https://github.com/EggsLeggs/fable";

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-hidden">
      <HomeNav isLoggedIn={isLoggedIn} localiseUrl={localiseUrl} />

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pb-0 pt-36 text-center">
        {/* GitHub star badge */}
        <div className="mb-8 flex justify-center">
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="animate-pulse-ring inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:text-foreground"
          >
            <Star className="h-3 w-3" />
            star on GitHub
          </a>
        </div>

        <h1 className="mx-auto max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
          Localise together.{" "}
          <br className="hidden sm:block" />
          Ship everywhere.
        </h1>
        <p className="mx-auto mb-10 mt-5 max-w-xl text-base text-muted-foreground">
          The open source platform where developers and translators work in one
          place, not a dozen spreadsheets.
        </p>

        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href={primaryHref} className="btn-primary px-6 py-2.5">
            {isLoggedIn ? "Go to projects" : "Get started"}
          </Link>
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary px-6 py-2.5"
          >
            Self host
          </a>
        </div>
      </section>

      {/* Wavy divider with language tickers */}
      <div className="relative mt-20">
        <WavyDivider />
        <div className="bg-dot-pattern">
          <LanguageTicker />

          {/* Screenshot section */}
          <section className="py-16">
            <ScreenshotSection />
          </section>

          {/* Feature grid */}
          <section className="pb-16 pt-4">
            <FeatureGrid />
          </section>

          {/* CTA */}
          <section className="mx-auto max-w-lg px-6 py-24 text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Start localising for free
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              One project, three team members, and 1,000 translation keys to
              get your first locale shipped.
              <br />
              No credit card required.
            </p>
            <Link
              href={primaryHref}
              className="btn-primary mt-8 inline-block px-8 py-2.5"
            >
              {isLoggedIn ? "Go to projects" : "Get started"}
            </Link>
          </section>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <span className="text-sm font-bold tracking-tight">fable</span>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/pricing" className="hover:text-foreground transition-colors">
              Pricing
            </Link>
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              GitHub
            </a>
            {localiseUrl && (
              <a
                href={localiseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                localise
              </a>
            )}
          </div>
          <div className="flex items-center gap-3">
            <p className="text-xs text-muted-foreground">
              Open source under MIT
            </p>
            <FooterThemeToggle />
          </div>
        </div>
      </footer>
    </div>
  );
}

import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@fable/auth";
import { PatternedBackground } from "@/components/PatternedBackground";

const features = [
  {
    title: "AI-assisted translation",
    description:
      "GPT-4o-mini pre-translates every new key using translation memory and your glossary as context.",
  },
  {
    title: "Community contributions",
    description:
      "Public projects accept unauthenticated suggestions. Every suggestion enters a review queue before approval.",
  },
  {
    title: "Format-agnostic import/export",
    description:
      "JSON (flat and nested), YAML, and PO/Gettext — import from and export to whatever your codebase already uses.",
  },
  {
    title: "Automated QA checks",
    description:
      "Placeholder matching, length ratios, terminal punctuation, and whitespace run on every save — no manual review required.",
  },
];

export default async function RootPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const isLoggedIn = !!session?.user;
  const primaryHref = isLoggedIn ? "/dashboard" : "/signup";
  const primaryLabel = isLoggedIn ? "Go to projects" : "Get started";

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <nav className="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Link href="/" className="text-sm font-bold tracking-tight">
          fable
        </Link>
        <div className="flex items-center gap-3">
          {!isLoggedIn && (
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign in
            </Link>
          )}
          <Link href={primaryHref} className="btn-primary">
            {primaryLabel}
          </Link>
        </div>
      </nav>

      <section className="relative z-10 mx-auto max-w-3xl px-6 pb-20 pt-16 text-center sm:pt-24">
        <p className="mb-4 font-mono text-xs uppercase tracking-widest text-accent">
          Open source localisation
        </p>
        <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl">
          Translation infrastructure for developer-led teams
        </h1>
        <p className="mx-auto mb-10 max-w-xl text-base text-muted-foreground sm:text-lg">
          Fable gives your team a structured home for every translation key — with AI pre-translation,
          community contributions, format adapters, and automated QA built in.
        </p>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href={primaryHref} className="btn-primary px-6 py-2.5">
            {primaryLabel}
          </Link>
          {!isLoggedIn && (
            <Link href="/login" className="btn-secondary px-6 py-2.5">
              Sign in
            </Link>
          )}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-24">
        <h2 className="mb-10 text-center text-2xl font-bold tracking-tight">
          Everything a localisation workflow needs
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {features.map((f) => (
            <article
              key={f.title}
              className="rounded-xl border border-border bg-card/80 p-6 text-card-foreground"
            >
              <h3 className="mb-2 text-sm font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="relative z-10 border-t border-border bg-card/50 px-6 py-16 text-center">
        <h2 className="mb-4 text-2xl font-bold tracking-tight">
          Open source and self-hostable
        </h2>
        <p className="mb-8 text-sm text-muted-foreground">
          Deploy on Railway in minutes. Bring your own Postgres and Redis.
        </p>
        <Link href={primaryHref} className="btn-primary px-6 py-2.5">
          {primaryLabel}
        </Link>
      </section>

      <PatternedBackground className="opacity-50" />
    </div>
  );
}

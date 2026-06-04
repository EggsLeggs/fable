import Link from "next/link";
import { PatternedBackground } from "@/components/PatternedBackground";

type Props = {
  isLoggedIn: boolean;
};

const features = [
  {
    title: "Real-time decision log",
    description:
      "Every bid, skip, and flag appears instantly with full GPT-4o reasoning so operators can audit at a glance.",
  },
  {
    title: "Brand safety grounding",
    description:
      "Tavily checks run before each decision, with blocked topics and campaign rules baked into the agent context.",
  },
  {
    title: "Human oversight loop",
    description:
      "Approve, veto, or flag any decision. Vetoes feed back into the agent on the next call — trust through control.",
  },
  {
    title: "Full traceability",
    description:
      "Thrad delivers real ads on bids; Overmind traces every OpenAI call for complete auditability.",
  },
];

export function LandingPage({ isLoggedIn }: Props) {
  const primaryHref = isLoggedIn ? "/campaigns" : "/signup";
  const primaryLabel = isLoggedIn ? "Go to campaigns" : "Get started";

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <nav className="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Link href="/" className="text-sm font-bold tracking-tight">
          sentinel
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
          AI Campaign Oversight
        </p>
        <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl">
          Autonomous media buying you can trust
        </h1>
        <p className="mx-auto mb-10 max-w-xl text-base text-muted-foreground sm:text-lg">
          Sentinel runs real-time bid, skip, and flag decisions on ad placements — with human
          approve, veto, and challenge controls that feed back into every agent call.
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
        <p className="mt-6 text-xs text-muted-foreground">
          Thrad · Overmind · Tavily · GPT-4o
        </p>
      </section>

      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-24">
        <h2 className="mb-10 text-center text-2xl font-bold tracking-tight">
          Oversight built for the demo floor
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
          Get started for free today
        </h2>
        <p className="mb-8 text-sm text-muted-foreground">
          New accounts ship with a preconfigured Nike UK demo campaign — fire scenarios in seconds.
        </p>
        <Link href={primaryHref} className="btn-primary px-6 py-2.5">
          {primaryLabel}
        </Link>
      </section>

      <PatternedBackground className="opacity-50" />
    </div>
  );
}

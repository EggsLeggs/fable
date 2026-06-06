import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@fable/auth";
import { HomeNav } from "@/components/HomeNav";
import { FooterThemeToggle } from "@/components/FooterThemeToggle";
import { PricingContent } from "./pricing-content";

const githubUrl = "https://github.com/EggsLeggs/fable";

export default async function PricingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const isLoggedIn = !!session?.user;
  const localiseUrl = process.env.NEXT_PUBLIC_LOCALISE_URL ?? null;

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <HomeNav isLoggedIn={isLoggedIn} localiseUrl={localiseUrl} />

      <main className="pt-20">
        <PricingContent />
      </main>

      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <Link href="/" className="text-sm font-bold tracking-tight">
            fable
          </Link>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link
              href="/pricing"
              className="hover:text-foreground transition-colors"
            >
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

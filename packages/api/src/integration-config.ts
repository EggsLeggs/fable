import { TRPCError } from "@trpc/server";
import { isStripeConfigured } from "@fable/stripe";

function getGitHubAppSlug(): string | undefined {
  // Server-only env var (read at runtime). Avoid NEXT_PUBLIC_* here: Next.js inlines
  // those at build time, so Railway/runtime values are ignored in Docker deploys.
  const slug =
    process.env.GITHUB_APP_SLUG?.trim() ||
    process.env["NEXT_PUBLIC_GITHUB_APP_SLUG"]?.trim();
  return slug || undefined;
}

export function isGitHubAppConfigured(): boolean {
  return Boolean(
    process.env.GITHUB_APP_ID?.trim() &&
      process.env.GITHUB_PRIVATE_KEY?.trim() &&
      process.env.GITHUB_WEBHOOK_SECRET?.trim() &&
      getGitHubAppSlug()
  );
}

export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function getIntegrationAvailability() {
  return {
    github: {
      available: isGitHubAppConfigured(),
      appSlug: getGitHubAppSlug() ?? null,
    },
    openai: {
      available: isOpenAIConfigured(),
    },
    stripe: {
      available: isStripeConfigured(),
    },
  };
}

export function assertGitHubAppConfigured(): void {
  if (!isGitHubAppConfigured()) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "GitHub integration is not configured on this server.",
    });
  }
}

export function assertOpenAIConfigured(): void {
  if (!isOpenAIConfigured()) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Machine translation is not configured on this server.",
    });
  }
}

export function assertStripeConfigured(): void {
  if (!isStripeConfigured()) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Billing is not configured on this server.",
    });
  }
}

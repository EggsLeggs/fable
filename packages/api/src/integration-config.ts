import { TRPCError } from "@trpc/server";
import { isStripeConfigured } from "@fable/stripe";

export function isGitHubAppConfigured(): boolean {
  return Boolean(
    process.env.GITHUB_APP_ID?.trim() &&
      process.env.GITHUB_PRIVATE_KEY?.trim() &&
      process.env.GITHUB_WEBHOOK_SECRET?.trim() &&
      process.env.NEXT_PUBLIC_GITHUB_APP_SLUG?.trim()
  );
}

export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function getIntegrationAvailability() {
  return {
    github: {
      available: isGitHubAppConfigured(),
      appSlug: process.env.NEXT_PUBLIC_GITHUB_APP_SLUG?.trim() ?? null,
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

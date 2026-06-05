import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import {
  translationKeys,
  translations,
  translationMemory,
  projects,
  orgMembers,
} from "@fable/db";

function similarity(a: string, b: string): number {
  if (a === b) return 100;
  if (a.length === 0 || b.length === 0) return 0;

  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();

  // Simple Levenshtein-based similarity
  const maxLen = Math.max(aLower.length, bLower.length);
  const dist = levenshtein(aLower, bLower);
  return Math.round(((maxLen - dist) / maxLen) * 100);
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]!;
      } else {
        dp[i]![j] =
          1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
      }
    }
  }
  return dp[m]![n]!;
}

export const tmRouter = router({
  lookup: protectedProcedure
    .input(
      z.object({
        keyId: z.string(),
        locale: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const key = await ctx.db.query.translationKeys.findFirst({
        where: eq(translationKeys.id, input.keyId),
        with: { project: { with: { org: true } } },
      });
      if (!key) throw new TRPCError({ code: "NOT_FOUND" });

      const member = await ctx.db.query.orgMembers.findFirst({
        where: and(
          eq(orgMembers.userId, ctx.session.user.id),
          eq(orgMembers.orgId, key.project.orgId)
        ),
      });
      if (!member) throw new TRPCError({ code: "FORBIDDEN" });

      // Get the source value for this key
      const sourceTranslation = await ctx.db.query.translations.findFirst({
        where: and(
          eq(translations.keyId, input.keyId),
          eq(translations.locale, key.project.sourceLocale),
          sql`${translations.state} != 'rejected'`
        ),
        orderBy: (t, { desc }) => [desc(t.updatedAt)],
      });

      if (!sourceTranslation?.value) return [];

      const sourceText = sourceTranslation.value;

      // Look up TM entries for this org + locale pair
      const tmEntries = await ctx.db.query.translationMemory.findMany({
        where: and(
          eq(translationMemory.orgId, key.project.orgId),
          eq(translationMemory.sourceLocale, key.project.sourceLocale),
          eq(translationMemory.targetLocale, input.locale)
        ),
        limit: 200,
      });

      // Score by similarity and return top 5
      const scored = tmEntries
        .map((entry) => ({
          source: entry.sourceText,
          target: entry.targetText,
          matchPct: similarity(sourceText, entry.sourceText),
          projectName: key.project.org.name,
        }))
        .filter((e) => e.matchPct >= 50)
        .sort((a, b) => b.matchPct - a.matchPct)
        .slice(0, 5);

      return scored;
    }),
});

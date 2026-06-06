import type { Job } from "bullmq";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import {
  db,
  translationKeys,
  translations,
  translationMemory,
  glossaryEntries,
  glossaryTranslations,
  orgMembers,
  users,
} from "@fable/db";
import { createOpenAIAdapter } from "@fable/ai";
import type { TmHit, GlossaryEntry } from "@fable/ai";
import { reportMtUsage, resetMtUsageIfDue, getEffectivePlan, isStripeConfigured } from "@fable/stripe";

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

function tmSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();
  const maxLen = Math.max(aLower.length, bLower.length);
  const dist = levenshtein(aLower, bLower);
  return (maxLen - dist) / maxLen;
}

export interface MtTranslatePayload {
  keyId: string;
  targetLocale: string;
  sourceLocale: string;
}

export async function handleMtTranslate(
  job: Job<MtTranslatePayload>
): Promise<void> {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error("MT_NOT_CONFIGURED: OPENAI_API_KEY is not set");
  }

  const ai = createOpenAIAdapter();
  const { keyId, targetLocale, sourceLocale } = job.data;

  const key = await db.query.translationKeys.findFirst({
    where: eq(translationKeys.id, keyId),
    with: {
      translations: true,
      project: true,
    },
  });

  if (!key) throw new Error(`Translation key ${keyId} not found`);

  // Find the org owner — their plan governs MT access and usage is pooled across their orgs
  const ownerMembership = await db.query.orgMembers.findFirst({
    where: and(
      eq(orgMembers.orgId, key.project.orgId),
      eq(orgMembers.role, "owner")
    ),
    with: { user: true },
  });

  if (!ownerMembership) throw new Error(`No owner found for org ${key.project.orgId}`);
  const owner = ownerMembership.user;

  if (getEffectivePlan(owner.plan) === "free") {
    throw new Error("MT_NOT_AVAILABLE: machine translation requires a Pro plan");
  }

  await resetMtUsageIfDue(owner);

  const freshOwner = await db.query.users.findFirst({
    where: eq(users.id, owner.id),
    columns: { mtCharsUsed: true, mtCharsCap: true, stripeCustomerId: true },
  });

  const mtCharsUsed = freshOwner?.mtCharsUsed ?? 0;
  const mtCharsCap = freshOwner?.mtCharsCap ?? null;

  const sourceTranslation = key.translations.find((t) => t.locale === sourceLocale);
  if (!sourceTranslation) {
    throw new Error(`No source translation for locale ${sourceLocale}`);
  }

  const charCount = sourceTranslation.value.length;

  if (mtCharsCap !== null && mtCharsUsed >= mtCharsCap) {
    throw new Error(`MT_CAP_REACHED: monthly overage limit of ${mtCharsCap} chars reached`);
  }

  const sourceText = sourceTranslation.value;

  // Fetch TM entries and score by similarity
  const tmEntries = await db.query.translationMemory.findMany({
    where: and(
      eq(translationMemory.orgId, key.project.orgId),
      eq(translationMemory.sourceLocale, sourceLocale),
      eq(translationMemory.targetLocale, targetLocale)
    ),
    limit: 200,
  });

  const tmHits: TmHit[] = tmEntries
    .map((entry) => ({
      sourceText: entry.sourceText,
      targetText: entry.targetText,
      similarity: tmSimilarity(sourceText, entry.sourceText),
    }))
    .filter((h) => h.similarity >= 0.8)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);

  // Fetch approved glossary entries with their target locale translations
  const glossaryData = await db.query.glossaryEntries.findMany({
    where: and(
      eq(glossaryEntries.orgId, key.project.orgId),
      eq(glossaryEntries.status, "approved")
    ),
    with: { translations: true },
  });

  const glossaryEntriesForTranslation: GlossaryEntry[] = glossaryData.map((entry) => {
    const localTranslation = entry.translations.find(
      (gt) => gt.locale === targetLocale
    );
    return {
      term: entry.term,
      translation: localTranslation?.translation ?? null,
      forbidden: entry.forbidden,
      caseSensitive: entry.caseSensitive,
    };
  });

  const result = await ai.translate({
    sourceLocale,
    targetLocale,
    sourceText,
    keyDescription: key.description ?? undefined,
    tmHits,
    glossaryEntries: glossaryEntriesForTranslation,
  });

  const existing = key.translations.find((t) => t.locale === targetLocale);

  if (existing) {
    await db
      .update(translations)
      .set({ value: result.translation, state: "needs_review", updatedAt: new Date() })
      .where(eq(translations.id, existing.id));
  } else {
    await db.insert(translations).values({
      id: uuid(),
      keyId,
      locale: targetLocale,
      value: result.translation,
      state: "needs_review",
    });
  }

  // MT chars are pooled across all the owner's orgs
  await db
    .update(users)
    .set({ mtCharsUsed: mtCharsUsed + charCount })
    .where(eq(users.id, owner.id));

  if (freshOwner?.stripeCustomerId && isStripeConfigured()) {
    await reportMtUsage(freshOwner.stripeCustomerId, charCount);
  }
}

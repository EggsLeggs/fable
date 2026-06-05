import type { Job } from "bullmq";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { db, translationKeys, translations, orgMembers, users } from "@fable/db";
import { createOpenAIAdapter } from "@fable/ai";
import { reportMtUsage, resetMtUsageIfDue } from "@fable/stripe";

export interface MtTranslatePayload {
  keyId: string;
  targetLocale: string;
  sourceLocale: string;
}

export async function handleMtTranslate(
  job: Job<MtTranslatePayload>
): Promise<void> {
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

  if (owner.plan === "free") {
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

  const result = await ai.translate({
    sourceLocale,
    targetLocale,
    sourceText: sourceTranslation.value,
    keyDescription: key.description ?? undefined,
    tmHits: [],
    glossaryEntries: [],
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

  if (freshOwner?.stripeCustomerId) {
    await reportMtUsage(freshOwner.stripeCustomerId, charCount);
  }
}

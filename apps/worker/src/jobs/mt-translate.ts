import type { Job } from "bullmq";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { db, translationKeys, translations } from "@fable/db";
import { createOpenAIAdapter } from "@fable/ai";

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
    with: { translations: true },
  });

  if (!key) throw new Error(`Translation key ${keyId} not found`);

  const sourceTranslation = key.translations.find(
    (t) => t.locale === sourceLocale
  );
  if (!sourceTranslation) {
    throw new Error(`No source translation for locale ${sourceLocale}`);
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
}

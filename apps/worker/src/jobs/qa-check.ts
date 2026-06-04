import type { Job } from "bullmq";
import { eq } from "drizzle-orm";
import { db, translationKeys } from "@fable/db";
import { runQa } from "@fable/qa";
import type { QaReport } from "@fable/qa";

export interface QaCheckPayload {
  keyId: string;
  locale: string;
}

export async function handleQaCheck(
  job: Job<QaCheckPayload>
): Promise<QaReport | null> {
  const { keyId, locale } = job.data;

  const key = await db.query.translationKeys.findFirst({
    where: eq(translationKeys.id, keyId),
    with: { translations: true, project: true },
  });

  if (!key) throw new Error(`Translation key ${keyId} not found`);

  const sourceTranslation = key.translations.find(
    (t) => t.locale === key.project.sourceLocale
  );
  const targetTranslation = key.translations.find((t) => t.locale === locale);

  if (!sourceTranslation || !targetTranslation) return null;

  return runQa(keyId, locale, sourceTranslation.value, targetTranslation.value);
}

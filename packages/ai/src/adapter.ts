import { z } from "zod";

export const tmHitSchema = z.object({
  sourceText: z.string(),
  targetText: z.string(),
  similarity: z.number().min(0).max(1),
});

export const glossaryEntrySchema = z.object({
  term: z.string(),
  translation: z.string().nullable(),
  forbidden: z.boolean(),
  caseSensitive: z.boolean(),
});

export const translateParamsSchema = z.object({
  sourceLocale: z.string(),
  targetLocale: z.string(),
  sourceText: z.string(),
  keyDescription: z.string().optional(),
  tmHits: z.array(tmHitSchema).default([]),
  glossaryEntries: z.array(glossaryEntrySchema).default([]),
});

export const translateResultSchema = z.object({
  translation: z.string(),
  confidence: z.number().min(0).max(1),
  usedTmHit: z.boolean(),
});

export type TmHit = z.infer<typeof tmHitSchema>;
export type GlossaryEntry = z.infer<typeof glossaryEntrySchema>;
export type TranslateParams = z.infer<typeof translateParamsSchema>;
export type TranslateResult = z.infer<typeof translateResultSchema>;

export interface LLMAdapter {
  translate(params: TranslateParams): Promise<TranslateResult>;
}

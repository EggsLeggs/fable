import OpenAI from "openai";
import type { LLMAdapter, TranslateParams, TranslateResult } from "./adapter";
import { buildTranslatePrompt } from "./prompt";

export function createOpenAIAdapter(apiKey?: string): LLMAdapter {
  const client = new OpenAI({
    apiKey: apiKey ?? process.env.OPENAI_API_KEY,
  });

  return {
    async translate(params: TranslateParams): Promise<TranslateResult> {
      const prompt = buildTranslatePrompt(
        params.sourceLocale,
        params.targetLocale,
        params.sourceText,
        {
          keyDescription: params.keyDescription,
          tmHits: params.tmHits,
          glossaryEntries: params.glossaryEntries,
        }
      );

      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      });

      const content = response.choices[0]?.message.content;
      if (!content) {
        throw new Error("Unexpected response from OpenAI");
      }

      const usedTmHit =
        (params.tmHits?.some((h) => h.similarity >= 0.95)) ?? false;

      return {
        translation: content.trim(),
        confidence: usedTmHit ? 0.95 : 0.8,
        usedTmHit,
      };
    },
  };
}

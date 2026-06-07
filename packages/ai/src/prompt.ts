import type { TmHit, GlossaryEntry } from "./adapter";

export function buildTranslatePrompt(
  sourceLocale: string,
  targetLocale: string,
  sourceText: string,
  opts: {
    keyDescription?: string;
    tmHits?: TmHit[];
    glossaryEntries?: GlossaryEntry[];
    mubitContext?: string;
  } = {}
): string {
  const parts: string[] = [
    `Translate the following text from ${sourceLocale} to ${targetLocale}.`,
    `Return only the translated text with no explanation or surrounding quotes.`,
  ];

  if (opts.mubitContext) {
    parts.push(`\nLearned preferences for this project:\n${opts.mubitContext}`);
  }

  if (opts.keyDescription) {
    parts.push(`\nContext: ${opts.keyDescription}`);
  }

  const hits = opts.tmHits?.filter((h) => h.similarity >= 0.8) ?? [];
  if (hits.length > 0) {
    parts.push("\nTranslation memory (use as reference):");
    for (const hit of hits.slice(0, 3)) {
      parts.push(
        `  [${Math.round(hit.similarity * 100)}%] "${hit.sourceText}" => "${hit.targetText}"`
      );
    }
  }

  const glossary = opts.glossaryEntries ?? [];
  if (glossary.length > 0) {
    parts.push("\nGlossary:");
    for (const entry of glossary) {
      if (entry.forbidden) {
        parts.push(`  "${entry.term}" — DO NOT use this term`);
      } else if (entry.translation) {
        parts.push(`  "${entry.term}" => "${entry.translation}"`);
      }
    }
  }

  parts.push(`\nSource text:\n${sourceText}`);

  return parts.join("\n");
}

import type { FormatAdapter } from "./adapter";

type LinguiEntry = {
  message: string;
  translation?: string;
  origin?: unknown;
};

function isLinguiEntry(value: unknown): value is LinguiEntry {
  return (
    value !== null &&
    typeof value === "object" &&
    "message" in value &&
    typeof (value as LinguiEntry).message === "string"
  );
}

export interface ParsedString {
  key: string;
  value: string;
  existingTranslation?: string;
}

/**
 * Reads the translation field (not message) from a Lingui locale catalog.
 * Used when importing a locale file into Fable — we want the translated text,
 * not the source message text that .parse() returns.
 */
export function parseLinguiJsonTranslations(content: string): Record<string, string> {
  const raw = JSON.parse(content) as Record<string, unknown>;
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(raw)) {
    if (!isLinguiEntry(entry)) continue;
    const translation = (entry as LinguiEntry).translation;
    if (typeof translation === "string" && translation.trim()) {
      result[key] = translation;
    }
  }
  return result;
}

export function parseLinguiJsonDetailed(content: string): ParsedString[] {
  const raw = JSON.parse(content) as Record<string, unknown>;
  const result: ParsedString[] = [];

  for (const [key, entry] of Object.entries(raw)) {
    if (!isLinguiEntry(entry)) continue;

    const ps: ParsedString = { key, value: entry.message };
    if (
      typeof entry.translation === "string" &&
      entry.translation !== entry.message
    ) {
      ps.existingTranslation = entry.translation;
    }
    result.push(ps);
  }

  return result;
}

export const linguiJsonAdapter: FormatAdapter = {
  name: "Lingui JSON",
  extensions: [".json"],
  parse(content) {
    const result: Record<string, string> = {};
    for (const ps of parseLinguiJsonDetailed(content)) {
      result[ps.key] = ps.value;
    }
    return result;
  },
  serialize(translations) {
    const out: Record<string, { message: string; translation: string }> = {};
    for (const [key, value] of Object.entries(translations)) {
      out[key] = { message: value, translation: value };
    }
    return JSON.stringify(out, null, 2) + "\n";
  },
};

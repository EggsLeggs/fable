/**
 * Infers the output path for a translated file by substituting the source
 * locale code with the target locale code in a path segment.
 *
 * Only replaces a path segment that is an exact match for the source locale
 * (not a substring). Returns null if no such segment is found.
 *
 * Example: inferTranslationPath("locales/en/messages.json", "en", "fr")
 *          => "locales/fr/messages.json"
 */
export function inferTranslationPath(
  sourcePath: string,
  sourceLocale: string,
  targetLocale: string
): string | null {
  const parts = sourcePath.split("/");
  // Only look at directory segments (not the filename)
  const localeIdx = parts.slice(0, -1).findIndex((p) => p === sourceLocale);
  if (localeIdx === -1) return null;
  return parts.map((p, i) => (i === localeIdx ? targetLocale : p)).join("/");
}

/**
 * Infers an output pattern by replacing the source locale path segment with
 * the %locale% placeholder.
 */
export function inferOutputPattern(
  sourcePath: string,
  sourceLocale: string
): string | null {
  const parts = sourcePath.split("/");
  const localeIdx = parts.slice(0, -1).findIndex((p) => p === sourceLocale);
  if (localeIdx === -1) return null;
  return parts.map((p, i) => (i === localeIdx ? "%locale%" : p)).join("/");
}

const THREE_LETTER_CODES: Record<string, string> = {
  ar: "ara",
  bg: "bul",
  ca: "cat",
  cs: "ces",
  da: "dan",
  de: "deu",
  el: "ell",
  en: "eng",
  es: "spa",
  et: "est",
  fi: "fin",
  fr: "fra",
  he: "heb",
  hi: "hin",
  hr: "hrv",
  hu: "hun",
  id: "ind",
  it: "ita",
  ja: "jpn",
  ko: "kor",
  lt: "lit",
  lv: "lav",
  ms: "msa",
  nl: "nld",
  no: "nor",
  pl: "pol",
  pt: "por",
  ro: "ron",
  ru: "rus",
  sk: "slk",
  sl: "slv",
  sv: "swe",
  th: "tha",
  tr: "tur",
  uk: "ukr",
  vi: "vie",
  zh: "zho",
};

function parseLocale(locale: string): { language: string; region: string | null } {
  const [language = locale, region] = locale.replace(/_/g, "-").split("-");
  return {
    language: language.toLowerCase(),
    region: region ? region.toUpperCase() : null,
  };
}

function getLanguageName(language: string): string {
  try {
    return (
      new Intl.DisplayNames(["en"], { type: "language" }).of(language) ??
      language
    );
  } catch {
    return language;
  }
}

/**
 * Resolves a translation pattern string with placeholders to a concrete path.
 *
 * Supported placeholders:
 *   %two_letters_code%   - first two characters of the locale code
 *   %three_letters_code% - ISO 639-2/T language code when known
 *   %language%           - language display name in English
 *   %locale%             - locale as-is
 *   %locale_with_underscore% - locale with underscores
 *   %android_code%       - Android qualifier code
 *   %bcp47_code%         - BCP 47 resource code
 *   %osx_code%           - language tag for .lproj directories
 *   %osx_locale%         - OS X locale string
 *   %original_file_name% - filename from the source path
 *   %original_file_name_without_extension% - filename without extension
 *   %file_name%          - alias for filename without extension
 *   %original_path%      - directory portion of the source path
 *   %file_extension%     - extension without leading dot
 */
export function resolveTranslationPattern(
  pattern: string,
  sourcePath: string,
  targetLocale: string
): string {
  const parts = sourcePath.split("/");
  const filename = parts[parts.length - 1] ?? "";
  const originalPath = parts.slice(0, -1).join("/");
  const dotIdx = filename.lastIndexOf(".");
  const nameWithoutExt = dotIdx !== -1 ? filename.slice(0, dotIdx) : filename;
  const ext = dotIdx !== -1 ? filename.slice(dotIdx + 1) : "";
  const twoLetters = targetLocale.slice(0, 2);
  const { language, region } = parseLocale(targetLocale);
  const localeWithUnderscore = targetLocale.replace(/-/g, "_");
  const androidCode = region ? `${language}-r${region}` : language;
  const bcp47Code = ["b", language, region].filter(Boolean).join("+");
  const osxLocale = localeWithUnderscore;
  const osxCode = targetLocale;
  const threeLetters = THREE_LETTER_CODES[language] ?? language.slice(0, 3);

  return pattern
    .replace(/%two_letters_code%/g, twoLetters)
    .replace(/%three_letters_code%/g, threeLetters)
    .replace(/%language%/g, getLanguageName(language))
    .replace(/%locale%/g, targetLocale)
    .replace(/%locale_with_underscore%/g, localeWithUnderscore)
    .replace(/%android_code%/g, androidCode)
    .replace(/%bcp47_code%/g, bcp47Code)
    .replace(/%osx_code%/g, osxCode)
    .replace(/%osx_locale%/g, osxLocale)
    .replace(/%original_file_name_without_extension%/g, nameWithoutExt)
    .replace(/%file_name%/g, nameWithoutExt)
    .replace(/%file_extension%/g, ext)
    .replace(/%original_file_name%/g, filename)
    .replace(/%original_path%/g, originalPath);
}

/**
 * Resolves the output path for a translated file given a source file record.
 * Uses the stored translationPattern if set, otherwise falls back to
 * inferTranslationPath.
 */
export function resolveOutputPath(
  sourceFile: { path: string; translationPattern: string | null | undefined },
  sourceLocale: string,
  targetLocale: string
): string | null {
  if (sourceFile.translationPattern) {
    return resolveTranslationPattern(
      sourceFile.translationPattern,
      sourceFile.path,
      targetLocale
    );
  }
  return inferTranslationPath(sourceFile.path, sourceLocale, targetLocale);
}

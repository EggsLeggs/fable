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
 * Resolves a translation pattern string with placeholders to a concrete path.
 *
 * Supported placeholders:
 *   %two_letters_code%   - first two characters of the locale code (e.g. "fr" from "fr-CA")
 *   %locale%             - locale as-is (e.g. "fr-CA")
 *   %original_file_name% - filename from the source path (e.g. "messages.json")
 *   %original_path%      - directory portion of the source path (e.g. "src/locales/en")
 *   %original_file_name_without_extension% - filename without extension
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

  return pattern
    .replace(/%two_letters_code%/g, twoLetters)
    .replace(/%locale%/g, targetLocale)
    .replace(/%original_file_name_without_extension%/g, nameWithoutExt)
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

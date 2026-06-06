import { getAdapter, type FileFormat } from "./detect";
import { resolveOutputPath } from "./resolve-pattern";

export type TranslationFileEntry = {
  path: string;
  content: string;
};

export function buildTranslationFiles(opts: {
  sourceFile: {
    path: string;
    format: FileFormat;
    translationPattern: string | null | undefined;
  };
  keys: ReadonlyArray<{ id: string; key: string }>;
  approvedTranslations: ReadonlyArray<{
    keyId: string;
    locale: string;
    value: string;
  }>;
  sourceTranslations: ReadonlyArray<{ keyId: string; value: string }>;
  sourceLocale: string;
  targetLocales: string[];
}): TranslationFileEntry[] {
  const keyById = new Map(opts.keys.map((key) => [key.id, key]));
  const sourceStrings: Record<string, string> = {};

  for (const translation of opts.sourceTranslations) {
    const key = keyById.get(translation.keyId);
    if (key) sourceStrings[key.key] = translation.value;
  }

  const adapter = getAdapter(opts.sourceFile.format);
  const files: TranslationFileEntry[] = [];

  for (const targetLocale of opts.targetLocales) {
    const path = resolveOutputPath(
      opts.sourceFile,
      opts.sourceLocale,
      targetLocale
    );
    if (!path) continue;

    const translationMap: Record<string, string> = {};
    for (const translation of opts.approvedTranslations) {
      if (translation.locale !== targetLocale) continue;
      const key = keyById.get(translation.keyId);
      if (key) translationMap[key.key] = translation.value;
    }

    if (Object.keys(translationMap).length === 0) continue;

    files.push({
      path,
      content: adapter.serialize(translationMap, sourceStrings),
    });
  }

  return files;
}

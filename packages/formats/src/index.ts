export type { FormatAdapter } from "./adapter";
export { jsonFlat, jsonNested } from "./json";
export { yamlAdapter } from "./yaml";
export { poAdapter } from "./po";
export { linguiJsonAdapter, parseLinguiJsonDetailed, parseLinguiJsonTranslations } from "./lingui-json";
export type { ParsedString } from "./lingui-json";
export { detectFormat, getAdapter, FORMAT_LABELS, type FileFormat } from "./detect";
export { getDefaultOutputPattern } from "./detect";
export {
  buildTranslationFiles,
  type TranslationFileEntry,
} from "./build-translation-files";
export {
  inferOutputPattern,
  inferTranslationPath,
  resolveTranslationPattern,
  resolveOutputPath,
} from "./resolve-pattern";

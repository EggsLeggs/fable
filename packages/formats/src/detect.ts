import { jsonFlat, jsonNested } from "./json";
import { poAdapter } from "./po";
import { yamlAdapter } from "./yaml";
import type { FormatAdapter } from "./adapter";

export type FileFormat = "json_flat" | "json_nested" | "po" | "yaml";

export function detectFormat(filename: string, content: string): FileFormat | null {
  const lower = filename.toLowerCase();

  if (lower.endsWith(".po") || lower.endsWith(".pot")) return "po";
  if (lower.endsWith(".yaml") || lower.endsWith(".yml")) return "yaml";

  if (lower.endsWith(".json")) {
    try {
      const parsed = JSON.parse(content);
      const hasNested = parsed !== null && typeof parsed === "object" &&
        Object.values(parsed).some((v) => v !== null && typeof v === "object");
      return hasNested ? "json_nested" : "json_flat";
    } catch {
      return "json_flat";
    }
  }

  return null;
}

export function getAdapter(format: FileFormat): FormatAdapter {
  switch (format) {
    case "json_flat":
      return jsonFlat;
    case "json_nested":
      return jsonNested;
    case "po":
      return poAdapter;
    case "yaml":
      return yamlAdapter;
  }
}

export const FORMAT_LABELS: Record<FileFormat, string> = {
  json_flat: "JSON (flat)",
  json_nested: "JSON (nested)",
  po: "PO / Gettext",
  yaml: "YAML",
};

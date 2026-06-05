import { jsonFlat, jsonNested } from "./json";
import { poAdapter } from "./po";
import { yamlAdapter } from "./yaml";
import { linguiJsonAdapter } from "./lingui-json";
import type { FormatAdapter } from "./adapter";

export type FileFormat = "json_flat" | "json_nested" | "po" | "yaml" | "lingui_json";

function isLinguiJson(parsed: Record<string, unknown>): boolean {
  const values = Object.values(parsed);
  if (values.length === 0) return false;
  const linguiCount = values.filter(
    (v) => v !== null && typeof v === "object" && "message" in (v as object)
  ).length;
  return linguiCount / values.length >= 0.8;
}

export function detectFormat(filename: string, content: string): FileFormat | null {
  const lower = filename.toLowerCase();

  if (lower.endsWith(".po") || lower.endsWith(".pot")) return "po";
  if (lower.endsWith(".yaml") || lower.endsWith(".yml")) return "yaml";

  if (lower.endsWith(".json")) {
    // Try parsing the first 2048 bytes for a quick Lingui heuristic
    const snippet = content.slice(0, 2048);
    try {
      const snippetParsed = JSON.parse(snippet) as Record<string, unknown>;
      if (isLinguiJson(snippetParsed)) return "lingui_json";
    } catch {
      // snippet was truncated; fall through to full parse
    }

    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      if (isLinguiJson(parsed)) return "lingui_json";
      const hasNested = Object.values(parsed).some(
        (v) => v !== null && typeof v === "object"
      );
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
    case "lingui_json":
      return linguiJsonAdapter;
  }
}

export const FORMAT_LABELS: Record<FileFormat, string> = {
  json_flat: "JSON (flat)",
  json_nested: "JSON (nested)",
  po: "PO / Gettext",
  yaml: "YAML",
  lingui_json: "Lingui JSON",
};

import type { CheckAdapter } from "../adapter";

const PLACEHOLDER_PATTERNS = [
  /\{\{[^}]+\}\}/g,
  /\{[^}]+\}/g,
  /%\([^)]+\)[sd]/g,
  /%[sd]/g,
  /\$\{[^}]+\}/g,
  /__[A-Z_]+__/g,
];

function extractPlaceholders(text: string): string[] {
  const found: string[] = [];
  for (const pattern of PLACEHOLDER_PATTERNS) {
    const matches = text.match(pattern) ?? [];
    found.push(...matches);
  }
  return found.sort();
}

export const placeholdersCheck: CheckAdapter = {
  id: "placeholders",
  name: "Placeholders",
  description:
    "Checks that all source placeholders are present in the translation",
  check(source, target) {
    const sourcePlaceholders = extractPlaceholders(source);
    const targetPlaceholders = extractPlaceholders(target);

    const missing = sourcePlaceholders.filter(
      (p) => !targetPlaceholders.includes(p)
    );
    const extra = targetPlaceholders.filter(
      (p) => !sourcePlaceholders.includes(p)
    );

    if (missing.length > 0) {
      return {
        passed: false,
        severity: "error",
        message: `Missing placeholders: ${missing.join(", ")}`,
      };
    }

    if (extra.length > 0) {
      return {
        passed: false,
        severity: "warning",
        message: `Extra placeholders not in source: ${extra.join(", ")}`,
      };
    }

    return { passed: true, severity: "info" };
  },
};

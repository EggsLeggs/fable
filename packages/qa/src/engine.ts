import type { CheckAdapter, QaReport } from "./adapter";
import { placeholdersCheck } from "./checks/placeholders";
import { lengthCheck } from "./checks/length";
import { punctuationCheck } from "./checks/punctuation";
import { whitespaceCheck } from "./checks/whitespace";

export const defaultChecks: CheckAdapter[] = [
  placeholdersCheck,
  lengthCheck,
  punctuationCheck,
  whitespaceCheck,
];

export function runQa(
  keyId: string,
  locale: string,
  source: string,
  target: string,
  checks: CheckAdapter[] = defaultChecks
): QaReport {
  const results = checks.map((check) => ({
    checkId: check.id,
    checkName: check.name,
    ...check.check(source, target, locale),
  }));

  return {
    keyId,
    locale,
    checks: results,
    passed: results.every((r) => r.passed || r.severity === "info"),
  };
}

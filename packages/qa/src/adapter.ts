export type CheckSeverity = "error" | "warning" | "info";

export interface CheckResult {
  passed: boolean;
  severity: CheckSeverity;
  message?: string;
}

export interface CheckAdapter {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  check(source: string, target: string, locale?: string): CheckResult;
}

export interface QaReport {
  keyId: string;
  locale: string;
  checks: Array<{ checkId: string; checkName: string } & CheckResult>;
  passed: boolean;
}

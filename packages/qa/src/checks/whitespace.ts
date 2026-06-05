import type { CheckAdapter } from "../adapter";

export const whitespaceCheck: CheckAdapter = {
  id: "whitespace",
  name: "Leading/trailing whitespace",
  description: "Checks for unintended leading or trailing whitespace",
  check(_source, target) {
    if (target !== target.trim()) {
      return {
        passed: false,
        severity: "warning",
        message: "Translation has leading or trailing whitespace",
      };
    }

    if (/\s{2,}/.test(target)) {
      return {
        passed: false,
        severity: "info",
        message: "Translation contains consecutive whitespace",
      };
    }

    return { passed: true, severity: "info" };
  },
};

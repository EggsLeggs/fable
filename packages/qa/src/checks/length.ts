import type { CheckAdapter } from "../adapter";

const MAX_RATIO = 3.0;
const MIN_RATIO = 0.2;
const WARNING_RATIO = 2.5;

export const lengthCheck: CheckAdapter = {
  id: "length",
  name: "Length ratio",
  description:
    "Checks that translation length is within an acceptable ratio of the source",
  check(source, target) {
    if (source.length === 0) return { passed: true, severity: "info" };
    const ratio = target.length / source.length;

    if (ratio > MAX_RATIO || ratio < MIN_RATIO) {
      return {
        passed: false,
        severity: "error",
        message: `Length ratio ${ratio.toFixed(2)} is outside acceptable range (${MIN_RATIO}-${MAX_RATIO})`,
      };
    }

    if (ratio > WARNING_RATIO) {
      return {
        passed: false,
        severity: "warning",
        message: `Translation is ${ratio.toFixed(2)}x longer than source`,
      };
    }

    return { passed: true, severity: "info" };
  },
};

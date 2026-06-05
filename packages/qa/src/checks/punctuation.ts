import type { CheckAdapter } from "../adapter";

const SENTENCE_ENDINGS = [".", "!", "?", "…"];

function endsWithSentencePunctuation(text: string): boolean {
  const trimmed = text.trimEnd();
  return SENTENCE_ENDINGS.some((c) => trimmed.endsWith(c));
}

export const punctuationCheck: CheckAdapter = {
  id: "punctuation",
  name: "Terminal punctuation",
  description:
    "Checks that source and target have matching terminal punctuation",
  check(source, target) {
    const sourceEnds = endsWithSentencePunctuation(source);
    const targetEnds = endsWithSentencePunctuation(target);

    if (sourceEnds !== targetEnds) {
      return {
        passed: false,
        severity: "warning",
        message: sourceEnds
          ? "Source ends with punctuation but translation does not"
          : "Translation ends with punctuation but source does not",
      };
    }

    return { passed: true, severity: "info" };
  },
};
